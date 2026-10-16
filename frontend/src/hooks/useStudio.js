// 工作台狀態：角色、劇本行、原始模式、取樣參數、產生狀態與 take。
// 全部集中在一個 useReducer；Object URL 的建立與釋放在 reducer 之外做，reducer 保持純函式。
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { getLastTts, ttsStream, ttsWav } from '../lib/api'
import { describeError } from '../lib/messages'
import { createPcmPlayer } from '../lib/pcmPlayer'
import { MAX_SPEAKERS, composeScript, parseScript } from '../lib/script'
import { uid } from '../lib/uid'
import { pcm16ToWav } from '../lib/wav'

export const DEFAULT_MAX_TOKENS = 1024

// 查一次 GET /v1/tts/last，request_id 相符才採用。後端在回應結束前已寫入紀錄，不必重試；
// 不符（例如中間又有別的產生）或查詢失敗就放棄，只記 console，不顯示錯誤。
async function lastResultFor(requestId) {
  if (!requestId) return null
  try {
    const last = await getLastTts()
    if (last?.request_id === requestId) return last
    console.warn('GET /v1/tts/last 的 request_id 不符，略過', { expected: requestId, got: last?.request_id })
  } catch (err) {
    console.warn('GET /v1/tts/last 查詢失敗，略過', err)
  }
  return null
}
const MAX_TAKES = 12
const PARAM_NAMES = ['temperature', 'top_p', 'top_k', 'max_tokens']

const newSpeaker = (id) => ({ id, name: `角色 ${id}`, refs: [] })
const newRow = (speaker) => ({ key: uid('r'), speaker, style: '', text: '', direction: '', expanded: false })

export const initialState = {
  speakers: [newSpeaker(0)],
  activeSpeaker: 0,
  rows: [newRow(0)],
  rawMode: false,
  rawText: '',
  rawError: '',
  params: { temperature: 1.0, top_p: 0.9, top_k: 30, max_tokens: DEFAULT_MAX_TOKENS },
  touched: { temperature: false, top_p: false, top_k: false, max_tokens: false },
  defaults: null,
  stream: true,
  phase: 'idle', // idle | requesting | streaming
  error: '',
  errorCode: '', // error 對應的後端代碼（busy 錯誤要在後端忙完時自動收掉）
  notice: '',
  takes: [],
  takeSeq: 0,
}

const mapSpeaker = (state, id, fn) => ({
  ...state,
  speakers: state.speakers.map((s) => (s.id === id ? fn(s) : s)),
})

