# HTTP 測試集合

每個 API 資源（通常對應一個 Controller）對應一個 `.http` 檔（IDEA HTTP Client 格式），方便分模組維護。

---

## 使用方式

1. **選擇環境**：IDEA 右上角下拉選 `dev` / `prod`（讀 [`http-client.env.json`](http-client.env.json)）
2. **若有登入**：先跑 `auth.http` 的「登入」，把 token 存到全域變數（如 `{{jwt}}`）
3. **再跑其他檔案的請求**：所有 `.http` 共用同一組全域變數

---

## 檔案對照

| 檔案 | 對應資源 | 路徑前綴 |
|------|----------|---------|
| `tts.http` | 健康、模型版本、產生語音 | `/v1/health`、`/v1/models`、`/v1/tts` |

> 本專案無登入，`{{jwt}}` 等認證變數不適用。參考音檔請放 `user/http/samples/`（不進版控）。

---

## 命名規範

- 檔名 = 資源名稱（複數 kebab-case）：`users.http`、`operation-logs.http`
- 與後端 `@RequestMapping`（或對應路由）路徑保持一致
- 環境變數放 [`http-client.env.json`](http-client.env.json)，**不要**寫死於 `.http` 檔內

---

## 新增 API 資源時必做

1. 新增 `<resource-name>.http`
2. 在本 README 對照表加一行
3. 至少包含每個 endpoint 的一個基本 request 範例

---

## 全域變數慣例

| 變數 | 設定來源 | 用途 |
|------|---------|------|
| `{{host}}` | `http-client.env.json` | API base URL |
| `{{username}}` / `{{password}}` | `http-client.env.json` | 登入帳密 |
| `{{jwt}}` | `auth.http` 登入後 `client.global.set(...)` | Bearer Token |
| `{{<resourceId>}}` | 各 `.http` 建立資源後 set | 給後續 update / delete 使用 |
