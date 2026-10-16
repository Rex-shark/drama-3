---
version: alpha
name: REX LAB — Paper & Ink / Workbench
description: 根目錄品牌規範「Paper & Ink」的工作台層。同一張紙、同一道窗光，但面板全平、只用細線分隔；唯一有厚度的物件是「產出的 take」那張卡紙。色值與根目錄一致，若有出入以根目錄為準。
colors:
  primary: "#121212"
  paper: "#f1f1ef"
  card: "#fbfbf9"
  shade: "#c9c9c6"
  ink-muted: "#595957"
  line-soft: "#d2d2ce"
  edge-1: "#e4e4e0"
  edge-2: "#d3d3cf"
  error: "#9b2f22"
  primary-dark: "#ecebe8"
  paper-dark: "#161616"
  card-dark: "#202020"
  shade-dark: "#0b0b0b"
  ink-muted-dark: "#a2a19d"
  line-soft-dark: "#30302e"
  edge-1-dark: "#2a2a29"
  edge-2-dark: "#0e0e0e"
  error-dark: "#d9695a"
typography:
  title:
    fontFamily: Lexend
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.005em
  label:
    fontFamily: Lexend
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0.16em
  field-label:
    fontFamily: Noto Sans TC
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0.04em
  script:
    fontFamily: Noto Sans TC
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.8
  body:
    fontFamily: Noto Sans TC
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.75
  body-sm:
    fontFamily: Noto Sans TC
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.6
  input:
    fontFamily: Noto Sans TC
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: IBM Plex Mono
    fontSize: 11px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0.06em
  data:
    fontFamily: IBM Plex Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
rounded:
  none: 0px
  xs: 1px
spacing:
  "1": 4px
  "2": 8px
  "3": 12px
  "4": 16px
  "6": 24px
  "8": 32px
  "12": 48px
  "14": 56px
  column-speakers: 320px
  column-output: 360px
  column-gap: 24px
  workbench-max: 1600px
components:
  page:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
  page-dark:
    backgroundColor: "{colors.paper-dark}"
    textColor: "{colors.primary-dark}"
  panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    padding: 24px
  panel-label:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    height: 32px
  hairline:
    backgroundColor: "{colors.primary}"
    height: 1px
  row-divider:
    backgroundColor: "{colors.line-soft}"
    height: 1px
  row-divider-dark:
    backgroundColor: "{colors.line-soft-dark}"
    height: 1px
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.primary}"
    typography: "{typography.input}"
    rounded: "{rounded.none}"
    padding: 8px 10px
  input-dark:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.primary-dark}"
  input-error:
    backgroundColor: "{colors.card}"
    textColor: "{colors.error}"
  textarea-script:
    backgroundColor: "{colors.card}"
    textColor: "{colors.primary}"
    typography: "{typography.script}"
    rounded: "{rounded.none}"
    padding: 12px 14px
  select:
    backgroundColor: "{colors.card}"
    textColor: "{colors.primary}"
    typography: "{typography.input}"
    rounded: "{rounded.none}"
    padding: 8px 32px 8px 10px
  slider-track:
    backgroundColor: "{colors.line-soft}"
    height: 1px
  slider-fill:
    backgroundColor: "{colors.primary}"
    height: 1px
  slider-thumb:
    backgroundColor: "{colors.primary}"
    size: 12px
    rounded: "{rounded.none}"
  toggle-off:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.meta}"
    rounded: "{rounded.none}"
    padding: 4px 8px
  toggle-on:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    typography: "{typography.meta}"
    rounded: "{rounded.none}"
    padding: 4px 8px
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.data}"
    rounded: "{rounded.none}"
    padding: 2px 8px
  chip-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
  speaker-stamp:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    typography: "{typography.meta}"
    rounded: "{rounded.none}"
    size: 22px
  speaker-stamp-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    typography: "{typography.meta}"
    rounded: "{rounded.none}"
    size: 22px
  script-row:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    typography: "{typography.script}"
    padding: 12px 0
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: 12px 20px
  button-primary-dark:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.paper-dark}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: 8px 14px
  button-outline-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
  button-disabled:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: 8px 14px
  dropzone:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: 24px
  player-progress-track:
    backgroundColor: "{colors.line-soft}"
    height: 1px
  player-progress-fill:
    backgroundColor: "{colors.primary}"
    height: 1px
  status-line:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.meta}"
  error-text:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.error}"
    typography: "{typography.body-sm}"
  error-text-dark:
    backgroundColor: "{colors.paper-dark}"
    textColor: "{colors.error-dark}"
  take-sheet:
    backgroundColor: "{colors.card}"
    textColor: "{colors.primary}"
    rounded: "{rounded.xs}"
    padding: 32px
  take-sheet-dark:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.xs}"
  take-sheet-edge:
    backgroundColor: "{colors.edge-1}"
    height: 1.5px
  take-sheet-edge-under:
    backgroundColor: "{colors.edge-2}"
    height: 3px
  take-sheet-edge-dark:
    backgroundColor: "{colors.edge-1-dark}"
    height: 1.5px
  take-sheet-edge-under-dark:
    backgroundColor: "{colors.edge-2-dark}"
    height: 3px
  window-shadow:
    backgroundColor: "{colors.shade}"
  window-shadow-dark:
    backgroundColor: "{colors.shade-dark}"
  status-line-dark:
    backgroundColor: "{colors.paper-dark}"
    textColor: "{colors.ink-muted-dark}"
    typography: "{typography.meta}"
