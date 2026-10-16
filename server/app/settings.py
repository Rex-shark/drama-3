"""執行期設定與路徑。路徑一律由本檔位置推算，不依賴目前工作目錄。"""

import os
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent  # drama-3/server
PROJECT_ROOT = SERVER_DIR.parent  # drama-3
MODELS_DIR = PROJECT_ROOT / "models"  # 各版本資料夾 models/drama-3-<id>/
# 參考音檔暫存（回應結束即刪）。每個後端行程用自己的 tmp/<pid>/ 子目錄，
# 多個行程（例：8793 與 8794）同時跑時，啟動 / 關閉只清自己的，不會刪到別人產生中的檔。
TMP_ROOT = SERVER_DIR / "tmp"
TMP_DIR = TMP_ROOT / str(os.getpid())

# MOCK=1：完全不 import mlx_audio，回傳假音訊，供前端開發。
MOCK = os.environ.get("MOCK", "").strip().lower() in {"1", "true", "yes", "on"}

# 參考音檔上限（秒）。mlx-audio 本身沒有上限，這是本專案自訂。
MAX_REF_SECONDS = 60.0
# 角色編號範圍（tokenizer 只有 <|speaker:0|> ～ <|speaker:15|>）。
MAX_SPEAKER_ID = 15
# 每個自動分段的最大 frame 數；mlx-audio 預設也是 1024（約 47.5 秒）。
DEFAULT_MAX_TOKENS = 1024
# 內部一律以 stream=True 逐段取；串流與非串流都用 mlx-audio 預設 0.32 秒一段，
# 斷線後最差延遲約一段（約 0.3 秒音訊的生成時間）。
STREAMING_INTERVAL = 0.32
# 串流首段 frame 數（1 frame ≈ 46.4 ms），小值讓首段音訊更快出來。
STREAM_FIRST_CHUNK_FRAMES = 4
# 預設取樣率；實際以 mlx-audio 回傳的 sample_rate 為準。
DEFAULT_SAMPLE_RATE = 44100

# ---- 提前中斷偵測（8bit 已知弱點：講 1–3 秒後轉成極小雜訊的靜音，拖到 max_tokens） ----
# 依 2026-10-15 的 25 個 8bit 樣本定：正常檔連續 < −50 dBFS 最長 1.93 秒，中斷檔 19–46 秒。
# 2026-10-15 由 4 秒改 6 秒：第二批 12 檔正常句非尾端停頓已到 3.7 秒，中斷尾巴仍 ≥ 19 秒。
# 尾巴不是全零（極小雜訊），所以用 dBFS 判斷，不用「全零」。
EARLY_STOP_WINDOW_SECONDS = 0.1  # 以 100 ms 為單位算 RMS
EARLY_STOP_SILENCE_DBFS = -50.0  # 低於此值（RMS dBFS）視為靜音
EARLY_STOP_SILENCE_SECONDS = 6.0  # 已出過聲之後，連續靜音達此秒數即判定提前中斷；開頭無聲規則也共用此秒數
# 開頭無聲規則：產生開始後 EARLY_STOP_SILENCE_SECONDS 秒內，若從未有任何 100 ms 窗 RMS 高於此值，
# 判定提前中斷（抓「從頭到尾沒出聲」與「開頭就很小聲的雜訊」兩種失敗）。
# 2026-10-15 依 61 個樣本定：正常檔開頭最安靜 −31.9 dBFS，失敗檔 −42 以下；−35 只剩 3 dB 餘裕會誤判耳語開頭。
EARLY_STOP_ONSET_DBFS = -40.0
EARLY_STOP_KEEP_SECONDS = 0.5  # 非串流裁尾時，保留最後有聲點之後的秒數
