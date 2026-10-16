# drama-3 後端操作筆記

本機 TTS 後端（FastAPI 薄封裝 mlx-audio，跑 Fish Audio Drama 3）的日常操作。

## 基本資訊

| 項目 | 值 |
|------|-----|
| Port | **8793**（只綁 `127.0.0.1`；避開 whisper-cpp 的 8791 / 8792，兩專案可同時跑） |
| 端點 | `GET /v1/health`、`GET /v1/models`、`POST /v1/models/load`、`POST /v1/models/unload`、`POST /v1/tts`、`GET /v1/tts/last` |
| 契約 | [spec/api-conventions.md](../spec/api-conventions.md) |
| 啟動腳本 | `bash server/run-server.sh [port]` |
| 程式 | `server/app/`（`main.py` 進入點） |
| 模型 | `models/drama-3-{4bit,8bit,bf16}/`（手動下載，見 [models/README.md](../models/README.md)） |
| 參考音檔暫存 | `server/tmp/<pid>/ref-*.wav`：每個後端行程用自己的子目錄（多個 port 同時跑互不干擾）。每次回應結束即刪；啟動時清空自己的子目錄並清掉 pid 已不存在的殘留子目錄，關閉時連子目錄一起移除；還活著的行程的子目錄一律不碰 |

> 後端與前端 Vite（:5173）是**兩隻獨立程序**，各自啟動。前端以 `/api/*` 經 proxy 轉到 8793。

---

## 一、開啟

首次使用先建環境（裝 uv、Python 3.12 虛擬環境、依賴；可重複執行）：

```bash
bash server/setup.sh
```

### MOCK 模式（模型未下載、開發前端用）

```bash
MOCK=1 bash server/run-server.sh
```

- 完全不 import mlx-audio，回傳假音訊（每個角色不同音高的正弦波，長度約字數 × 0.15 秒）。
- `/v1/models` 三版本都 `available: true`；載入模擬約 2 秒（期間 `busy_reason: "loading"`、`busy_target` 為正在載入的版本 id）。
- 啟動時**沒有載入任何版本**（`loaded: null`），與真模型模式一致；要先 `load` 才能產生。
- 產生每 0.3 秒吐一段（串流與非串流都是），可用來驗證「中止後 busy 在當前段結束才解除」。
- 文字含 `[mock:early-stop]`（標記不計字數）時模擬 8bit 提前中斷：正常出聲 1 秒後轉成約 −60 dBFS 的小雜訊（不是全零），
  由偵測規則自然觸發，所以約 1 + 6 ≈ 7 秒才結束；非串流回 `X-Early-Stop: true`、`X-Audio-Seconds` 約 1.5 秒。
- 文字含 `[mock:silent]`（標記不計字數）時模擬全程無聲：從頭就是約 −60 dBFS 的小雜訊（不是全零），
  由開頭無聲規則在第 6 秒觸發（log 記 `規則=onset`）；非串流約 6 秒後回 `X-Early-Stop: true`、`X-Audio-Seconds` 約 0.5 秒，
  串流約 6 秒結束，`/v1/tts/last` 的 `early_stop: true`。前端兩種標記都顯示同一句提示。
- 自動分段數（`/v1/tts/last` 的 `chunks`、非串流 header `X-Chunks`）依文字長度模擬：每 300 UTF-8 bytes 一段。
- 鎖、驗證、暫存檔、斷線處理與真模型共用同一套程式，只替換產生音訊那一層。
- MOCK 下只能宣稱「前後端串接通過」，不能宣稱「推理通過」。

### 真模型模式

```bash
bash server/run-server.sh            # 預設 8793
bash server/run-server.sh 9000       # 指定其他 port；前端改用 DRAMA3_API_PORT=9000 npm run dev 指定後端埠（見 frontend/README.md）
```

- 伺服器啟動時**不 import mlx-audio**，約 0.3 秒就起來；第一次 `load` 時才在 MLX 執行緒 import（約 2 秒，算在載入秒數裡）。
- 啟動後**沒有載入任何版本**，要先呼叫 load：

```bash
curl -s http://127.0.0.1:8793/v1/models/load -H 'Content-Type: application/json' -d '{"id":"8bit"}'
#   預期 {"loaded":"8bit","seconds":2.1}；只有下載完成的版本能載入
#   實測熱載入（檔案已在系統快取）：8bit 約 1.4–3.4 秒、bf16 約 8.6–10.3 秒
```

