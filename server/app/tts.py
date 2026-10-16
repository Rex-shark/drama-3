"""POST /v1/tts：多角色參考音檔上傳、產生、WAV 或 PCM 串流回應。

流程：解析 multipart → 全部驗證（400）→ 取鎖（409 / 503）→ 寫暫存檔 → 建立產生器 →
先取第一段（錯誤仍可回 500 JSON）→ 非串流：段間檢查斷線、累積後編 WAV；
串流：StreamingResponse 逐段送出 raw s16le。

提前中斷偵測：每段餵給 EarlyStopDetector（100 ms RMS，兩條規則並存：出聲後連續 6 秒 < −50 dBFS，
或開頭 6 秒內從未有窗 > −40 dBFS）；觸發即停止取段。非串流裁尾並標 X-Early-Stop
（尾端靜音保留最後有聲點後 0.5 秒；開頭無聲只回開頭 0.5 秒）；串流直接結束。
非串流另回 X-Chunks（自動分段數，與 /v1/tts/last 的 chunks 同值）；串流開頭還不知道，不回。
結果記入 /v1/tts/last（只記回過 200 的產生）。

清理（記錄結果 → gen.close + mx.clear_cache → 刪暫存檔 → 釋放鎖）由 Generation.finalize 負責，冪等、在 shield 內執行：
- 鎖要等 MLX 執行緒上當前那次 next 跑完、gen.close 完成才釋放，health 的 busy 會持續到
  當前段結束（spec 明定的行為）。run_mlx(gen.close) 會排在仍在跑的 next 後面，自然做到。
- Starlette 在斷線時用 anyio 取消串流 body；被取消的 scope 內每個 await 都會再被取消，
  所以 finalize 必須包在 anyio.CancelScope(shield=True) 裡。
- 若取消剛好落在 send()（body 產生器停在 yield），Starlette 不會 aclose 它；
  GuardedStreamingResponse 在自己的 finally 補做 aclose + finalize，保證一定清理。
"""

import logging
import time
import uuid
from pathlib import Path
from typing import AsyncIterator

import anyio
import numpy as np
from fastapi import APIRouter, Request
from fastapi.responses import Response
from starlette.datastructures import UploadFile
from starlette.responses import StreamingResponse
from starlette.types import Receive, Scope, Send

from .audio import Chunk, GenerateRequest, encode_wav, to_s16le
from .early_stop import EarlyStopDetector
from .errors import ApiError
from .models import ModelManager
from .settings import DEFAULT_MAX_TOKENS, DEFAULT_SAMPLE_RATE, TMP_DIR
from .validation import (
    check_reference_wav,
    parse_bool,
    parse_float,
    parse_int,
    parse_speaker,
    validate_ref_text,
    validate_text,
)
from .worker import run_mlx

logger = logging.getLogger("drama3.tts")
router = APIRouter()


class ClientGone(Exception):
    """串流已開始後產生失敗：只能中止連線（uvicorn 會直接關掉 socket）。"""