---

# REX LAB — Paper & Ink / Workbench

> 本檔是根目錄 [`DESIGN.md`](../DESIGN.md) 的工作台層。品牌層定義材質（紙張紋理、窗光、凸版壓痕）；本檔只定義工作台怎麼把這些材質用在表單、劇本與播放器上。兩邊衝突時，材質與色值以品牌層為準，版面與元件以本檔為準。

## Overview

工作台是**一張攤在桌上的大紙**，不是一疊卡片。整個視口就是那張 `paper` 底紙，三個面板（角色、劇本、產生與輸出）直接印在紙上，用細線與標題分區，像一份排好版的工作單。面板本身沒有厚度、沒有陰影。

畫面上只有一個物件有厚度：**產出的 take**。每次產生完成，輸出面板會「印出」一張 `card` 卡紙，帶品牌層的 card stock 陰影與窗光，微微傾斜，像剛從印刷機取下。這保留了品牌的 hero 概念，卻不干擾操作區。

語氣：安靜、精確、像校對桌。沒有強調色，唯一的例外是校對用的紅筆（見 Colors）。所有紋理與光影效果在一眼之下應讀成平面黑白，第二眼才發現材質。

## Colors

全部沿用品牌層，新增一個 token：

- **Error（#9b2f22）**：校對紅筆。紙上編輯唯一會出現的第二種墨色。只用於錯誤文字、超限提示（如參考音檔超過 60 秒）、輸入框的錯誤狀態文字。**永遠只當文字或 1px 線，不當填色**。在 `paper` 上 6.6:1，在 `card` 上 6.9:1。暗色主題用 **#d9695a**，在 `paper-dark` 上 5.3:1。
- **角色不用顏色區分**。16 個角色用「角色章」（見 Components）：方形小章上印編號，被選取的章反白為墨色。同一角色的劇本行靠章上的編號與角色名辨識，不靠色彩。
- 狀態（產生中、切換模型中、串流中）用 `ink-muted` 的 meta 文字表達，不用色彩。

## Typography

沿用品牌字型：Lexend 標題、Noto Sans TC 內文、IBM Plex Mono 資料。本層補中間幾級：

- **title（Lexend 500 / 20px）**：頁面標題「DRAMA 3 工作台」與對話框標題。工作台不用品牌層的 display-xl 與 heading。
- **label（Lexend 500 / 12px / 0.16em 大寫）**：面板標題，如「SPEAKERS」「SCRIPT」「OUTPUT」，下方配一條 hairline，與品牌層的 signage 做法一致。
- **field-label（Noto Sans TC 500 / 12px）**：表單欄位名稱，如「逐字稿」「溫度」。
- **script（Noto Sans TC 400 / 16px / 1.8）**：劇本台詞。這是工作台最主要的閱讀面，比 body 大一級、行距更寬，像劇本排版。
- **body-sm（13px）**：說明文字、錯誤訊息、dropzone 提示。
- **input（15px / 1.5）**：所有輸入框。
- **data（IBM Plex Mono 12px）**：秒數、取樣參數值、角色章編號、標籤 chip 文字。
- **meta（11px / 0.06em）**：狀態列、時間戳。

凸版壓痕**只套在 title**。panel-label（12px）與角色章編號（11px）都在品牌層「約 13px 以下不套」的範圍內，不套；所有輸入框內容不套。（2026-10-15 修正：原本寫 panel-label 與角色章也套，與品牌層衝突，以品牌層為準。）

**招牌字與中文並列**：Lexend 大寫 label 是品牌語彙，面板標題寫 `SPEAKERS 角色`、`SCRIPT 劇本`、`OUTPUT 產生與輸出`，英文在前、中文在後同一行。`TAKE 02` 與 `REC` 是錄音室術語，單獨出現可不並列。除此之外的狀態列、提示、按鈕文字一律中文；MOCK 橫幅用「模擬後端」，不用英文。

