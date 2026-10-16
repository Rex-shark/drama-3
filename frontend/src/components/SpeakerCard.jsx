// 單一角色：名稱、多段參考音檔（上傳或錄音）與逐字稿。能力 1、2、3。
import { useEffect, useRef, useState } from 'react'
import { formatTime } from '../lib/format'
import { createRecorder } from '../lib/recorder'
import { uid } from '../lib/uid'
import { fileToWav } from '../lib/wav'
import { SpeakerStamp } from './Bits'
import { Glyph } from './Glyph'
import { Player } from './Player'

const MAX_REF_SECONDS = 60
// 計時每 0.2 秒檢查一次，提前 0.5 秒停，避免停在 60.0–60.2 秒被後端拒收；recorder 另會裁到 60 秒整
const AUTO_STOP_SECONDS = MAX_REF_SECONDS - 0.5

function RefItem({ speaker, refItem, index, dispatch, onRemove, disabled }) {
  const tooLong = refItem.seconds > MAX_REF_SECONDS
  const missingText = refItem.status === 'ready' && !refItem.transcript.trim()
  const fieldId = `ref-${refItem.key}`
  return (
    <li className="ref-item">
      <div className="ref-head">
        <span className="data ref-index">#{index + 1}</span>
        <span className="body-sm ref-name" title={refItem.name}>
          {refItem.name}
        </span>
        <button type="button" className="btn-text" onClick={onRemove} disabled={disabled}>
          刪除
        </button>
      </div>
      {refItem.status === 'decoding' && <p className="meta">轉檔中…</p>}
      {refItem.status === 'error' && <p className="error-text">無法解碼這個檔案：{refItem.error}</p>}
      {refItem.status === 'ready' && (
        <>
          <div className="ref-player">
            <Player src={refItem.url} compact label="試聽" />
          </div>
          <p className="meta ref-meta">
            <span className={tooLong ? 'is-error-text' : ''}>{refItem.seconds.toFixed(1)} 秒</span>
            <span>{(refItem.sampleRate / 1000).toFixed(1)} kHz · 16-bit WAV</span>
          </p>
          {tooLong && (
            <p className="error-text">
              這段長 {refItem.seconds.toFixed(1)} 秒，超過上限 {MAX_REF_SECONDS} 秒，請裁短後再上傳（建議 10–30 秒）。
            </p>
          )}
        </>
      )}
      <label className="field-label" htmlFor={fieldId}>
        逐字稿
      </label>
      <textarea
        id={fieldId}
        className={`input textarea-sm${missingText ? ' is-error' : ''}`}
        rows={2}
        value={refItem.transcript}
        placeholder="這段音檔說了什麼，一字不差"
        disabled={disabled}
        onChange={(e) =>
          dispatch({ type: 'ref/update', speaker: speaker.id, key: refItem.key, patch: { transcript: e.target.value } })
        }
      />
      {missingText && <p className="error-text">請填寫逐字稿，模型靠它對齊聲音。</p>}
    </li>
  )
}

function Recorder({ onDone, disabled }) {
  const recRef = useRef(null)
  const stopRef = useRef(null)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => () => recRef.current?.cancel(), [])

  // 錄音中每 0.2 秒更新秒數；到 59.5 秒自動停止
  useEffect(() => {
    if (!recording) return undefined
    const timer = setInterval(() => {
      const s = recRef.current?.elapsed() ?? 0
      setSeconds(s)
      if (s >= AUTO_STOP_SECONDS) stopRef.current?.()
    }, 200)
    return () => clearInterval(timer)
  }, [recording])

  async function start() {
    setError('')
    try {
      const rec = createRecorder({ maxSeconds: MAX_REF_SECONDS })
      await rec.start()
      recRef.current = rec
      setSeconds(0)
      setRecording(true)
    } catch (err) {
      setError(`無法開始錄音：${err?.message ?? err}`)
    }
  }

  async function stop() {
    const rec = recRef.current
    if (!rec) return
    recRef.current = null
    setRecording(false)
    const result = await rec.stop()
    if (result.seconds > 0) onDone(result)
  }
  useEffect(() => {
    stopRef.current = stop
  })

  return (
    <>
      {!recording ? (
        <button type="button" className="btn-outline btn-rec" onClick={start} disabled={disabled} aria-label="錄音">
          <Glyph name="rec" />
          <span className="data">REC</span>
          <span>錄音</span>
        </button>
      ) : (
        <button type="button" className="btn-outline btn-rec is-recording" onClick={stop} aria-label="停止錄音">
          <Glyph name="stop" />
          <span className="data">{formatTime(seconds)}</span>
          <span>停止錄音</span>
        </button>
      )}
      {error && <p className="error-text dropzone-error">{error}</p>}
    </>
  )
}