class Generation:
    """一次產生的資源與結果：鎖、暫存檔、MLX 產生器、提前中斷偵測、/v1/tts/last 紀錄。finalize 冪等。"""

    def __init__(self, manager: ModelManager, model: object, temp_paths: list[Path], stream: bool) -> None:
        self.manager = manager
        self.model = model
        self.temp_paths = temp_paths
        self.stream = stream
        self.request_id = uuid.uuid4().hex
        self._gen = None
        self._finalized = False
        self._recorded = False
        self.started = time.perf_counter()
        self.ended_at: float | None = None
        self.audio_seconds = 0.0  # 模型已產生的秒數（未裁切）
        self.result_audio_seconds = 0.0  # 記入 last：非串流＝裁切後長度，串流＝實際送出秒數
        self.segments: set[int] = set()  # 已處理的自動分段索引
        self.detector: EarlyStopDetector | None = None
        self.responded = False  # 已回 200 才記入 /v1/tts/last
        self.outcome = "失敗"  # 完成 / 提前中斷 / 斷線 / 失敗

    @property
    def early_stop(self) -> bool:
        return self.detector is not None and self.detector.triggered

    @property
    def early_stop_reason(self) -> str:
        """log 用：silence（出聲後長靜音）/ onset（開頭無聲）/ -。"""
        return (self.detector.reason if self.detector is not None else None) or "-"

    async def start(self, req: GenerateRequest) -> None:
        try:
            self._gen = await run_mlx(self.manager.backend.start, self.model, req)
        except ValueError as exc:  # mlx-audio validate_text 的雙保險
            raise ApiError(400, "invalid_text", f"mlx-audio 拒收：{exc}") from None

    async def next(self) -> Chunk | None:
        chunk = await run_mlx(self.manager.backend.next_chunk, self._gen)
        if chunk is not None:
            self.audio_seconds += len(chunk.audio) / chunk.sample_rate
            if chunk.segment is not None:
                self.segments.add(chunk.segment)
            if self.detector is None:
                self.detector = EarlyStopDetector(chunk.sample_rate)
            self.detector.feed(chunk.audio)
        return chunk

    def mark_end(self) -> None:
        if self.ended_at is None:
            self.ended_at = time.perf_counter()

    @property
    def elapsed(self) -> float:
        return (self.ended_at or time.perf_counter()) - self.started

    def record(self) -> None:
        """寫入 /v1/tts/last（只記回過 200 的產生）並記一行摘要 log。冪等。"""
        if self._recorded:
            return
        self._recorded = True
        self.mark_end()
        logger.info(
            "產生結束：request_id=%s 結果=%s %s 分段數=%d 音訊=%.2f 秒（模型產生 %.2f 秒） 耗時=%.2f 秒 提前中斷=%s（規則=%s）",
            self.request_id, self.outcome, "串流" if self.stream else "非串流", len(self.segments),
            self.result_audio_seconds, self.audio_seconds, self.elapsed, "是" if self.early_stop else "否",
            self.early_stop_reason,
        )
        if self.responded:
            self.manager.last_generation = {
                "request_id": self.request_id,
                "early_stop": self.early_stop,
                "audio_seconds": round(self.result_audio_seconds, 3),
                "elapsed_seconds": round(self.elapsed, 3),
                "chunks": len(self.segments),
            }

    async def finalize(self) -> None:
        if self._finalized:
            return
        self._finalized = True
        with anyio.CancelScope(shield=True):
            # 先記結果再釋放鎖：前端看到串流結束或 busy=false 後查 /v1/tts/last 一定拿得到這次
            try:
                self.record()
            except Exception:
                logger.exception("記錄產生結果失敗")
            try:
                if self._gen is not None:
                    # 排在仍在跑的 next 之後，在同一條 MLX 執行緒關閉產生器並 clear_cache
                    await run_mlx(self.manager.backend.close, self._gen)
            except Exception:
                logger.exception("關閉產生器失敗")
            finally:
                self._gen = None
                for path in self.temp_paths:
                    try:
                        path.unlink(missing_ok=True)
                    except OSError:
                        logger.exception("刪除暫存檔失敗：%s", path)
                self.manager.release()
                logger.info("已釋放鎖（request_id=%s）", self.request_id)


class GuardedStreamingResponse(StreamingResponse):
    """不論正常結束、斷線取消或例外，都保證 aclose body 並 finalize。"""

    def __init__(self, content: AsyncIterator[bytes], job: Generation, **kwargs) -> None:
        super().__init__(content, **kwargs)
        self._job = job

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        try:
            await super().__call__(scope, receive, send)
        finally:
            with anyio.CancelScope(shield=True):
                try:
                    await self.body_iterator.aclose()  # type: ignore[attr-defined]
                except Exception:
                    logger.exception("關閉串流 body 失敗")
                await self._job.finalize()


def _field(form, name: str) -> str | None:
    value = form.get(name)
    if value is None:
        return None
    if isinstance(value, UploadFile):
        raise ApiError(422, "invalid_request", f"{name} 必須是文字欄位，不是檔案")
    return str(value)


