"""產生請求的驗證：文字、取樣參數、參考音檔。

全部在回 200 之前做完（mlx-audio 的錯誤要到第一次 next() 才拋，串流一旦開始就無法回 400）。
本檔不 import mlx_audio（MOCK 模式也要能用），文字規則自行實作，
對齊 mlx_audio/tts/models/fish_drama3/chunking.py 的 validate_text（筆記第 5 節）。
"""

import io
import math
import re
import wave

from .errors import ApiError
from .settings import MAX_REF_SECONDS, MAX_SPEAKER_ID

# 呼叫端文字不可含的結構 token（只能由 prompt builder 寫入）。
STRUCTURAL_TOKENS = (
    "<|im_start|>",
    "<|im_end|>",
    "<|voice|>",
    "<|text|>",
    "<|interleave|>",
    "<|semantic:",
)
SPEAKER_TAG = re.compile(r"<\|speaker:([0-9]+)\|>")
# Unicode White_Space（與 chunking.WHITE_SPACE 相同；str.strip() 會多剝 U+001C..U+001F）。
WHITE_SPACE = "".join(
    map(
        chr,
        [*range(0x9, 0xE), 0x20, 0x85, 0xA0, 0x1680, *range(0x2000, 0x200B)]
        + [0x2028, 0x2029, 0x202F, 0x205F, 0x3000],
    )
)


def text_problem(text: str, label: str) -> str | None:
    """回傳文字的問題說明；沒問題回 None。規則同 chunking.validate_text。"""
    if not text.strip(WHITE_SPACE):
        return f"{label}是空的"
    for token in STRUCTURAL_TOKENS:
        if token in text:
            return f"{label}不可包含結構 token {token}"
    for start in (m.start() for m in re.finditer(r"<\|speaker", text)):
        tag = SPEAKER_TAG.match(text, start)
        number = tag.group(1) if tag else ""
        if not number or number != str(int(number)) or int(number) > MAX_SPEAKER_ID:
            snippet = text[start : start + 16]
            return (
                f"{label}的角色標籤格式錯誤（{snippet}…）：只接受 <|speaker:0|> 到 "
                f"<|speaker:{MAX_SPEAKER_ID}|>，編號不可有前導 0"
            )
    return None


def validate_text(text: str) -> None:
    problem = text_problem(text, "text ")
    if problem:
        raise ApiError(400, "invalid_text", problem)


def validate_ref_text(ref_text: str, index: int) -> None:
    label = f"ref_text[{index}] "
    problem = text_problem(ref_text, label)
    if problem:
        raise ApiError(400, "invalid_text", problem)
    # spec：ref_text 不含角色標籤，由 ref_speaker 指定、後端補前綴。
    # 自帶標籤一律拒收，避免與 ref_speaker 衝突或變成 <|speaker:1|> <|speaker:0|> …
    if SPEAKER_TAG.search(ref_text):
        raise ApiError(
            400,
            "invalid_text",
            f"{label}不可包含角色標籤 <|speaker:N|>；角色請用 ref_speaker 指定",
        )


def parse_speaker(raw: str, index: int) -> int:
    value = raw.strip()
    if not re.fullmatch(r"[0-9]+", value) or int(value) > MAX_SPEAKER_ID:
        raise ApiError(
            400,
            "invalid_text",
            f"ref_speaker[{index}] 必須是 0 到 {MAX_SPEAKER_ID} 的整數，收到：{raw!r}",
        )
    return int(value)


# ---------- 取樣參數 ----------


def _invalid_param(name: str, raw: str, rule: str) -> ApiError:
    return ApiError(422, "invalid_request", f"{name} {rule}，收到：{raw!r}")


def parse_float(name: str, raw: str | None, *, low: float, high: float | None,
                low_inclusive: bool) -> float | None:
    """未給（或空字串）回 None，由呼叫端套用版本預設。"""
    if raw is None or raw.strip() == "":
        return None
    try:
        value = float(raw)
    except ValueError:
        raise _invalid_param(name, raw, "必須是數字") from None
    ok = math.isfinite(value) and (value >= low if low_inclusive else value > low)
    if high is not None:
        ok = ok and value <= high
    if not ok:
        rng = f"{'≥' if low_inclusive else '>'} {low}" + (f" 且 ≤ {high}" if high is not None else "")
        raise _invalid_param(name, raw, f"必須 {rng}")
    return value


def parse_int(name: str, raw: str | None, *, low: int) -> int | None:
    """未給（或空字串）回 None，由呼叫端套用預設。"""
    if raw is None or raw.strip() == "":
        return None
    value = raw.strip()
    if not re.fullmatch(r"-?[0-9]+", value):
        raise _invalid_param(name, raw, "必須是整數")
    if int(value) < low:
        raise _invalid_param(name, raw, f"必須 ≥ {low}")
    return int(value)


def parse_bool(name: str, raw: str | None) -> bool:
    """只接受 true / false（不分大小寫）；未提供預設 false。1、yes、on、空字串都拒收。"""
    if raw is None:
        return False
    value = raw.strip().lower()
    if value == "true":
        return True
    if value == "false":
        return False
    raise _invalid_param(name, raw, "只接受 true 或 false")


# ---------- 參考音檔 ----------


def check_reference_wav(data: bytes, index: int, filename: str | None) -> float:
    """解碼參考音檔，回傳秒數；壞檔 → 400 reference_decode_failed，> 60 秒 → 400 reference_too_long。

    優先用 miniaudio（mlx-audio 讀 .wav 用的就是它，能解＝mlx-audio 能讀）；
    miniaudio 不存在時（例如 MOCK 環境沒裝 mlx-audio）退回 stdlib wave。
    暫存檔一律存 .wav，mlx-audio 依副檔名判斷格式，所以這裡只接受 WAV。
    """
    name = filename or f"ref_audio[{index}]"
    if not data:
        raise ApiError(400, "reference_decode_failed", f"ref_audio[{index}]（{name}）是空檔")
    try:
        frames, sample_rate = _decode_wav(data)
    except Exception as exc:  # noqa: BLE001 解碼器丟的例外型別很多，一律視為壞檔
        raise ApiError(
            400, "reference_decode_failed", f"ref_audio[{index}]（{name}）無法解碼為 WAV：{exc}"
        ) from None
    if frames <= 0 or sample_rate <= 0:
        raise ApiError(400, "reference_decode_failed", f"ref_audio[{index}]（{name}）沒有音訊內容")
    seconds = frames / sample_rate
    if seconds > MAX_REF_SECONDS:
        raise ApiError(
            400,
            "reference_too_long",
            f"ref_audio[{index}]（{name}）長 {seconds:.1f} 秒，超過上限 {MAX_REF_SECONDS:.0f} 秒",
        )
    return seconds


def _decode_wav(data: bytes) -> tuple[int, int]:
    try:
        import miniaudio
    except ImportError:
        miniaudio = None
    if miniaudio is not None:
        # 完整解碼一次（不只讀 header），截斷或內容損壞也擋得下
        decoded = miniaudio.wav_read_s16(data)
        return decoded.num_frames, decoded.sample_rate
    with wave.open(io.BytesIO(data), "rb") as wav:
        frames = wav.getnframes()
        payload = wav.readframes(frames)
        expected = frames * wav.getsampwidth() * wav.getnchannels()
        if len(payload) < expected:
            raise ValueError("資料長度不足（檔案可能被截斷）")
        return frames, wav.getframerate()