**字型自行打包**：本專案離線可用是前提，三套字型以 `@fontsource/lexend`（300、500）、`@fontsource/noto-sans-tc`（400、500）、`@fontsource/ibm-plex-mono`（400）隨前端打包，**不可**連 Google Fonts。

## Layout

工作台三欄，從左到右：**角色** → **劇本** → **產生與輸出**。資訊流就是工作流：先準備聲音，再寫台詞，最後聽結果。

| 視口寬度 | 配置 |
|---|---|
| ≥ 1280px | 三欄：角色 320px、劇本自適應、輸出 360px；欄距 24px；整體最寬 1600px 置中 |
| 768–1279px | 兩欄：劇本自適應 + 輸出 `minmax(300px, 360px)`；劇本欄寬 ≤ 600px 時每行的台詞框獨佔一列（角色章與下拉在上一列）；角色面板收成頂端的橫向列，點角色章展開編輯 |
| < 768px | 單欄，三個面板以頂端分頁切換 |

- 面板之間不畫框，用欄距與 panel-label 底下的 hairline 分區。像同一張紙上印了三個表格。
- 面板內的列（角色卡、劇本行）用 `row-divider` 分隔，每列末端無箭頭（箭頭是品牌層導覽列的語彙，工作台的列是可編輯內容，不是連結）。
- 間距沿用 4 / 8 / 16 / 24 / 48 / 56，本層加 **12px**（欄位內距）與 **32px**（take 卡紙內距、面板間的區塊距離）。
- 頁面頂端一行：左邊 title，右邊模型版本選擇與狀態列。沒有 hero。

## Elevation & Depth

品牌層的四層深度在工作台只保留兩處：

| 層 | 工作台用法 |
|---|---|
| 0. 紙面 | `body` 套 tooth + cloud 紋理，與品牌層完全相同 |
| 1. 窗光 | **只出現在輸出面板**，斜斜掃過 take 卡紙所在的區域。角色與劇本面板沒有窗光 |
| 2. 卡紙 | **只有 take-sheet**。套 card stock 紋理、`shadow-sheet`、旋轉 −0.6°（比品牌 hero 的 −1.2° 收斂，因為旁邊是表單） |
| 3. 壓痕 | 只有 title |

- **暗色主題的窗光**：卡紙上的 over-pass 從品牌層的 50% 降到 **30%**（`normal` 混合），而且卡紙上的可操作元件（按鈕列、播放器、角色章）疊在窗光之上（z-index 高於 `::after`），不被壓暗；只有台詞文字與紙面在窗光之下。亮色主題維持品牌層 55% `multiply`，文字與按鈕都在窗光之下，因為 multiply 在淺底上只是微微變灰。
- **暗色卡紙的 sheen**：`radial-gradient(120% 90% at 20% 0%, rgba(255,255,255,.06), transparent 60%)`。
- **面板、輸入框、按鈕一律無陰影**。輸入框靠 `card` 比 `paper` 亮 3% 的差異浮出，不加邊框；focus 時才出現 1px 墨色外框。
- **紋理只在 body 與 take-sheet**。面板與劇本行不套 SVG 濾鏡：劇本可能有幾十行，每行套濾鏡會明顯掉幀。
- 多張 take 並存時（歷史 take），只有最新的一張是立體卡紙；舊的 take 以平面列表示，像已歸檔的稿件。

### 互動狀態（品牌層未定義，本層補）

| 狀態 | 表現 |
|---|---|
| hover | 按鈕反白（墨底紙字）；chip 同；劇本行底色不變，只顯示操作按鈕 |
| focus-visible | 1px `primary` 外框，`outline-offset: 2px`，形成雙線套印的樣子。不用瀏覽器預設藍框 |
| pressed | `translateY(1px)`，並移除壓痕的亮邊，像墨壓得更深 |
| disabled | 文字與邊框改 `ink-muted`，無 hover、無壓痕；不降透明度，紙上沒有半透明的墨 |
| 產生中 / 切換模型中 | 狀態列 meta 文字後接一個 1Hz 閃爍的 ▪（方塊，不是圓點）；主按鈕進 disabled |
| 串流播放中 | player-progress-fill 隨播放長度延伸；狀態列顯示「▪ 串流中」 |
| 錯誤 | 欄位下方 error-text；欄位底部加 1px `error` 線；不改欄位底色 |

### 動態