@router.post("/v1/tts")
async def tts(request: Request) -> Response:
    manager: ModelManager = request.app.state.manager
    form = await request.form()
    try:
        # ---- 1. 文字 ----
        text_value = form.get("text")
        if text_value is None:
            raise ApiError(400, "invalid_text", "缺少 text 欄位")
        if isinstance(text_value, UploadFile):
            raise ApiError(400, "invalid_text", "text 必須是文字欄位，不是檔案")
        text = str(text_value)
        validate_text(text)

        # ---- 2. 參考音檔三組欄位 ----
        audios = form.getlist("ref_audio")
        ref_texts = form.getlist("ref_text")
        ref_speakers = form.getlist("ref_speaker")
        if not (len(audios) == len(ref_texts) == len(ref_speakers)):
            raise ApiError(
                400,
                "reference_mismatch",
                f"ref_audio / ref_text / ref_speaker 數量必須相同，收到 "
                f"{len(audios)} / {len(ref_texts)} / {len(ref_speakers)}",
            )
        prefixed_texts: list[str] = []
        for i, (rt, rs) in enumerate(zip(ref_texts, ref_speakers)):
            if isinstance(rt, UploadFile) or isinstance(rs, UploadFile):
                raise ApiError(400, "reference_mismatch", f"ref_text[{i}] / ref_speaker[{i}] 必須是文字欄位")
            validate_ref_text(rt, i)
            speaker = parse_speaker(rs, i)
            prefixed_texts.append(f"<|speaker:{speaker}|> {rt}")

        # ---- 3. 取樣參數（未給就用目前載入版本的預設） ----
        stream = parse_bool("stream", _field(form, "stream"))
        temperature = parse_float("temperature", _field(form, "temperature"), low=0.0, high=2.0,
                                  low_inclusive=True)
        top_p = parse_float("top_p", _field(form, "top_p"), low=0.0, high=1.0, low_inclusive=False)
        top_k = parse_int("top_k", _field(form, "top_k"), low=1)
        max_tokens = parse_int("max_tokens", _field(form, "max_tokens"), low=1)

        # ---- 4. 解碼參考音檔（壞檔 / 超長） ----
        audio_bytes: list[bytes] = []
        for i, item in enumerate(audios):
            if not isinstance(item, UploadFile):
                raise ApiError(400, "reference_decode_failed", f"ref_audio[{i}] 必須是上傳的檔案")
            data = await item.read()
            await anyio.to_thread.run_sync(check_reference_wav, data, i, item.filename)
            audio_bytes.append(data)
    finally:
        await form.close()

    # ---- 5. 取鎖（409 busy / 503 no_model_loaded） ----
    model, variant = manager.acquire_for_generation()
    defaults = variant.defaults
    temp_paths: list[Path] = []
    job = Generation(manager, model, temp_paths, stream)
    handed_off = False
    try:
        # 未給的取樣參數用目前載入版本的預設，永遠明確傳給 generate
        params = dict(
            temperature=defaults.temperature if temperature is None else temperature,
            top_p=defaults.top_p if top_p is None else top_p,
            top_k=defaults.top_k if top_k is None else top_k,
            max_tokens=DEFAULT_MAX_TOKENS if max_tokens is None else max_tokens,
        )

        # ---- 6. 參考音檔落暫存檔（.wav；mlx-audio 依副檔名判斷格式） ----
        TMP_DIR.mkdir(parents=True, exist_ok=True)
        for data in audio_bytes:
            path = TMP_DIR / f"ref-{uuid.uuid4().hex}.wav"
            temp_paths.append(path)
            await anyio.to_thread.run_sync(path.write_bytes, data)

        req = GenerateRequest(
            text=text,
            ref_audio_paths=list(temp_paths),
            ref_texts=prefixed_texts,
            stream=stream,
            **params,
        )
        logger.info(
            "開始產生：request_id=%s 版本 %s，%s，文字 %d 字，參考音檔 %d 段，temperature=%s top_p=%s top_k=%s max_tokens=%s",
            job.request_id, variant.id, "串流" if stream else "非串流", len(text), len(temp_paths),
            req.temperature, req.top_p, req.top_k, req.max_tokens,
        )
        await job.start(req)

        # ---- 7. 先取第一段：mlx-audio 的錯誤在第一次 next 才拋，這時還能回 500 JSON ----
        try:
            first = await job.next()
        except Exception as exc:
            logger.exception("產生失敗（第一段）")
            raise ApiError(500, "generation_failed", f"產生失敗：{exc}") from None

        if stream:
            sample_rate = first.sample_rate if first else DEFAULT_SAMPLE_RATE
            response = GuardedStreamingResponse(
                _stream_body(request, job, first),
                job,
                media_type="audio/pcm",
                headers={
                    "X-Sample-Rate": str(sample_rate),
                    "X-Request-Id": job.request_id,
                    "Cache-Control": "no-store",
                },
            )
            job.responded = True
            handed_off = True  # 之後的清理交給 response
            return response

        return await _collect(request, job, first)
    finally:
        if not handed_off:
            await job.finalize()