前景執行會佔住終端。丟到背景並留 log：

```bash
nohup bash server/run-server.sh > /tmp/drama3-server.log 2>&1 &
MOCK=1 nohup bash server/run-server.sh > /tmp/drama3-server.log 2>&1 &
tail -f /tmp/drama3-server.log
```

搭配前端（兩個終端）：

```bash
bash server/run-server.sh      # 終端 A：後端 :8793
cd frontend && npm run dev     # 終端 B：前端 :5173 → 開 http://localhost:5173
```

---

## 二、關閉

```bash
# 前景執行中：該終端按 Ctrl + C

# 背景執行：
pkill -f "uvicorn app.main"

# 或先查 PID 再關（見「查詢」）
kill <PID>
```

關閉時會卸下模型（行程結束記憶體即釋放），並移除本行程的暫存子目錄 `server/tmp/<pid>/`（不動其他行程的子目錄）。

---

## 三、查詢

```bash
# 1) 是否在跑？
ps aux | grep "[u]vicorn app.main"

# 2) 8793 埠是誰在監聽？
lsof -nP -iTCP:8793 -sTCP:LISTEN

# 3) 健康與狀態（任何時候都可查，不受忙碌鎖影響）
curl -s http://127.0.0.1:8793/v1/health
#   {"status":"ok","mock":false,"loaded":"8bit","busy":false,"busy_reason":null,"busy_target":null}
#   busy_reason：generating / loading / unloading / null
#   busy_target：busy_reason 為 loading 時是正在載入的版本 id，其餘一律 null
#   切換期間 loaded 為 null（一開始就先卸載舊版本）；顯示「切換中」以 busy_reason / busy_target 為準

# 4) 版本清單（每次都重新檢查 models/ 的下載狀態）
curl -s http://127.0.0.1:8793/v1/models
#   peak_memory_gb：行程峰值（含產生中的 MLX 快取），4bit / 8bit / bf16 = 55 / 72 / 103 GB，評估能不能跑看這個
#   active_memory_gb：MLX active 峰值（不含快取）27 / 45 / 76 GB；產生中快取另長 28–30 GB，產生結束才清

# 5) 卸載目前版本（釋放記憶體）
curl -s -X POST http://127.0.0.1:8793/v1/models/unload

# 6) 產生測試：無參考音檔，非串流 → WAV
curl -s -o /tmp/out.wav -D - http://127.0.0.1:8793/v1/tts \
  --form-string 'text=<|speaker:0|> [疲憊而溫柔] 我們明天再談吧。'
afinfo /tmp/out.wav          # 看取樣率與秒數
#   header：X-Elapsed-Seconds、X-Audio-Seconds（提前中斷時為裁切後長度）、X-Request-Id、X-Early-Stop（true / false）、
#           X-Chunks（自動分段數，與 /v1/tts/last 的 chunks 同值）

# 7) 產生測試：串流 → raw PCM s16le mono（header X-Sample-Rate、X-Request-Id；沒有 X-Chunks，開頭時還不知道，結束後查 7b）
curl -s -N -o /tmp/out.pcm http://127.0.0.1:8793/v1/tts \
  --form-string 'text=<|speaker:0|> 你好。' --form-string 'stream=true'

# 7b) 最近一次產生的結果（串流無法在開頭標 X-Early-Stop，結束後查這個；不受忙碌鎖影響）
curl -s http://127.0.0.1:8793/v1/tts/last
#   {"request_id":"…","early_stop":false,"audio_seconds":4.644,"elapsed_seconds":2.418,"chunks":1}
#   request_id 對應回應 header 的 X-Request-Id；audio_seconds 非串流為裁切後長度、串流為實際送出秒數；
#   chunks 為 mlx-audio 自動分段數（提前中斷時只算已處理的）。尚無紀錄回 404 no_generation_yet。
#   只記「回過 200」的產生：正常完成、提前中斷、串流中途斷線（early_stop=false）都會記；非串流斷線不記。

# 8) 兩角色各一段參考音檔（三組欄位依序對應、數量相同）
curl -s -o /tmp/out2.wav http://127.0.0.1:8793/v1/tts \
  --form-string $'text=<|speaker:0|> 你來了。\n<|speaker:1|> <whisper>別出聲。</whisper>' \
  -F 'ref_audio=@user/http/samples/a.wav' --form-string 'ref_text=甲的逐字稿。' --form-string 'ref_speaker=0' \
  -F 'ref_audio=@user/http/samples/b.wav' --form-string 'ref_text=乙的逐字稿。' --form-string 'ref_speaker=1'

# 9) 看記憶體（含 GPU 統一記憶體；ps 的 RSS 不準，用 footprint 或 top）
PID=$(lsof -tiTCP:8793 -sTCP:LISTEN)
footprint -p $PID | grep phys_footprint
top -l 1 -pid $PID -stats pid,mem
#   8bit 實測（2026-10-15）：載入後 40 GB；每次產生結束都 mx.clear_cache()，連續 12 次產生後仍 40–41 GB；
#   unload 後 278 MB。log 每次產生結束記一行 MLX active / cache / 本次峰值（8bit 峰值約 43.6–44.6 GB）
```