function reducer(state, action) {
  switch (action.type) {
    case 'speaker/add': {
      if (state.speakers.length >= MAX_SPEAKERS) return state
      const used = new Set(state.speakers.map((s) => s.id))
      let id = 0
      while (used.has(id)) id++
      const speakers = [...state.speakers, newSpeaker(id)].sort((a, b) => a.id - b.id)
      return { ...state, speakers, activeSpeaker: id }
    }
    case 'speaker/remove': {
      const speakers = state.speakers.filter((s) => s.id !== action.id)
      const activeSpeaker = state.activeSpeaker === action.id ? (speakers[0]?.id ?? null) : state.activeSpeaker
      return { ...state, speakers, activeSpeaker }
    }
    case 'speaker/rename':
      return mapSpeaker(state, action.id, (s) => ({ ...s, name: action.name }))
    case 'speaker/select':
      return { ...state, activeSpeaker: action.id }
    case 'ref/add':
      return mapSpeaker(state, action.speaker, (s) => ({ ...s, refs: [...s.refs, action.ref] }))
    case 'ref/update':
      return mapSpeaker(state, action.speaker, (s) => ({
        ...s,
        refs: s.refs.map((r) => (r.key === action.key ? { ...r, ...action.patch } : r)),
      }))
    case 'ref/remove':
      return mapSpeaker(state, action.speaker, (s) => ({ ...s, refs: s.refs.filter((r) => r.key !== action.key) }))

    case 'row/add': {
      const row = newRow(action.speaker ?? state.activeSpeaker ?? state.speakers[0]?.id ?? 0)
      const index = action.after ? state.rows.findIndex((r) => r.key === action.after) + 1 : state.rows.length
      const rows = [...state.rows.slice(0, index), { ...row, key: action.key ?? row.key }, ...state.rows.slice(index)]
      return { ...state, rows }
    }
    case 'row/update':
      return { ...state, rows: state.rows.map((r) => (r.key === action.key ? { ...r, ...action.patch } : r)) }
    case 'row/remove':
      return { ...state, rows: state.rows.filter((r) => r.key !== action.key) }
    case 'row/move': {
      const i = state.rows.findIndex((r) => r.key === action.key)
      const j = i + action.delta
      if (i < 0 || j < 0 || j >= state.rows.length) return state
      const rows = [...state.rows]
      ;[rows[i], rows[j]] = [rows[j], rows[i]]
      return { ...state, rows }
    }

    case 'raw/enter':
      return { ...state, rawMode: true, rawText: composeScript(state.rows), rawError: '' }
    case 'raw/edit':
      return { ...state, rawText: action.text, rawError: '' }
    case 'raw/exit': {
      const parsed = parseScript(state.rawText)
      if (parsed.error) return { ...state, rawError: parsed.error }
      // 原始文字用到、但角色面板沒有的編號，自動補上角色
      const have = new Set(state.speakers.map((s) => s.id))
      const extra = [...new Set(parsed.rows.map((r) => r.speaker))].filter((id) => !have.has(id))
      const speakers = [...state.speakers, ...extra.map(newSpeaker)].sort((a, b) => a.id - b.id)
      const rows = parsed.rows.map((r, i) => ({ ...r, key: action.keys[i], expanded: Boolean(r.style || r.direction) }))
      return { ...state, rawMode: false, rawError: '', speakers, rows }
    }
    case 'raw/discard':
      return { ...state, rawMode: false, rawError: '' }

    case 'params/set':
      return {
        ...state,
        params: { ...state.params, [action.name]: action.value },
        touched: { ...state.touched, [action.name]: true },
      }
    case 'params/defaults': {
      // 版本切換：使用者沒改過的欄位換成新版本預設，改過的保留
      const params = { ...state.params }
      const all = { ...action.defaults, max_tokens: DEFAULT_MAX_TOKENS }
      for (const name of PARAM_NAMES) if (!state.touched[name] && all[name] !== undefined) params[name] = all[name]
      return { ...state, params, defaults: all }
    }
    case 'params/reset': {
      if (!state.defaults) return state
      return {
        ...state,
        params: { ...state.params, ...state.defaults },
        touched: { temperature: false, top_p: false, top_k: false, max_tokens: false },
      }
    }
    case 'stream/set':
      return { ...state, stream: action.value }

    case 'gen/start':
      return { ...state, phase: 'requesting', error: '', errorCode: '', notice: '' }
    case 'gen/streaming':
      return { ...state, phase: 'streaming' }
    case 'gen/end':
      return {
        ...state,
        phase: 'idle',
        error: action.error ?? '',
        errorCode: action.errorCode ?? '',
        notice: action.notice ?? '',
      }
    case 'error/set':
      return { ...state, error: action.error, errorCode: action.errorCode ?? '', notice: '' }
    case 'error/clearBusy':
      return state.errorCode === 'busy' ? { ...state, error: '', errorCode: '' } : state

    case 'take/add': {
      const take = { ...action.take, number: state.takeSeq + 1 }
      return { ...state, takeSeq: take.number, takes: [take, ...state.takes].slice(0, MAX_TAKES) }
    }
    case 'take/update':
      return { ...state, takes: state.takes.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)) }
    case 'take/remove':
      return { ...state, takes: state.takes.filter((t) => t.id !== action.id) }

    case 'demo/load':
      return { ...state, ...action.state }
    default:
      throw new Error(`未知的 action：${action.type}`)
  }
}

