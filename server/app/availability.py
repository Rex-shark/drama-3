"""判定某版本的模型資料夾是否「下載完成、可載入」。純函式，不 import mlx。

規則（2026-10-15 規劃端拍板）：
A. 主要依據：hf download 在 <資料夾>/.cache/huggingface/trees/<rev>.json 存 repo 檔案清單
   {"format_version":1,"files":{"<檔名>":{"size":<bytes>,...}}}。清單存在時（多個取修改時間
   最新者），只比對「載入必要」的檔：config.json、tokenizer.json、清單內所有 *.safetensors
   （含 codec.safetensors 與每個 model-*.safetensors），都要存在且大小與清單相符。
   README.md、LICENSE、NOTICE、.gitattributes、chat_template.jinja、tokenizer_config.json、
   special_tokens_map.json 缺了不影響（2026-10-16 CR-5）。
   依據（mlx-audio 鎖定 commit，只讀確認）：utils.base_load_model 讀 config.json、
   load_weights 以 glob 讀資料夾內所有 *.safetensors；fish_drama3 的 post_load_hook 只讀
   tokenizer.json（tokenizers.Tokenizer.from_file），codec 由 FishS1DAC.from_pretrained 讀
   config.json 與 codec.safetensors。tokenizer_config.json / special_tokens_map.json /
   chat_template.jinja 只在 fish_drama3/convert.py（轉檔時複製）出現，載入不讀。
B. 清單不存在時的後備：config.json、codec.safetensors、tokenizer.json 存在，且至少一個
   model-NNNNN.safetensors、編號從 00001 起連續不中斷。
C. 不論 A 或 B：<資料夾>/.cache/huggingface/download/ 底下有任何 *.incomplete 就不可用。
hf 下載中先寫 .incomplete，完成才改名成正式檔名，所以正式檔名存在＝該檔完整。
"""

import json
import re
from dataclasses import dataclass
from pathlib import Path

REQUIRED_FILES = ("config.json", "codec.safetensors", "tokenizer.json")
_SHARD = re.compile(r"^model-(\d{5})\.safetensors$")


@dataclass(frozen=True)
class Availability:
    available: bool
    reason: str  # 不可用時的說明（繁中）；可用時為空字串


def _latest_tree_manifest(folder: Path) -> Path | None:
    trees = folder / ".cache" / "huggingface" / "trees"
    if not trees.is_dir():
        return None
    candidates = [p for p in trees.glob("*.json") if p.is_file()]
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


def check_model_folder(folder: Path) -> Availability:
    """回傳該資料夾是否為完整可載入的模型。每次呼叫都重新讀檔，不快取。"""
    if not folder.is_dir():
        return Availability(False, "尚未下載")

    download_dir = folder / ".cache" / "huggingface" / "download"
    if download_dir.is_dir() and any(download_dir.rglob("*.incomplete")):
        return Availability(False, "尚未下載完成（仍有下載中的檔案）")

    manifest = _latest_tree_manifest(folder)
    if manifest is not None:
        try:
            files = json.loads(manifest.read_text(encoding="utf-8"))["files"]
            expected = {name: int(meta["size"]) for name, meta in files.items()}
        except (OSError, ValueError, KeyError, TypeError) as exc:
            return Availability(False, f"尚未下載完成（檔案清單無法解析：{exc}）")
        # 載入必要檔：清單內的必需檔與所有 *.safetensors（loader 會 glob 全部載入）
        needed = sorted(
            name for name in expected if name in REQUIRED_FILES or name.endswith(".safetensors")
        )
        for name in needed:
            path = folder / name
            if not path.is_file():
                return Availability(False, f"尚未下載完成（缺少 {name}）")
            actual = path.stat().st_size
            if actual != expected[name]:
                return Availability(
                    False, f"尚未下載完成（{name} 大小 {actual}，應為 {expected[name]}）"
                )
        # 必需檔不在清單裡（理論上不會）也要存在
        for name in REQUIRED_FILES:
            if not (folder / name).is_file():
                return Availability(False, f"尚未下載完成（缺少 {name}）")
        if not any(_SHARD.match(name) for name in needed):
            return Availability(False, "尚未下載完成（檔案清單裡沒有任何 model-*.safetensors）")
        return Availability(True, "")

    # 後備規則 B
    for name in REQUIRED_FILES:
        if not (folder / name).is_file():
            return Availability(False, f"尚未下載完成（缺少 {name}）")
    numbers = sorted(
        int(m.group(1)) for p in folder.iterdir() if p.is_file() and (m := _SHARD.match(p.name))
    )
    if not numbers:
        return Availability(False, "尚未下載完成（沒有任何 model-*.safetensors）")
    if numbers != list(range(1, len(numbers) + 1)):
        missing = sorted(set(range(1, numbers[-1] + 1)) - set(numbers))
        first = missing[0] if missing else 1
        return Availability(False, f"尚未下載完成（缺少 model-{first:05d}.safetensors）")
    return Availability(True, "")