export function SpeakerCard({ speaker, active, onSelect, dispatch, onRemoveRef, onRemoveSpeaker, usedRows, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const nameId = `speaker-name-${speaker.id}`

  async function addFiles(files) {
    for (const file of files) {
      const key = uid('a')
      dispatch({
        type: 'ref/add',
        speaker: speaker.id,
        ref: { key, name: file.name, status: 'decoding', transcript: '', seconds: 0 },
      })
      try {
        const wav = await fileToWav(file)
        dispatch({
          type: 'ref/update',
          speaker: speaker.id,
          key,
          patch: { ...wav, url: URL.createObjectURL(wav.blob), status: 'ready', name: file.name.replace(/\.[^.]+$/, '') + '.wav' },
        })
      } catch (err) {
        dispatch({ type: 'ref/update', speaker: speaker.id, key, patch: { status: 'error', error: err?.message ?? String(err) } })
      }
    }
  }

  function addRecording(result) {
    dispatch({
      type: 'ref/add',
      speaker: speaker.id,
      ref: {
        key: uid('a'),
        name: `錄音-${new Date().toLocaleTimeString('zh-TW', { hour12: false })}.wav`,
        status: 'ready',
        transcript: '',
        ...result,
        url: URL.createObjectURL(result.blob),
      },
    })
  }

  function confirmRemove() {
    const hint = usedRows ? `有 ${usedRows} 行劇本使用這個角色，刪除後要重新指定。` : ''
    if (window.confirm(`刪除「${speaker.name}」與它的參考音檔？${hint}`)) onRemoveSpeaker(speaker.id)
  }

  return (
    <article className={`speaker-card${active ? ' is-active' : ''}`} onFocusCapture={onSelect} onPointerDown={onSelect}>
      <div className="speaker-head">
        <SpeakerStamp id={speaker.id} active={active} />
        <label className="visually-hidden" htmlFor={nameId}>
          角色名稱
        </label>
        <input
          id={nameId}
          className="input speaker-name"
          value={speaker.name}
          maxLength={24}
          onChange={(e) => dispatch({ type: 'speaker/rename', id: speaker.id, name: e.target.value })}
        />
        <button type="button" className="btn-text" onClick={confirmRemove} disabled={disabled}>
          刪除角色
        </button>
      </div>
      {speaker.refs.length === 0 && <p className="body-sm muted">沒有參考音檔時由模型自行配音。</p>}
      {speaker.refs.length > 0 && (
        <ol className="ref-list">
          {speaker.refs.map((r, i) => (
            <RefItem
              key={r.key}
              speaker={speaker}
              refItem={r}
              index={i}
              dispatch={dispatch}
              onRemove={() => onRemoveRef(speaker.id, r.key)}
              disabled={disabled}
            />
          ))}
        </ol>
      )}
      <div
        className={`dropzone${dragging ? ' is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith('audio/') || /\.(wav|mp3|m4a|flac|ogg|aac|webm)$/i.test(f.name)))
        }}
      >
        <p className="body-sm">拖放參考音檔到這裡（任何格式，建議 10–30 秒清晰人聲，上限 60 秒）</p>
        <div className="dropzone-actions">
          <button type="button" className="btn-outline" onClick={() => inputRef.current?.click()} disabled={disabled}>
            上傳音檔
          </button>
          <Recorder onDone={addRecording} disabled={disabled} />
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg"
          multiple
          hidden
          onChange={(e) => {
            addFiles([...e.target.files])
            e.target.value = ''
          }}
        />
      </div>
    </article>
  )
}
