"""三個模型版本的常數表。數字與 spec/model-capabilities.md 第一節一致（記憶體為 2026-10-15 Phase 2 實測）。"""

from dataclasses import dataclass
from pathlib import Path

from .settings import MODELS_DIR


@dataclass(frozen=True)
class SamplingDefaults:
    temperature: float
    top_p: float
    top_k: int

    def as_dict(self) -> dict:
        return {"temperature": self.temperature, "top_p": self.top_p, "top_k": self.top_k}


@dataclass(frozen=True)
class Variant:
    id: str
    name: str
    repo: str
    disk_gb: int
    peak_memory_gb: int  # 行程峰值（含產生中的 MLX 快取），評估能不能跑看這個
    active_memory_gb: int  # MLX active 峰值（不含快取）
    defaults: SamplingDefaults

    @property
    def folder(self) -> Path:
        # 資料夾名稱不要改：mlx-audio 會拿名稱片段比對模型類型（見筆記第 1 節「資料夾命名陷阱」）。
        return MODELS_DIR / f"drama-3-{self.id}"


VARIANTS: dict[str, Variant] = {
    v.id: v
    for v in (
        Variant(
            id="4bit",
            name="4-bit（最省記憶體）",
            repo="mlx-community/fish-audio-drama-3-4bit",
            disk_gb=22,
            peak_memory_gb=55,
            active_memory_gb=27,
            defaults=SamplingDefaults(temperature=0.7, top_p=0.7, top_k=30),
        ),
        Variant(
            id="8bit",
            name="8-bit（建議）",
            repo="mlx-community/fish-audio-drama-3-8bit",
            disk_gb=42,
            peak_memory_gb=72,
            active_memory_gb=45,
            defaults=SamplingDefaults(temperature=1.0, top_p=0.9, top_k=30),
        ),
        Variant(
            id="bf16",
            name="bf16（原版品質）",
            repo="mlx-community/fish-audio-drama-3-bf16",
            disk_gb=67,
            peak_memory_gb=103,
            active_memory_gb=76,
            defaults=SamplingDefaults(temperature=0.7, top_p=0.7, top_k=30),
        ),
    )
}
