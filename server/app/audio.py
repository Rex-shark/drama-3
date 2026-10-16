"""產生層共用型別與音訊編碼（不 import mlx）。"""

import io
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Protocol

import numpy as np

from .variants import Variant


@dataclass(frozen=True)
class GenerateRequest:
    text: str
    ref_audio_paths: list[Path]  # 暫存 .wav 路徑；空串列＝無參考音檔
    ref_texts: list[str]  # 已補 <|speaker:N|> 前綴
    temperature: float
    top_p: float
    top_k: int
    max_tokens: int
    stream: bool  # 使用者要的回應形式；內部一律逐段取


@dataclass(frozen=True)
class Chunk:
    audio: np.ndarray  # 1D float32，-1..1
    sample_rate: int
    segment: int | None = None  # 自動分段索引（mlx-audio 的 result.segment_idx）


class Backend(Protocol):
    """產生音訊的那一層。以下方法都是同步函式，一律在 MLX 專屬執行緒上呼叫。"""

    mock: bool

    def is_available(self, variant: Variant) -> tuple[bool, str]: ...

    def load(self, variant: Variant) -> object: ...

    def unload(self, holder: list) -> None: ...

    def start(self, model: object, req: GenerateRequest) -> Iterator: ...

    def next_chunk(self, gen: Iterator) -> Chunk | None: ...

    def close(self, gen: Iterator) -> None:
        """關閉產生器並回收記憶體（真模型：gen.close 後 mx.clear_cache）。"""
        ...


def to_s16le(audio: np.ndarray) -> bytes:
    clipped = np.clip(audio.astype(np.float32, copy=False), -1.0, 1.0)
    return (clipped * 32767.0).astype("<i2").tobytes()


def encode_wav(audio: np.ndarray, sample_rate: int) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(to_s16le(audio))
    return buf.getvalue()