> `/v1/tts` 參數範圍：`temperature` 0 ≤ t ≤ 2、`top_p` 0 < p ≤ 1、`top_k` ≥ 1、`max_tokens` ≥ 1；
> `stream` 只接受 `true` / `false`（不分大小寫，未提供＝false；`1`、`yes`、`on`、空字串都會被拒）。
> 格式或範圍錯誤回 `422 invalid_request`，detail 指出欄位與收到的值。未給的取樣參數用目前載入版本的預設。

> curl 送文字欄位請用 `--form-string`：`-F 'text=<|speaker…'` 會把 `<` 開頭當成「讀檔」而失敗（curl exit 26）。

### log

- 寫到 stdout / stderr；背景執行時看 `nohup` 指定的檔案（例：`/tmp/drama3-server.log`）。
- 會記錄：啟動模式與可用版本、載入 / 卸載秒數、每次產生的參數與 request_id、提前中斷、斷線事件、錯誤 traceback；
  每次產生結束記一行摘要（request_id、結果、分段數、音訊秒數、耗時、是否提前中斷）與一行 MLX 記憶體。
- 範例：
  - `載入完成 8bit，耗時 4.81 秒`
  - `產生結束：request_id=b80d… 結果=提前中斷 非串流 分段數=1 音訊=12.50 秒（模型產生 16.25 秒） 耗時=7.53 秒 提前中斷=是`
  - `MLX 記憶體：active 42.69 GB、cache 0.00 GB（clear_cache 前 1.17 GB）、本次峰值 43.67 GB`
  - `用戶端已斷線（串流被取消），等當前一段結束後釋放鎖`、`已釋放鎖（request_id=…）`

### 提前中斷偵測（8bit 已知弱點）

- **實際症狀**：不是音訊變短，而是講 1–3 秒後轉成**極小雜訊的靜音**（不是全零），一路拖到模型結束或撞 `max_tokens`
  （1024 frames ≈ 47.55 秒），白耗約 20 秒。標籤密集的句子最常見，無參考音檔也會發生。
- **偵測規則**（`server/app/early_stop.py`，閾值在 `server/app/settings.py` 可調）：每 100 ms 算一次 RMS（dBFS），
  兩條規則並存，任一條成立 → 停止取段、關閉產生器、標 `early_stop`：
  1. **尾端靜音**：「已出過聲」（任一窗 ≥ −50 dBFS）之後，連續低於 −50 dBFS 累計達 **6 秒**。
     用 dBFS 而不是「全零」，因為中斷的尾巴是極小雜訊。
  2. **開頭無聲**（2026-10-15 補）：產生開始後 **6 秒**內，從未有任何一窗高於 **−40 dBFS**（`EARLY_STOP_ONSET_DBFS`）
     → 於第 6 秒判定。抓「從頭到尾沒出聲」與「開頭就很小聲的雜訊」，這兩種原本各白耗 20–25 秒。
     秒數與規則 1 共用 `EARLY_STOP_SILENCE_SECONDS`；產生不滿 6 秒就自然結束的不算。
     −40 依 61 個樣本定：正常檔開頭最安靜 −31.9 dBFS（輕柔風格前綴開頭），失敗檔 −42 以下；−35 只剩 3 dB 餘裕、耳語開頭會誤判。
  後端 log 的「提前中斷」行會帶 `規則=silence`（尾端靜音）或 `規則=onset`（開頭無聲）。
