# 開發計畫管理規範

本目錄為專案開發計畫的**單一事實來源**（single source of truth）。所有功能、改進、臨時任務皆於此追蹤。

---

## 檔案職責

| 檔案 | 職責 | 不應該寫什麼 |
|------|------|--------------|
| [`backlog.md`](backlog.md) | Epic 索引總覽（每個 Epic 一行：標題 + 狀態 + 連結） | Epic 內部任務、設計細節 |
| `<epic-name>.md` | 單一 Epic 詳細計畫（任務、設計決策、踩雷） | 別的 Epic 的事 |
| [`improvements.md`](improvements.md) | 跨 Epic 的品質 / 安全 / 運維改進 | 屬於某 Epic 的功能 |
| [`notes.md`](notes.md) | 臨時小修正（30 分鐘內可完成），完成即刪 | 跨 session 重要決策、踩雷紀錄 |
| [`TEMPLATE.md`](TEMPLATE.md) | 新 Epic 文件的範本（複製改寫） | — |

---

## 統一狀態符號

| 符號 | 意義 |
|------|------|
| ⬜ | 待開始 |
| 🔄 | 進行中 |
| ✅ | 已完成 |
| ⏸ | 暫停 |
| ❌ | 取消 |

> ⚠️ **不要混用其他符號**（如 `[x]`, `(done)`, `已完成` 純文字），統一視覺方便快速掃描。

---

## 工作流程

### 開始新功能 / Epic

1. 在 [`backlog.md`](backlog.md) 加入一行：`| ⬜ | Epic N：標題 | [details](epic-name.md) |`
2. 複製 [`TEMPLATE.md`](TEMPLATE.md) 為 `epic-name.md`
3. 填入設計決策、任務清單
4. 開始實作前狀態改 🔄

### 完成任務

- 任務級：表格內 `⬜` → `✅`
- Epic 級：`backlog.md` 該行狀態 → `✅`，並在 Epic 文件補上**完成日期**

### 改進事項（不屬於某個 Epic）

- 安全 / 品質 / 運維 → 寫進 [`improvements.md`](improvements.md) 對應分區，按優先級
- 30 分鐘內可完成的雜事 → 寫進 [`notes.md`](notes.md)，完成即刪

### 踩雷紀錄（重要！）

- **發生在某 Epic 的事故** → 寫該 Epic 文件的「## 踩雷紀錄」區塊
- 每筆三行格式：

  ```
  ### YYYY-MM-DD：<簡述>
  - **症狀**：...
  - **根因**：...
  - **解法**：...
  ```

- `notes.md` 不留踩雷紀錄（避免散落）

---

## 命名規範

- Epic 文件名：`<feature-kebab-case>.md`（例：`auth-jwt.md`、`user-management.md`、`docker-compose.md`）
- **不要**用 `epic-1.md`、`feature-a.md` 這類無語意名稱
- Epic 編號（`Epic 0`、`Epic 1`）只在文件**內部**標題使用，便於閱讀順序，不寫進檔名

---

## CLAUDE.md 對應規則

修改任何程式碼前後皆必須同步本目錄相關檔案，詳見 [CLAUDE.md](../CLAUDE.md)「開發流程規則」章節（若專案有 CLAUDE.md）。
