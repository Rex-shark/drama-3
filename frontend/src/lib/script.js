// 劇本組字與檢查（控制語法見 spec/model-capabilities.md 第四節）。
// 使用者不手打 <|speaker:N|>：每一行由「角色 + 風格前綴 + 台詞 + 導演筆記」組成純文字。

export const MAX_SPEAKER_ID = 15
export const MAX_SPEAKERS = 16

// 呼叫端文字不可含的結構 token（對齊 server/app/validation.py）。
export const STRUCTURAL_TOKENS = [
  '<|im_start|>',
  '<|im_end|>',
  '<|voice|>',
  '<|text|>',
  '<|interleave|>',
  '<|semantic:',
]

// Unicode White_Space（與後端相同）
const WHITE_SPACE = new Set(
  [
    ...Array.from({ length: 5 }, (_, i) => 0x9 + i),
    0x20, 0x85, 0xa0, 0x1680,
    ...Array.from({ length: 11 }, (_, i) => 0x2000 + i),
    0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
  ].map((c) => String.fromCharCode(c)),
)

const isBlank = (text) => [...text].every((ch) => WHITE_SPACE.has(ch))

export const POINT_TAGS = ['laughs', 'sighs', 'pause', 'gasps', 'clears throat', 'coughs']
export const RANGE_TAGS = ['whisper']

const SPEAKER_TAG_AT = /^<\|speaker:([0-9]+)\|>/
const SPEAKER_TAG_ANY = /<\|speaker:([0-9]+)\|>/

// 與後端 text_problem 相同的規則；回傳問題說明或 null。
export function textProblem(text, label) {
  if (isBlank(text)) return `${label}是空的`
  for (const token of STRUCTURAL_TOKENS) {
    if (text.includes(token)) return `${label}不可包含結構 token ${token}`
  }
  let index = text.indexOf('<|speaker')
  while (index !== -1) {
    const match = text.slice(index).match(SPEAKER_TAG_AT)
    const number = match ? match[1] : ''
    if (!number || number !== String(Number(number)) || Number(number) > MAX_SPEAKER_ID) {
      return `${label}的角色標籤格式錯誤（${text.slice(index, index + 16)}…）：只接受 <|speaker:0|> 到 <|speaker:${MAX_SPEAKER_ID}|>，編號不可有前導 0`
    }
    index = text.indexOf('<|speaker', index + 1)
  }
  return null
}

// 欄位內的換行會打斷「每行開頭是角色標籤」的結構，一律收成空白。
const flat = (value) => (value ?? '').replace(/\s*\n\s*/g, ' ').trim()
// 使用者若自己加了外層方括號，去掉再由組字補上。
const unbracket = (value) => flat(value).replace(/^\[(.*)\]$/, '$1').trim()

export function composeRow(row) {
  const tag = `<|speaker:${row.speaker}|> `
  const style = unbracket(row.style)
  const body = [style && `[${style}]`, flat(row.text)].filter(Boolean).join(' ')
  const direction = flat(row.direction)
  if (direction) return `${tag}Direction: ${direction}\nLine: ${body}`
  return tag + body
}

export function composeScript(rows) {
  return rows.map(composeRow).join('\n')
}

// 文字中出現的角色編號（遞增、去重）
export function speakersInText(text) {
  const ids = new Set()
  for (const m of text.matchAll(/<\|speaker:([0-9]+)\|>/g)) ids.add(Number(m[1]))
  return [...ids].sort((a, b) => a - b)
}

// 原始模式的純文字 → 劇本行。組字是無損的：parse 後再 compose 會得到同一段文字
// （欄位內換行除外，會收成空白）。開頭的 [描述] 一律視為風格前綴，組回去字串相同。
export function parseScript(text) {
  const rows = []
  let current = null
  const lines = text.split('\n')
  const splitStyle = (content) => {
    const m = content.match(/^\[([^\]]+)\]\s+(.*)$/s)
    return m ? { style: m[1], text: m[2] } : { style: '', text: content }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const tag = line.match(/^<\|speaker:([0-9]+)\|>\s?(.*)$/s)
    if (tag) {
      const number = tag[1]
      if (number !== String(Number(number)) || Number(number) > MAX_SPEAKER_ID) {
        return { error: `第 ${i + 1} 行的角色編號 ${number} 不在 0–${MAX_SPEAKER_ID}` }
      }
      const content = tag[2]
      current = { speaker: Number(number), style: '', text: '', direction: '', awaitingLine: false }
      if (content.startsWith('Direction:')) {
        current.direction = content.slice('Direction:'.length).trim()
        current.awaitingLine = true
      } else {
        Object.assign(current, splitStyle(content.trim()))
      }
      rows.push(current)
    } else if (current?.awaitingLine && line.startsWith('Line:')) {
      Object.assign(current, splitStyle(line.slice('Line:'.length).trim()))
      current.awaitingLine = false
    } else if (current) {
      if (line.trim()) current.text = [current.text, line.trim()].filter(Boolean).join(' ')
    } else if (line.trim()) {
      return { error: `第 ${i + 1} 行沒有角色標籤，無法轉回劇本行（原始模式仍可直接產生）` }
    }
  }
  return { rows: rows.map(({ speaker, style, text, direction }) => ({ speaker, style, text, direction })) }
}