- **兩種觸發情況**：①講一半就斷（內容不完整），②講完不停、一路靜音拖到結束（內容其實完整）。
  偵測只看尾端靜音，**分不出這兩種**，所以兩者都會標 `early_stop`；後者裁尾後就是完整結果。
- **前端提示**：看到 `X-Early-Stop: true`（非串流）或 `/v1/tts/last` 的 `early_stop: true`（串流）即顯示
  「偵測到長時間無聲，已自動停止；若內容不完整請重新產生」，由使用者聽過後自行判斷是否重新產生。
- **非串流**：裁掉尾端靜音，保留最後有聲點之後 0.5 秒，回 `X-Early-Stop: true`，`X-Audio-Seconds` 是裁切後長度。
  開頭無聲規則觸發時整段都算「沒出聲」，只回開頭 0.5 秒（`X-Audio-Seconds` 約 0.5）。
- **串流**：已送出的靜音收不回來；偵測到就**正常結束**串流（不是錯誤），結束後查 `GET /v1/tts/last` 看 `early_stop`。
  不會為了裁切而延遲送出，所以聽到的結尾會多約 6 秒靜音（門檻長度）。串流回應沒有 `X-Chunks`（開頭時還不知道），分段數也查 `/v1/tts/last`。
- 觸發後最多多等「6 秒靜音音訊的生成時間」（8bit 約 3 秒），仍比撞 max_tokens 省約 20 秒。
- 門檻 2026-10-15 由 4 秒改 6 秒：`[pause]` 多的正常句非尾端停頓實測已到 3.7 秒，離 4 秒太近；
  中斷的尾巴仍 ≥ 19 秒，6 秒留約 13 秒餘裕。
- 若仍遇到「句中長停頓被誤判」的情形，可在 settings.py 再調高 `EARLY_STOP_SILENCE_SECONDS`；
  耳語或極輕聲開頭被開頭無聲規則誤判時，調低 `EARLY_STOP_ONSET_DBFS`（例如 −45）。
- **已知限制**：**出聲之後**才轉成低音量雜訊（約 −50 到 −34 dBFS，不是靜音）的失敗偵測不到，會一路拖到 `max_tokens`
  （約 47.55 秒，白耗 20–25 秒）；雜訊在 −50 之上所以不算靜音，開頭又已出過聲所以開頭無聲規則也不管。
  開頭 6 秒內就都很小聲（全程 ≤ −40 dBFS）的雜訊則會被開頭無聲規則抓到。遇到時手動停止並重新產生。

### 記憶體回收

- MLX 會保留緩衝快取；只在 unload 才清時，8bit 連續請求會從 40 GB 長到 76 GB 不回落。
- 現在每次產生結束（gen.close 之後，同一條 MLX 執行緒）都呼叫 `mx.clear_cache()`，代價是下次產生多一點配置時間。
- 實測 8bit：載入後 40 GB → 12 次產生後 40–41 GB → unload 後 278 MB。

---

## 四、下載模型

由 Rex 手動執行，後端不會自動下載。詳見 [models/README.md](../models/README.md)。

```bash
nohup bash models/download.sh 8bit > /tmp/drama3-download-8bit.log 2>&1 &
```

後端判定「可載入（available）」的規則（每次查 `/v1/models` 與每次 load 都重新判定）：

1. `models/drama-3-<id>/.cache/huggingface/download/` 底下有任何 `*.incomplete` → 不可用（還在下載）。
2. 有 `.cache/huggingface/trees/<rev>.json`（hf 下載時存的 repo 檔案清單）→ 只比對載入必要的檔：`config.json`、`tokenizer.json`、
   清單內所有 `*.safetensors`（`codec.safetensors` 與每個 `model-*.safetensors`），都存在且大小與清單相符才可用。
   `README.md`、`LICENSE`、`NOTICE`、`.gitattributes`、`chat_template.jinja`、`tokenizer_config.json`、`special_tokens_map.json`
   缺了不影響（mlx-audio 載入 Drama 3 不讀這些檔）。
3. 沒有清單 → `config.json`、`codec.safetensors`、`tokenizer.json` 存在，且 `model-00001.safetensors` 起編號連續不中斷才可用。

下載未完成時 load 回 `404 model_not_available`，detail 會寫缺哪個檔。

---

## 常見狀況