async def _collect(request: Request, job: Generation, first: Chunk | None) -> Response:
    """非串流：內部仍逐段取（約 0.3 秒一段），段間檢查斷線與提前中斷，最後編 WAV。"""
    chunks: list[Chunk] = [first] if first else []
    while first is not None and not job.early_stop:
        if await request.is_disconnected():
            job.outcome = "斷線"
            job.mark_end()
            logger.info("用戶端已斷線（非串流），停止取段；已產生 %.2f 秒音訊", job.audio_seconds)
            return Response(status_code=204)  # 回應送不出去，內容無所謂；未回 200，不記入 last
        try:
            chunk = await job.next()
        except Exception as exc:
            logger.exception("產生失敗")
            raise ApiError(500, "generation_failed", f"產生失敗：{exc}") from None
        if chunk is None:
            break
        chunks.append(chunk)
    job.mark_end()

    sample_rate = chunks[0].sample_rate if chunks else DEFAULT_SAMPLE_RATE
    audio = np.concatenate([c.audio for c in chunks]) if chunks else np.zeros(0, np.float32)
    if job.early_stop:
        # 裁掉尾端靜音，保留最後有聲點之後 0.5 秒
        keep = job.detector.keep_samples(len(audio))
        logger.info("偵測到提前中斷（非串流，規則=%s）：已產生 %.2f 秒，裁成 %.2f 秒",
                    job.early_stop_reason, len(audio) / sample_rate, keep / sample_rate)
        audio = audio[:keep]
        job.outcome = "提前中斷"
    else:
        job.outcome = "完成"
    audio_seconds = len(audio) / sample_rate
    job.result_audio_seconds = audio_seconds
    job.responded = True
    return Response(
        content=encode_wav(audio, sample_rate),
        media_type="audio/wav",
        headers={
            "X-Elapsed-Seconds": f"{job.elapsed:.3f}",
            "X-Audio-Seconds": f"{audio_seconds:.3f}",
            "X-Request-Id": job.request_id,
            "X-Early-Stop": "true" if job.early_stop else "false",
            "X-Chunks": str(len(job.segments)),  # 與 record() 寫入 /v1/tts/last 的 chunks 同值
        },
    )


async def _stream_body(request: Request, job: Generation, first: Chunk | None) -> AsyncIterator[bytes]:
    """串流：逐段送出 s16le。偵測到提前中斷就正常結束串流（已送出的靜音收不回來，不為裁切而延遲送出）。"""
    try:
        if first is not None:
            yield to_s16le(first.audio)
            job.result_audio_seconds += len(first.audio) / first.sample_rate
            while not job.early_stop:
                if await request.is_disconnected():
                    job.outcome = "斷線"
                    job.mark_end()
                    logger.info("用戶端已斷線（串流），停止取段；已產生 %.2f 秒音訊", job.audio_seconds)
                    return
                chunk = await job.next()
                if chunk is None:
                    break
                if job.early_stop:
                    break  # 觸發的這段是尾端靜音，不再送出
                yield to_s16le(chunk.audio)
                job.result_audio_seconds += len(chunk.audio) / chunk.sample_rate
        job.mark_end()
        if job.early_stop:
            job.outcome = "提前中斷"
            logger.info("偵測到提前中斷（串流，規則=%s）：結束串流，已送出 %.2f 秒",
                        job.early_stop_reason, job.result_audio_seconds)
        else:
            job.outcome = "完成"
    except anyio.get_cancelled_exc_class():
        job.outcome = "斷線"
        job.mark_end()
        logger.info("用戶端已斷線（串流被取消），等當前一段結束後釋放鎖；已產生 %.2f 秒音訊",
                    job.audio_seconds)
        raise
    except Exception as exc:
        # 串流已開始，無法再回 500：記 log 後拋出，uvicorn 會直接關閉連線（用戶端收到不完整的 chunked 回應）
        job.outcome = "失敗"
        job.mark_end()
        logger.exception("產生失敗（串流進行中，中止連線）")
        raise ClientGone(f"產生失敗：{exc}") from exc
    finally:
        await job.finalize()


@router.get("/v1/tts/last")
async def tts_last(request: Request) -> dict:
    """最近一次（回過 200 的）產生結果。不碰鎖。"""
    record = request.app.state.manager.last_generation
    if record is None:
        raise ApiError(404, "no_generation_yet", "尚未有任何產生紀錄")
    return record
