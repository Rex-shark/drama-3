# Spec：系統架構

## 一、組成

```
瀏覽器 (Vite :5173)
  角色參考音檔 → AudioContext 解碼 → 編碼 WAV
  劇本行 → 組成含 <|speaker:N|> 與表演標籤的純文字
        │  POST /api/v1/tts  (multipart: text + ref_audio[] + ref_text[] + ref_speaker[])
        ▼
Vite proxy  /api → http://127.0.0.1:8793  (rewrite 去掉 /api)
        ▼
FastAPI (:8793)
  ├─ ModelManager   載入 / 卸載 mlx-audio 模型（一次一個，asyncio lock）
  ├─ /v1/tts        整理參考音檔 → model.generate(...) → WAV 或 PCM 串流
  └─ MOCK=1         不載模型，回傳假音訊，供前端開發
        ▼
mlx-audio (fish_drama3)  →  MLX / Metal  →  models/drama-3-<variant>/
```

| 元件 | 說明 | 位置 |
|------|------|------|
| 前端工作台 | 角色、劇本、產生、播放、版本切換 | `frontend/src/` |
| 後端服務 | FastAPI，封裝 mlx-audio 公開 API | `server/app/` |
| 模型管理 | 掃描 `models/` 得可用版本；載入 / 卸載 | `server/app/models.py` |
| 模型權重 | 三個量化版本各一資料夾 | `models/drama-3-{4bit,8bit,bf16}/` |
| 下載腳本 | 指定版本才抓，Rex 手動執行 | `models/download.sh` |
| Dev Proxy | Vite 轉發 `/api` → 後端；目標埠可用環境變數 `DRAMA3_API_PORT` 覆寫（預設 8793），真模型驗證與 MOCK 開發並行時 MOCK 用 8794 | `frontend/vite.config.js` |

## 二、關鍵設計決策

| 決策 | 原因 |
|------|------|
| 自寫 FastAPI 而非用 mlx-audio 內建 server | 內建 `/v1/audio/speech` 只收一段參考音檔，且 `ref_audio` 必須是伺服器端路徑，無法上傳、無法多角色 |
| 只呼叫 mlx-audio 公開函式（`load_model`、`model.generate`） | 不改第三方碼；它更新時只需重跑 `uv sync` |
| 參考音檔用 multipart 上傳，後端存暫存檔 `server/tmp/<pid>/` 再傳路徑給 mlx-audio；每個行程只清自己的子目錄與已死行程的殘留 | 與 whisper-cpp 相同模式；mlx-audio 用路徑載入最穩 |
| 前端負責把音檔轉成 WAV 再上傳 | 瀏覽器端解碼任何格式，後端不需 ffmpeg |
| speaker 綁定靠逐字稿前綴 `<|speaker:N|>` | mlx-audio 以標籤綁定，不是順序；後端統一補前綴，前端只送角色編號 |
| 一次只載一個模型版本 | 8bit 49 GB + bf16 75 GB 超過 128 GB；切換 = 卸載再載入 |
| **MLX 推理固定在一條常駐執行緒**：`ThreadPoolExecutor(max_workers=1)`，load / 每次取段 / close / unload 全部經它執行 | MLX 的 GPU stream 是每執行緒一份，codec 的串流 buffer 在兩次取段之間留著未求值陣列，換執行緒求值會拋 `There is no Stream(gpu, 0) in current thread`。不能用 `asyncio.to_thread`（它用共用池，執行緒不固定）。上游 mlx-audio server 也是同樣做法 |
| 後端單一 worker + asyncio lock，**busy 時直接回 409，不排隊** | MLX 同一進程共用 GPU，一次只能做一件事；單人工具不需要佇列，排隊反而讓串流與狀態難以預期。前端負責在 busy 時禁用按鈕 |
| 每次產生結束（gen.close 之後）在 MLX 執行緒呼叫 `mx.clear_cache()` | MLX 保留緩衝快取，8bit 連續請求會從 40 GB 長到 76 GB 不回落，三版本切換時有 swap 壓力；代價是下次產生多一點配置時間 |
| 提前中斷偵測在後端取段迴圈做，不改第三方碼 | 8bit 中斷的樣子是轉靜音到撞 max_tokens，白耗約 20 秒；偵測「出聲後連續 4 秒 < −50 dBFS」即停 |
| 串流用 raw PCM s16le 44.1 kHz mono | WAV header 需總長度，串流時未知；前端用 Web Audio 播 PCM |

## 三、資料流：一次產生

1. 前端收集角色清單：每角色 1 到 N 段參考音檔（WAV Blob）與逐字稿。Web Audio 解碼一律重取樣，所以前端先讀檔頭取得原始取樣率（WAV / FLAC / MP3 / M4A），以該取樣率編 WAV；ogg、webm 讀不到時用 48 kHz。
2. 前端把劇本行組成純文字：每行 `<|speaker:N|> ` + 風格前綴 + 台詞，行與行以換行分隔；導演筆記用 `Direction:` / `Line:` 兩行格式。
3. multipart 送出：`text`、重複的 `ref_audio` / `ref_text` / `ref_speaker` 三組等長欄位、取樣參數、`stream`。
4. 後端驗證（角色編號 0–15、參考音檔 ≤ 60 秒、三組欄位等長、已載入模型），逐字稿補 `<|speaker:N|> ` 前綴，存暫存檔。
5. 在常駐推理執行緒呼叫 `model.generate(text, ref_audio=[...], ref_text=[...], temperature, top_p, top_k, max_tokens, stream=True)`。後端**內部一律 `stream=True`** 逐段取，因為非串流模式每個自動分段才 yield 一次，斷線要等一整段；逐段取可把中止縮到約 0.3 秒。
6. 非串流：後端自己累積所有片段 → 編 WAV → 回傳。串流：每個片段轉 s16le 即時寫出。兩者輸出相同。
7. 回應結束後刪暫存檔。

## 四、本機啟動 / 關閉

```bash
# 首次：裝 uv、建 3.12 環境、裝依賴
bash server/setup.sh

# 下載模型（Rex 手動，指定版本）
bash models/download.sh 8bit

# 後端（:8793）；模型未下載時改 MOCK=1 bash server/run-server.sh
bash server/run-server.sh

# 前端（:5173）
cd frontend && npm run dev
```

關閉：各終端 Ctrl+C；背景執行則 `pkill -f "uvicorn app.main"`。完整操作見 `docs/ops.md`（Epic 1 產出）。
