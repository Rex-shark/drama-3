"""提前中斷偵測（純 numpy，不 import mlx；MOCK 與真模型共用，可直接回放 WAV 測試）。

規則（spec/api-conventions.md「提前中斷偵測」），以 100 ms 為窗算 RMS（dBFS），兩條並存、先到先觸發：
- 尾端靜音（reason="silence"）：「已出過聲」（任一窗 ≥ −50 dBFS）之後，連續靜音窗累計達 6 秒。
- 開頭無聲（reason="onset"）：產生開始後 6 秒內（前 60 窗）從未有任何窗 > −40 dBFS，
  於第 6 秒那一窗評估完時判定。產生不滿 6 秒就自然結束的不算。
窗跨片段邊界連續計算（片段長度不必是 100 ms 的倍數）；最後不足一窗的尾巴不評估。
"""

import math

import numpy as np

from .settings import (
    EARLY_STOP_KEEP_SECONDS,
    EARLY_STOP_ONSET_DBFS,
    EARLY_STOP_SILENCE_DBFS,
    EARLY_STOP_SILENCE_SECONDS,
    EARLY_STOP_WINDOW_SECONDS,
)

REASON_SILENCE = "silence"  # 出聲後連續靜音
REASON_ONSET = "onset"  # 開頭 6 秒內從未出聲


def _mean_square(dbfs: float) -> float:
    return (10 ** (dbfs / 20)) ** 2


class EarlyStopDetector:
    def __init__(
        self,
        sample_rate: int,
        *,
        threshold_dbfs: float = EARLY_STOP_SILENCE_DBFS,
        onset_dbfs: float = EARLY_STOP_ONSET_DBFS,
        silence_seconds: float = EARLY_STOP_SILENCE_SECONDS,
        window_seconds: float = EARLY_STOP_WINDOW_SECONDS,
        keep_seconds: float = EARLY_STOP_KEEP_SECONDS,
    ) -> None:
        self.sample_rate = sample_rate
        self.window = max(1, int(round(window_seconds * sample_rate)))
        # RMS 門檻換成均方值比較，省掉每窗的 log
        self._mean_square_threshold = _mean_square(threshold_dbfs)
        self._onset_mean_square = _mean_square(onset_dbfs)
        # 兩條規則共用同一個秒數（settings 的 6 秒）
        self._silent_windows_needed = max(1, math.ceil(silence_seconds / window_seconds - 1e-9))
        self._onset_windows = self._silent_windows_needed
        self._keep_samples = int(round(keep_seconds * sample_rate))
        self._pending = np.zeros(0, dtype=np.float32)
        self.evaluated = 0  # 已評估的樣本數（整窗）
        self.windows = 0  # 已評估的窗數
        self.voiced_seen = False  # 尾端靜音規則用：任一窗 ≥ −50 dBFS
        self.onset_seen = False  # 開頭無聲規則用：任一窗 > −40 dBFS
        self.last_voiced_end = 0  # 最後一個有聲窗（≥ −50 dBFS）的結束樣本位置
        self._silent_run = 0  # 目前連續靜音窗數（只在出過聲之後累計）
        self.triggered = False
        self.reason: str | None = None  # REASON_SILENCE / REASON_ONSET / None
        self.triggered_at = 0  # 觸發時已評估到的樣本位置

    def feed(self, audio: np.ndarray) -> bool:
        """餵入一段音訊；回傳是否（此時或之前）已判定提前中斷。"""
        if self.triggered or audio.size == 0:
            return self.triggered
        data = np.concatenate([self._pending, audio.astype(np.float32, copy=False)])
        n = data.size // self.window
        if n:
            frames = data[: n * self.window].reshape(n, self.window).astype(np.float64)
            mean_square = np.mean(frames * frames, axis=1)
            for i, ms in enumerate(mean_square):
                end = self.evaluated + (i + 1) * self.window
                self.windows += 1
                if ms > self._onset_mean_square:
                    self.onset_seen = True
                if ms >= self._mean_square_threshold:
                    self.voiced_seen = True
                    self.last_voiced_end = end
                    self._silent_run = 0
                elif self.voiced_seen:
                    self._silent_run += 1
                    if self._silent_run >= self._silent_windows_needed:
                        self._trigger(REASON_SILENCE, end)
                        break
                if self.windows == self._onset_windows and not self.onset_seen:
                    self._trigger(REASON_ONSET, end)
                    break
            self.evaluated += n * self.window
        self._pending = data[n * self.window :]
        return self.triggered

    def _trigger(self, reason: str, at: int) -> None:
        self.triggered = True
        self.reason = reason
        self.triggered_at = at

    def keep_samples(self, total: int) -> int:
        """提前中斷時非串流要保留的樣本數（不超過總長）。

        - 尾端靜音：最後有聲點（≥ −50 dBFS）之後再留 0.5 秒。
        - 開頭無聲：整段都判定「從未出聲」，沒有可保留的有聲點，只回開頭 0.5 秒。
        """
        if self.reason == REASON_ONSET:
            return min(total, self._keep_samples)
        return min(total, self.last_voiced_end + self._keep_samples)
