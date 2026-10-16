"""MOCK 後端：不 import mlx_audio，產生每個角色不同音高的正弦波。

只替換「產生音訊」這一層；鎖、驗證、暫存檔、斷線處理與真模型共用同一套程式。
所有方法同樣在 MLX 專屬執行緒上執行，用 time.sleep 模擬生成耗時，
所以「斷線後要等當前一段跑完才釋放鎖」的行為與真模型一致。
"""

import logging
import math
import re
import time
from typing import Iterator

import numpy as np

from .audio import Chunk, GenerateRequest
from .settings import DEFAULT_SAMPLE_RATE
from .variants import Variant

logger = logging.getLogger("drama3.mock")

LOAD_SECONDS = 2.0  # 模擬載入耗時，讓前端能看到「切換中」
CHUNK_SECONDS = 0.3  # spec：每 0.3 秒吐一段（串流與非串流皆同）
SECONDS_PER_CHAR = 0.15  # spec：長度約字數 × 0.15 秒
AMPLITUDE = 0.25
# spec 第 4 節：文字含此標記時模擬 8bit 提前中斷——正常出聲 1 秒後轉成約 −60 dBFS 的小雜訊
# （不是全零，同真模型），拖到 max_tokens 的長度；由後端的偵測規則自然觸發停止。
EARLY_STOP_MARK = "[mock:early-stop]"
EARLY_STOP_VOICED_SECONDS = 1.0
EARLY_STOP_NOISE_DBFS = -60.0
# 文字含此標記時模擬全程無聲：從頭就是約 −60 dBFS 小雜訊（同樣不是全零），拖到 max_tokens 的長度；
# 由開頭無聲規則在第 6 秒觸發（非串流只回開頭 0.5 秒）。
SILENT_MARK = "[mock:silent]"
FRAME_SECONDS = 2048 / 44100  # 1 frame ≈ 46.4 ms，與真模型相同，用來換算 max_tokens 的長度
SEGMENT_BYTES = 300  # 模擬 mlx-audio 的自動分段：約每 300 UTF-8 bytes 一段

_SPEAKER_TAG = re.compile(r"<\|speaker:([0-9]+)\|>")
# 計算字數時去掉標記：<|...|>、[tag]、<tag> / </tag>
_MARKUP = re.compile(r"<\|[^|>]*\|>|\[[^\[\]]*\]|</?[A-Za-z][\w-]*[^>]*>")


def speaker_frequency(speaker: int) -> float:
    """每個角色不同音高：220 Hz 起，每號升一個全音（2 個半音）。"""
    return 220.0 * 2 ** (speaker * 2 / 12)


def speaker_segments(text: str) -> list[tuple[int, int]]:
    """把文字拆成 (角色, 字數)；第一個標籤前的文字算 speaker 0（同 mlx-audio）。"""
    parts = _SPEAKER_TAG.split(text)
    segments: list[tuple[int, int]] = []
    pairs = [(0, parts[0])] + [(int(parts[i]), parts[i + 1]) for i in range(1, len(parts), 2)]
    for speaker, body in pairs:
        visible = _MARKUP.sub("", body)
        count = sum(1 for ch in visible if not ch.isspace())
        if count:
            segments.append((speaker, count))
    return segments


def segment_count(text: str) -> int:
    """模擬的自動分段數：每 300 UTF-8 bytes 一段（標記不計），至少 1。"""
    size = len(text.replace(EARLY_STOP_MARK, "").replace(SILENT_MARK, "").encode("utf-8"))
    return max(1, math.ceil(size / SEGMENT_BYTES))


