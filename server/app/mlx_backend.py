"""真模型後端：呼叫 mlx-audio 公開 API（load_model、model.generate）。

mlx_audio / mlx 一律在函式內 import，伺服器啟動不 import，第一次載入模型時才 import
（在 MLX 專屬執行緒上），讓非 MOCK 模式也能快速起來。
本檔所有方法都只在 MLX 專屬執行緒上呼叫（見 worker.py）。
"""

import gc
import logging
from typing import Iterator

import numpy as np

from .audio import Chunk, GenerateRequest
from .availability import check_model_folder
from .settings import STREAM_FIRST_CHUNK_FRAMES, STREAMING_INTERVAL
from .variants import Variant

logger = logging.getLogger("drama3.mlx")

EXPECTED_MODEL_TYPE = "fish_drama3"


class MlxBackend:
    mock = False

    def is_available(self, variant: Variant) -> tuple[bool, str]:
        result = check_model_folder(variant.folder)
        return result.available, result.reason

    def load(self, variant: Variant) -> object:
        from mlx_audio.tts.utils import load_model  # 第一次載入時才 import

        model = load_model(variant.folder)  # 傳 Path：完全不碰 HuggingFace hub
        model_type = getattr(model, "model_type", None)
        if model_type != EXPECTED_MODEL_TYPE:
            raise ValueError(f"資料夾不是 Drama 3 模型（model_type={model_type!r}）")
        return model

    def unload(self, holder: list) -> None:
        import mlx.core as mx

        holder.clear()  # 丟掉最後一個對模型的參考（在 MLX 執行緒上釋放）
        gc.collect()
        mx.clear_cache()

    def start(self, model: object, req: GenerateRequest) -> Iterator:
        # 雙保險：再用 mlx-audio 自己的規則驗一次（ValueError → 呼叫端轉 400 invalid_text）
        from mlx_audio.tts.models.fish_drama3.chunking import validate_text

        import mlx.core as mx

        validate_text(req.text, "text")
        for i, ref_text in enumerate(req.ref_texts):
            validate_text(ref_text, f"ref_text[{i}]")

        mx.reset_peak_memory()  # 讓 close 時記的峰值是「這次產生」的峰值

        # 取樣參數永遠明確傳入：mlx-audio 內建預設（0.7/0.7/30）與 8bit 預設不同。
        # 內部一律 stream=True 逐段取（非串流由呼叫端自行累積），段間才能檢查斷線。
        # 建立產生器不會執行任何程式碼；錯誤在第一次 next() 才拋。
        return model.generate(
            req.text,
            ref_audio=[str(p) for p in req.ref_audio_paths] or None,
            ref_text=list(req.ref_texts) or None,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
            top_p=req.top_p,
            top_k=req.top_k,
            stream=True,
            streaming_interval=STREAMING_INTERVAL,
            first_chunk_frames=STREAM_FIRST_CHUNK_FRAMES if req.stream else None,
        )

    def next_chunk(self, gen: Iterator) -> Chunk | None:
        import mlx.core as mx

        result = next(gen, None)
        if result is None:
            return None
        # 在 MLX 執行緒內就轉成 numpy，event loop 端不碰 mx.array
        audio = np.array(result.audio.astype(mx.float32), dtype=np.float32).reshape(-1)
        return Chunk(audio=audio, sample_rate=int(result.sample_rate), segment=int(result.segment_idx))

    def close(self, gen: Iterator) -> None:
        """關閉產生器並回收 MLX 緩衝快取。

        MLX 會保留緩衝快取：8bit 連續請求會從 40 GB 長到 76 GB 不回落。每次產生結束都
        clear_cache（代價是下次產生多一點配置時間）。產生器關閉後它持有的 KV cache 才會釋放，
        所以順序必須是 close → clear_cache，且兩者都在 MLX 執行緒上（同一次 run_mlx）。
        """
        import mlx.core as mx

        close = getattr(gen, "close", None)
        if close is not None:
            close()
        del gen
        gc.collect()
        before = mx.get_cache_memory()
        mx.clear_cache()
        gb = 1e9
        logger.info(
            "MLX 記憶體：active %.2f GB、cache %.2f GB（clear_cache 前 %.2f GB）、本次峰值 %.2f GB",
            mx.get_active_memory() / gb,
            mx.get_cache_memory() / gb,
            before / gb,
            mx.get_peak_memory() / gb,
        )