- take-sheet 在新 take 出現時「落到桌上」一次：`rotate(-3deg) translateY(8px)` → `rotate(-0.6deg)`，0.6s，`cubic-bezier(.2,.7,.2,1)`。
- 其餘無動畫。`prefers-reduced-motion` 下關閉落紙動畫與閃爍方塊（改為靜態文字「處理中」）。

## Shapes

- 全部直角。`rounded.none` 一律，`rounded.xs`（1px）只給 take-sheet。
- 滑桿的滑塊是 12px 方塊，軌道是 1px 線。
- 開關不是膠囊，是一對相鄰的方形文字鈕（「關」「開」），選中的一邊反白。
- 角色章是 22px 方形，1px 墨框，內印編號。
- **Icon 政策**：品牌層說「沒有 icon」，工作台放寬為**只有傳輸控制用線條字形**：播放（空心三角）、停止（實心方塊）、錄音（實心方塊 + 「REC」data 文字）、上移 / 下移（品牌箭頭轉 90°）。筆畫 1.5px、方頭、16px 框，與品牌箭頭同一語言。其餘動作（刪除、新增、下載、重新產生）一律文字按鈕。沒有圓形、沒有圖示庫。

## Components

- **panel / panel-label**：面板 = 一個 label 大寫標題 + hairline + 內容。無框無底。
- **input / textarea-script / select**：`card` 底、無邊框、直角。textarea-script 用 script 字級給台詞；select 右側 32px 留給一個品牌箭頭轉 90° 的向下箭頭。
- **slider-track / slider-fill / slider-thumb**：1px 軌道、墨色已填段、12px 方塊滑塊；右側以 data 字型顯示數值。
- **toggle-on / toggle-off**：相鄰兩個方形文字鈕。
- **chip / chip-hover**：標籤插入鈕，如 `[laughs]`、`<whisper>`；data 字型、1px `line-soft` 框、hover 反白。
- **speaker-stamp / speaker-stamp-active**：角色章。列在角色面板與每一劇本行行首；active 用於目前編輯中的角色。
- **script-row**：一行 = 角色章 + 台詞 + 展開鈕（風格前綴、導演筆記在展開區）。hover 時行尾浮現「上移 下移 刪除」文字鈕。
- **button-primary**：墨底紙字，**只給「產生」一顆**。其他按鈕都是 button-outline。
- **button-outline / button-outline-hover / button-disabled**：沿用品牌層。放在 take-sheet 上時底色透明（讓卡紙紋理透出），1px `primary` 框；disabled 時框與字都改 `ink-muted` 1px，無 hover。
- **dropzone**：1px `line-soft` 虛線框（像裁切線），body-sm 提示文字；拖入時虛線轉墨色。支援「上傳音檔」與「錄音」兩個文字鈕並列在框內。
- **player**：傳輸字形 + 1px 進度線 + data 字型的時間「00:12 / 00:47」。進度線**沒有滑塊**但可點可拖，hover 時在游標處顯示一條 1px 高 8px 的墨色刻度。沒有音量鈕，沒有波形。
- **status-line**：頁首右側與輸出面板底部，meta 字型，顯示模型版本、載入狀態、耗時、即時倍率。
- **error-text**：校對紅筆文字。
- **take-sheet / take-sheet-edge / take-sheet-edge-under / window-shadow**：唯一的卡紙與它的厚度邊、以及只在輸出面板出現的窗光，數值全部沿用品牌層。take-sheet內容：角色章列、台詞摘要（最多三行，超出以「…」截斷）、player、下載與重新產生按鈕、meta 時間戳。

## Do's and Don'ts

- **Do** 把整個工作台當一張紙：面板不畫框、不加陰影、不換底色。
- **Do** 把厚度留給 take-sheet，一次只有一張是立體的。
- **Do** 光源一致：窗光 118°、壓痕亮邊 Y +1px、紋理 azimuth 225°，全部繼承品牌層。
- **Do** 字型自行打包，離線要能完整顯示。
- **Do** 每個可操作元件都有 focus-visible 的墨色雙線。
- **Do** 讓卡紙上的按鈕疊在窗光之上，暗色主題尤其如此。
- **Don't** 用顏色區分角色或狀態，角色用章、狀態用文字。
- **Don't** 把 `error` 當填色或大面積背景，它只是一支紅筆。
- **Don't** 在面板、劇本行、輸入框上套紙張紋理濾鏡。
- **Don't** 用圓角、圓點、膠囊、圖示庫；傳輸字形以外的動作一律文字。
- **Don't** 讓工作台旋轉。只有 take-sheet 可以傾斜，而且只有 −0.6°。
- **Don't** 用透明度表示 disabled，紙上沒有半透明的墨。