def synthesize_early_stop(text: str, max_tokens: int, sample_rate: int = DEFAULT_SAMPLE_RATE) -> np.ndarray:
    """1 秒正常聲音（第一個角色的音高）＋ −60 dBFS 雜訊，總長＝max_tokens frames。"""
    segments = speaker_segments(text)
    speaker = segments[0][0] if segments else 0
    n_voice = int(EARLY_STOP_VOICED_SECONDS * sample_rate)
    t = np.arange(n_voice, dtype=np.float32) / sample_rate
    voice = AMPLITUDE * np.sin(2 * np.pi * speaker_frequency(speaker) * t)
    fade = int(0.01 * sample_rate)
    ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)
    voice[:fade] *= ramp
    voice[-fade:] *= ramp[::-1]
    total = max(n_voice, int(max_tokens * FRAME_SECONDS * sample_rate))
    rng = np.random.default_rng()
    noise = rng.normal(0.0, 10 ** (EARLY_STOP_NOISE_DBFS / 20), total - n_voice)
    return np.concatenate([voice, noise.astype(np.float32)])


def synthesize_silent(max_tokens: int, sample_rate: int = DEFAULT_SAMPLE_RATE) -> np.ndarray:
    """全程 −60 dBFS 雜訊，總長＝max_tokens frames（真模型從頭沒出聲時同樣會拖到上限）。"""
    total = max(1, int(max_tokens * FRAME_SECONDS * sample_rate))
    rng = np.random.default_rng()
    return rng.normal(0.0, 10 ** (EARLY_STOP_NOISE_DBFS / 20), total).astype(np.float32)


def synthesize(text: str, sample_rate: int = DEFAULT_SAMPLE_RATE) -> np.ndarray:
    pieces = []
    for speaker, count in speaker_segments(text):
        n = int(round(count * SECONDS_PER_CHAR * sample_rate))
        t = np.arange(n, dtype=np.float32) / sample_rate
        tone = AMPLITUDE * np.sin(2 * np.pi * speaker_frequency(speaker) * t)
        fade = min(n // 2, int(0.01 * sample_rate))  # 10 ms 淡入淡出，避免爆音
        if fade:
            ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)
            tone[:fade] *= ramp
            tone[-fade:] *= ramp[::-1]
        pieces.append(tone.astype(np.float32))
        pieces.append(np.zeros(int(0.1 * sample_rate), dtype=np.float32))  # 角色間 0.1 秒靜音
    if not pieces:
        return np.zeros(int(CHUNK_SECONDS * sample_rate), dtype=np.float32)
    return np.concatenate(pieces)


class MockModel:
    def __init__(self, variant: Variant) -> None:
        self.variant = variant
        self.sample_rate = DEFAULT_SAMPLE_RATE


class MockBackend:
    mock = True

    def is_available(self, variant: Variant) -> tuple[bool, str]:
        return True, ""  # spec：MOCK 下三版本皆 available

    def load(self, variant: Variant) -> MockModel:
        time.sleep(LOAD_SECONDS)
        return MockModel(variant)

    def unload(self, holder: list) -> None:
        holder.clear()

    def start(self, model: object, req: GenerateRequest) -> Iterator[Chunk]:
        assert isinstance(model, MockModel)
        return self._generate(model, req)

    @staticmethod
    def _generate(model: MockModel, req: GenerateRequest) -> Iterator[Chunk]:
        sr = model.sample_rate
        if SILENT_MARK in req.text:
            audio = synthesize_silent(req.max_tokens, sr)
            segments = 1  # 同提前中斷：整串都卡在第一個分段
        elif EARLY_STOP_MARK in req.text:
            audio = synthesize_early_stop(req.text, req.max_tokens, sr)
            # 中斷時整串都屬於第一個分段（真模型也是卡在某一段裡）
            segments = 1
        else:
            audio = synthesize(req.text, sr)
            segments = segment_count(req.text)
        step = int(CHUNK_SECONDS * sr)
        total_chunks = max(1, math.ceil(len(audio) / step))
        for i, begin in enumerate(range(0, len(audio), step)):
            time.sleep(CHUNK_SECONDS)  # 模擬一段的生成時間（同步、不可中斷，同真模型）
            segment = min(segments - 1, i * segments // total_chunks)
            yield Chunk(audio=audio[begin : begin + step], sample_rate=sr, segment=segment)

    def next_chunk(self, gen: Iterator[Chunk]) -> Chunk | None:
        return next(gen, None)

    def close(self, gen: Iterator[Chunk]) -> None:
        close = getattr(gen, "close", None)
        if close is not None:
            close()