// 在游標處插入點狀標籤，或用區間標籤包住選取範圍。回傳 { value, start, end }（新的選取範圍）。
export function insertTag(value, start, end, tag, kind) {
  const before = value.slice(0, start)
  const selected = value.slice(start, end)
  const after = value.slice(end)
  if (kind === 'range') {
    const open = `<${tag}>`
    const close = `</${tag}>`
    const next = before + open + selected + close + after
    const caret = before.length + open.length
    return { value: next, start: caret, end: caret + selected.length }
  }
  const pad = /^\s/.test(after) ? '' : ' '
  const inserted = `[${tag}]${pad}`
  const next = before + inserted + after
  const caret = before.length + inserted.length
  return { value: next, start: caret, end: caret }
}

// 送出前檢查：回傳問題清單（字串陣列），空陣列表示可送出。
// 對應後端會回 400 / 422 的情況，前端先擋。
export function collectIssues({ rawMode, rawText, rows, speakers, params }) {
  const issues = []
  const speakerIds = new Set(speakers.map((s) => s.id))
  let text
  if (rawMode) {
    text = rawText
  } else {
    if (rows.length === 0) issues.push('劇本是空的，請新增至少一行')
    rows.forEach((row, i) => {
      const n = i + 1
      if (!speakerIds.has(row.speaker)) issues.push(`第 ${n} 行的角色已刪除，請重新選擇`)
      if (!flat(row.text)) issues.push(`第 ${n} 行的台詞是空的`)
      for (const [field, label] of [['text', '台詞'], ['style', '風格前綴'], ['direction', '導演筆記']]) {
        if (SPEAKER_TAG_ANY.test(row[field] ?? '')) {
          issues.push(`第 ${n} 行的${label}不可自行輸入角色標籤，角色請用下拉選單指定`)
        }
      }
    })
    text = composeScript(rows)
  }
  const problem = textProblem(text, rawMode ? '原始文字' : '劇本')
  if (problem && !(rows.length === 0 && !rawMode)) issues.push(problem)

  const used = new Set(speakersInText(text))
  for (const speaker of speakers) {
    if (!used.has(speaker.id)) continue
    speaker.refs.forEach((ref, j) => {
      const label = `${speaker.name || `角色 ${speaker.id}`}的第 ${j + 1} 段參考音檔`
      if (ref.status === 'decoding') issues.push(`${label}還在轉檔`)
      if (ref.status === 'error') issues.push(`${label}無法使用，請刪除後重新上傳`)
      if (ref.seconds > 60) issues.push(`${label}長 ${ref.seconds.toFixed(1)} 秒，超過上限 60 秒`)
      const tProblem = textProblem(ref.transcript ?? '', `${label}的逐字稿`)
      if (tProblem) issues.push(tProblem)
      else if (SPEAKER_TAG_ANY.test(ref.transcript)) issues.push(`${label}的逐字稿不可包含角色標籤`)
    })
  }

  const { temperature, top_p, top_k, max_tokens } = params
  if (!(Number.isFinite(temperature) && temperature >= 0 && temperature <= 2)) issues.push('溫度必須介於 0 到 2')
  if (!(Number.isFinite(top_p) && top_p > 0 && top_p <= 1)) issues.push('top_p 必須大於 0 且不超過 1')
  if (!(Number.isInteger(top_k) && top_k >= 1)) issues.push('top_k 必須是 ≥ 1 的整數')
  if (!(Number.isInteger(max_tokens) && max_tokens >= 1)) issues.push('max_tokens 必須是 ≥ 1 的整數')
  return { issues, text }
}

// take 卡紙上的台詞摘要：去掉角色標籤與導演筆記，保留表演標籤
export const scriptSummary = (text) =>
  text
    .split('\n')
    .map((l) => l.replace(/^<\|speaker:\d+\|>\s?/, '').replace(/^Line:\s?/, ''))
    .filter((l) => l && !l.startsWith('Direction:'))
    .join(' ／ ')
