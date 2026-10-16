// 後端 API 呼叫（契約見 spec/api-conventions.md）。
// 經 Vite proxy 以 /api 前綴呼叫；錯誤一律拋 ApiError { status, error, detail }。

const BASE = '/api/v1'

export class ApiError extends Error {
  constructor(status, error, detail) {
    super(`${status} ${error}: ${detail}`)
    this.status = status
    this.error = error
    this.detail = detail
  }
}

async function toApiError(res) {
  let body = null
  try {
    body = await res.json()
  } catch {
    // 非 JSON（例如 proxy 連不到後端回的 502 頁）
  }
  if (body && typeof body.error === 'string') {
    return new ApiError(res.status, body.error, body.detail ?? '')
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    return new ApiError(res.status, 'network', `後端沒有回應（HTTP ${res.status}）`)
  }
  return new ApiError(res.status, `http_${res.status}`, res.statusText || '')
}

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(BASE + path, options)
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ApiError(0, 'network', String(err?.message ?? err))
  }
  if (!res.ok) throw await toApiError(res)
  return res
}

const postJson = (path, body) =>
  request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => r.json())

export const getHealth = (signal) => request('/health', { signal, cache: 'no-store' }).then((r) => r.json())
export const getModels = (signal) => request('/models', { signal, cache: 'no-store' }).then((r) => r.json())
export const loadModel = (id) => postJson('/models/load', { id })
export const unloadModel = () => postJson('/models/unload')

// 組 /v1/tts 的 multipart 表單。
// req: { text, refs: [{ blob, name, transcript, speaker }], params: { temperature, top_p, top_k, max_tokens }, stream }
export function buildTtsForm(req) {
  const form = new FormData()
  form.append('text', req.text)
  for (const ref of req.refs) {
    form.append('ref_audio', ref.blob, ref.name || 'ref.wav')
    form.append('ref_text', ref.transcript)
    form.append('ref_speaker', String(ref.speaker))
  }
  for (const [key, value] of Object.entries(req.params ?? {})) {
    if (value !== undefined && value !== null && value !== '') form.append(key, String(value))
  }
  form.append('stream', req.stream ? 'true' : 'false')
  return form
}

// X-Early-Stop：true / false；沒帶（舊後端）回 null
const earlyStopHeader = (res) => {
  const value = res.headers.get('X-Early-Stop')
  return value === null ? null : value.trim().toLowerCase() === 'true'
}

const chunksHeader = (res) => {
  const value = Number.parseInt(res.headers.get('X-Chunks') ?? '', 10)
  return Number.isFinite(value) ? value : null
}

// 非串流：回 { blob, elapsed, audioSeconds, requestId, earlyStop, chunks }
// chunks 來自 X-Chunks；舊後端沒帶時為 null，由呼叫端改查 GET /v1/tts/last
export async function ttsWav(req, signal) {
  const res = await request('/tts', { method: 'POST', body: buildTtsForm({ ...req, stream: false }), signal })
  const blob = await res.blob()
  return {
    blob,
    elapsed: Number(res.headers.get('X-Elapsed-Seconds')) || null,
    audioSeconds: Number(res.headers.get('X-Audio-Seconds')) || null,
    requestId: res.headers.get('X-Request-Id'),
    earlyStop: earlyStopHeader(res),
    chunks: chunksHeader(res),
  }
}

// 串流：回 { body: ReadableStream（raw s16le mono）, sampleRate, requestId }
// 串流無法在開頭標 X-Early-Stop，結束後查 GET /v1/tts/last
export async function ttsStream(req, signal) {
  const res = await request('/tts', { method: 'POST', body: buildTtsForm({ ...req, stream: true }), signal })
  return {
    body: res.body,
    sampleRate: Number(res.headers.get('X-Sample-Rate')) || 44100,
    requestId: res.headers.get('X-Request-Id'),
  }
}

// 最近一次產生的結果：{ request_id, early_stop, audio_seconds, elapsed_seconds, chunks }；
// 尚無紀錄時拋 404 no_generation_yet
export const getLastTts = () => request('/tts/last', { cache: 'no-store' }).then((r) => r.json())