export function useStudio({ onBackendChanged } = {}) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const stateRef = useRef(state)
  const abortRef = useRef(null)
  const audioCtxRef = useRef(null)
  const livePlayerRef = useRef(null)
  const onChangedRef = useRef(onBackendChanged)

  useEffect(() => {
    stateRef.current = state
    onChangedRef.current = onBackendChanged
  })

  // 超出歷史上限被擠掉的 take 釋放 URL
  const takeUrlsRef = useRef(new Set())
  useEffect(() => {
    const alive = new Set(state.takes.map((t) => t.url).filter(Boolean))
    for (const url of takeUrlsRef.current) if (!alive.has(url)) URL.revokeObjectURL(url)
    takeUrlsRef.current = alive
  }, [state.takes])

  const audioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioCtxRef.current
  }, [])

  const removeRef = useCallback((speaker, key) => {
    const ref = stateRef.current.speakers.find((s) => s.id === speaker)?.refs.find((r) => r.key === key)
    if (ref?.url) URL.revokeObjectURL(ref.url)
    dispatch({ type: 'ref/remove', speaker, key })
  }, [])

  const removeSpeaker = useCallback((id) => {
    const speaker = stateRef.current.speakers.find((s) => s.id === id)
    speaker?.refs.forEach((r) => r.url && URL.revokeObjectURL(r.url))
    dispatch({ type: 'speaker/remove', id })
  }, [])

  // request：{ text, refs, params, stream, model, speakers:[{id,name}] }
  const generate = useCallback(
    async (request) => {
      if (stateRef.current.phase !== 'idle') return
      // 在使用者手勢內喚醒 AudioContext，串流第一段才能立刻出聲
      const ctx = request.stream ? audioContext() : null
      ctx?.resume()
      livePlayerRef.current?.stop()
      const controller = new AbortController()
      abortRef.current = controller
      dispatch({ type: 'gen/start' })
      const started = performance.now()
      const base = {
        createdAt: new Date(),
        model: request.model,
        text: request.text,
        speakers: request.speakers,
        request,
        streamed: request.stream,
      }
      try {
        if (!request.stream) {
          const result = await ttsWav(request, controller.signal)
          const take = {
            ...base,
            id: uid('t'),
            blob: result.blob,
            url: URL.createObjectURL(result.blob),
            elapsed: result.elapsed ?? (performance.now() - started) / 1000,
            audioSeconds: result.audioSeconds,
            requestId: result.requestId,
            earlyStop: result.earlyStop,
            chunks: result.chunks,
            status: 'done',
          }
          dispatch({ type: 'take/add', take })
          dispatch({ type: 'gen/end' })
          // 有 X-Chunks 就直接用；沒有（舊後端）才背景查 /v1/tts/last 補分段數，不擋使用者
          if (result.chunks !== null) return
          lastResultFor(result.requestId).then((last) => {
            if (last) {
              dispatch({
                type: 'take/update',
                id: take.id,
                patch: { chunks: last.chunks, earlyStop: result.earlyStop ?? last.early_stop },
              })
            }
          })
          return
        }

        const { body, sampleRate, requestId } = await ttsStream(request, controller.signal)
        const player = createPcmPlayer(ctx, sampleRate)
        livePlayerRef.current = player
        const id = uid('t')
        let added = false
        let status = 'done'
        const reader = body.getReader()
        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            player.feed(value)
            if (!added) {
              added = true
              dispatch({ type: 'take/add', take: { ...base, id, live: true, player, status: 'streaming' } })
              dispatch({ type: 'gen/streaming' })
            }
          }
        } catch (err) {
          status = controller.signal.aborted ? 'stopped' : 'interrupted'
          if (!controller.signal.aborted) console.warn('串流中斷', err)
        }
        player.finish()
        const bytes = player.drain()
        const elapsed = (performance.now() - started) / 1000
        if (bytes.byteLength === 0) {
          if (added) dispatch({ type: 'take/remove', id })
        } else {
          const blob = pcm16ToWav(bytes, sampleRate)
          const patch = {
            blob,
            url: URL.createObjectURL(blob),
            elapsed,
            audioSeconds: bytes.byteLength / 2 / sampleRate,
            requestId,
            status,
          }
          dispatch({ type: 'take/update', id, patch })
          // 串流結束（含提前中斷）後查結果；使用者自己按停止的不查
          if (status !== 'stopped') {
            lastResultFor(requestId).then((last) => {
              if (last) dispatch({ type: 'take/update', id, patch: { earlyStop: last.early_stop, chunks: last.chunks } })
            })
          }
        }
        dispatch({
          type: 'gen/end',
          error: status === 'interrupted' ? describeError({ error: 'stream_interrupted' }) : '',
          notice: status === 'stopped' ? '已停止產生' : '',
        })
      } catch (err) {
        if (err?.name === 'AbortError') {
          dispatch({ type: 'gen/end', notice: '已停止產生' })
        } else {
          dispatch({ type: 'gen/end', error: describeError(err), errorCode: err?.error ?? '' })
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        onChangedRef.current?.()
      }
    },
    [audioContext],
  )

  // 停止：中止 fetch（後端約 0.3 秒內釋放鎖），並讓已排程的串流音訊立刻靜音
  const stop = useCallback(() => {
    abortRef.current?.abort()
    livePlayerRef.current?.stop()
    onChangedRef.current?.()
  }, [])

  const exitRaw = useCallback(() => {
    const count = stateRef.current.rawText.split('\n').length
    dispatch({ type: 'raw/exit', keys: Array.from({ length: count }, () => uid('r')) })
  }, [])

  return { state, dispatch, generate, stop, removeRef, removeSpeaker, exitRaw, audioContext }
}