| 症狀 | 原因 / 處理 |
|------|------------|
| 前端 proxy 502 / curl 連不上 | 後端沒開 → `bash server/run-server.sh`（或 `MOCK=1`） |
| `409 busy` | 正在產生、載入或卸載中。後端**不排隊**；前端禁用按鈕並輪詢 `/v1/health`，等 `busy=false` 再送 |
| `422 invalid_request` | 參數格式或範圍錯誤（例：`temperature=2.5`、`stream=1`），照 detail 修正 |
| `503 no_model_loaded` | 還沒載入版本（啟動後預設不載入）→ 先 `POST /v1/models/load` |
| `404 model_not_available` | 該版本尚未下載或下載未完成 → `bash models/download.sh <id>`，完成後再載入 |
| `500 model_load_failed` | mlx-audio 載入時拋錯（檔案損壞、model_type 不對等），或切換版本時卸載舊版本就失敗（detail 寫「卸載目前版本 … 時失敗」），看 log 的 traceback；失敗後 `loaded` 為 null（先前版本已卸載） |
| `500 generation_failed`（非串流或串流第一段之前） | mlx-audio 產生時拋錯，detail 帶訊息；看 log |
| 串流中途突然斷掉（chunked 回應沒有正常結尾；curl 通常回 exit 18） | 串流已開始後 mlx-audio 拋錯：HTTP 狀態已送出，無法再回 500，後端只能記 log（`產生失敗（串流進行中，中止連線）`）並直接關閉連線。前端把「串流未正常結束」當失敗處理、提供重新產生 |
| port 被占用（`address already in use`） | `lsof -nP -iTCP:8793 -sTCP:LISTEN` 查誰占用；多半是上次背景啟動沒關 → `pkill -f "uvicorn app.main"`，或換 port |
| `RuntimeError: There is no Stream(gpu, 0) in current thread` | MLX 的 stream 是每條執行緒各自的；所有 MLX 呼叫必須在 `app/worker.py` 的單一 MLX 執行緒上跑。看到這個錯代表有程式在別的執行緒碰了 mx.array（例如改用了 `asyncio.to_thread`），請改回 `run_mlx` |
| 按停止後 health 仍 `busy=true` 一小段時間 | 正常。mlx-audio 的 generate 是同步產生器，單一段無法中途打斷；後端在**當前這一段生成完**、關閉產生器後才釋放鎖。串流與非串流都以約 0.3 秒音訊為一段取，中止延遲約 0.3 秒，上限不超過一個自動分段 |
| 回應 `X-Early-Stop: true` 或 `/v1/tts/last` 的 `early_stop: true` | 出聲後尾端連續 6 秒靜音，或開頭 6 秒內都沒出聲（> −40 dBFS）：可能是講一半就斷（8bit 已知弱點）、講完不停一路靜音，或從頭就沒出聲（見「提前中斷偵測」）；後端已自動停止並裁尾，前端提示「偵測到長時間無聲，已自動停止；若內容不完整請重新產生」。聽過若內容不完整就重新產生，或減少標籤、改用 4bit / bf16 比較 |
| `GET /v1/tts/last` 回 `404 no_generation_yet` | 啟動後還沒有任何回過 200 的產生（重啟會清空） |
| 記憶體一直很高 | 模型本身就佔約 40 GB（8bit）；產生中快取另長 28–30 GB（`/v1/models` 的 `peak_memory_gb` 為含快取的行程峰值、`active_memory_gb` 為不含快取的 MLX active 峰值），產生結束即回收。要釋放請 unload |
| 參考音檔 400 `reference_too_long` | 超過 60 秒，前端裁短；建議 10–30 秒清晰人聲 |
| 參考音檔 400 `reference_decode_failed` | 不是有效 WAV（後端只接受 WAV，前端負責轉檔）或是空檔 |
| `server/tmp/<pid>/` 殘留 | 行程被強制終止（kill -9）時可能殘留；下次任一後端啟動時，pid 已不存在的子目錄會自動清掉（log 記「已清掉殘留暫存目錄」）。舊版留在 `server/tmp/` 根目錄的 `ref-*.wav` 不會自動清，確認沒有後端在跑後可手動刪 |

---

相關文件：`spec/api-conventions.md`（契約）、`spec/architecture.md`（架構）、`spec/model-capabilities.md`（能力與限制）、
`plan/backend-tts-server.md`（Epic 1 計畫與踩雷紀錄）、`models/README.md`（下載）。
