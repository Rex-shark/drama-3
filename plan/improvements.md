# 品質 / 安全 / 運維改進

> 跨 Epic 的非功能性改進事項。屬於某個 Epic 的功能請寫到該 Epic 文件。

---

## 進行中

2026-10-16 對開 code review（high，server/app + frontend/src）共 10 項，編號 CR-1 到 CR-10，列於下方；由印工修。

---

## 待辦（按優先級）

### 🔴 CRITICAL

| 狀態 | 項目 | 說明 |
|------|------|------|
| | | |

### 🟠 HIGH

| 狀態 | 項目 | 說明 |
|------|------|------|
| ✅ | CR-1 多個後端行程共用 `server/tmp` | 第二個行程啟動 / 關閉會刪掉第一個行程產生中的 ref-*.wav（CLAUDE.md 明寫 8793 + 8794 可並行）。改為 `server/tmp/<pid>/` 只清自己的，或只清超過 N 分鐘的舊檔。`server/app/main.py:34`、`settings.py:9`。**已修 2026-10-16**：`server/tmp/<pid>/`，啟動清自己與已死行程的子目錄、關閉移除自己的；雙 MOCK 實測 8796 重啟時 8794 產生中的 ref 檔不受影響，請求 200 |
| ✅ | CR-2 錄音自動停止落在 60.0–60.2 秒，被後端拒收 | 計時每 200 ms 檢查且 `s >= 60` 才停。改 59.5 秒觸發，或 `recorder.stop()` 裁到 60 秒整。`frontend/src/components/SpeakerCard.jsx:80`。**已修 2026-10-16**：59.5 秒自動停止＋stop() 以樣本數裁到 60.0 秒（純函式單元檢查 60.2→60.0、59→不變） |
| ✅ | CR-3 `OfflineAudioContext` 以嗅探取樣率建構，失敗無後備 | Safari 對取樣率範圍較窄，8 kHz / 22.05 kHz 檔可能整個標成無法解碼。建構包 try/catch，失敗改 48 kHz 重試。`frontend/src/lib/wav.js:114`。**已修 2026-10-16**：建構與解碼失敗改 48 kHz 重試一次，首次解碼傳複本避免 buffer 被 detach；注入假 context 五情境通過 |

### 🟡 MEDIUM

| 狀態 | 項目 | 說明 |
|------|------|------|
| ⬜ | 用 `mx.set_cache_limit` 限制產生中的 MLX 快取（例如 8 GB） | 行程峰值可從 55 / 72 / 103 GB 壓低，代價可能變慢；視 bf16 實際使用需求再量（2026-10-15 Phase 2 發現） |
| ✅ | CR-4 版本清單只在 loaded 改變時重抓 | 頁面開著時下載完成的版本仍顯示未下載。閒置輪詢每 5 秒順便 refreshModels，或展開下拉時重抓。`frontend/src/hooks/useBackend.js:32`。**已修 2026-10-16**：閒置輪詢每 5 秒順便抓 /v1/models，瀏覽器實測成對出現 |
| ✅ | CR-5 可用性判定要求清單內每個檔都在，含 README | 刪掉 README.md 就被判「尚未下載完成」。清單比對只針對 config / tokenizer / codec / model-*.safetensors。`server/app/availability.py:54`。**已修 2026-10-16**：依 mlx-audio 實際讀取，必要檔為 config.json、tokenizer.json、清單內全部 *.safetensors（含 codec）；tokenizer_config / special_tokens_map / chat_template 只在 convert.py 用到，不列入；單元測試 12 項 PASS，真實三版本仍 true |
| ✅ | CR-6 串流 take 的 PCM 同時留在 `player.received` 與 blob | 12 個 take 記憶體加倍。`bytes()` 後清空 received，或 take/update 時把 player 設 null。`frontend/src/lib/pcmPlayer.js:27`、`useStudio.js:275`。**已修 2026-10-16**：改用 drain() 取走後清空 received；player 保留供播放進度 |
| ✅ | CR-7 每次輪詢都 setHealth 新物件，整個 App 每秒重繪 | 劇本多行時卡頓。內容相同就不 setState。`frontend/src/hooks/useBackend.js:30`。**已修 2026-10-16**：health 逐欄比對、models 字串比對，相同不 setState；閒置 26 秒 0 次 commit |
| ✅ | CR-9 切換版本時卸載失敗回 internal_error 而非 model_load_failed | `_unload_current` 不在 try 內。納入並在 detail 說明是卸載階段。`server/app/models.py:134`。**已修 2026-10-16**：卸載失敗回 500 model_load_failed，detail「卸載目前版本 X 時失敗，未載入 Y」，鎖照常釋放；單元測試 9 項 PASS |
| ⬜ | 低音量雜訊型中斷的偵測 | 全程約 −45 dBFS 的雜訊撞 max_tokens，現行規則抓不到；需多收樣本再定門檻 |

### 🟢 LOW

| 狀態 | 項目 | 說明 |
|------|------|------|
| ✅ | CR-8 `shownError` 在渲染層遮掉過期的 busy 錯誤 | 應在 busy 由 true 變 false 時清 state.error，而非比對文案字串。`frontend/src/App.jsx:91`。**已修 2026-10-16**：reducer 新增 errorCode，busy true→false 時清 busy 錯誤；實測訊息在 busy 結束後 0.2 秒消失 |
| ✅ | CR-10 `lastResultFor` 重試 4 次沒有必要 | 後端在回應結束前已寫入 last；改查一次，request_id 不符就放棄並 console.warn。`frontend/src/hooks/useStudio.js:14`。**已修 2026-10-16**：只查一次，不符或失敗 console.warn 回 null；實測串流後只查一次 |

---

## 已完成

（暫無）

---

## 圖例

⬜ 待開始　🔄 進行中　✅ 已完成

> 詳見 [`README.md`](README.md) 開發計畫管理規範。
