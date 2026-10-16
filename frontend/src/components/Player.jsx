// 播放器：傳輸字形 + 1px 進度線 + 「00:12 / 00:47」。沒有音量鈕、沒有波形。
// 進度線沒有滑塊但可點可拖；hover 時在游標處顯示 1px × 8px 的墨色刻度（frontend/DESIGN.md player）。
// 一般模式用 <audio> 播 WAV Blob；live 模式顯示串流（Web Audio 排程）的進度。
import { useEffect, useRef, useState } from 'react'
import { formatTime } from '../lib/format'
import { Glyph } from './Glyph'

// 同一時間只播一個
let currentAudio = null

export function Player({ src, live, onStopLive, compact = false, label = '播放' }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [liveState, setLiveState] = useState(null) // { position, received, active }

  // live：每格畫面讀一次排程進度，直到不再出聲
  useEffect(() => {
    if (!live) return undefined
    let raf
    const step = () => {
      const active = live.isActive()
      setLiveState({ position: live.position(), received: live.receivedSeconds(), active })
      if (active) raf = requestAnimationFrame(step)
    }
    step()
    return () => cancelAnimationFrame(raf)
  }, [live])

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      if (audio && currentAudio === audio) currentAudio = null
      audio?.pause()
    }
  }, [])

  const isLive = Boolean(live && liveState?.active)

  if (isLive) {
    const pct = liveState.received ? (liveState.position / liveState.received) * 100 : 0
    return (
      <div className={`player${compact ? ' is-compact' : ''}`}>
        <button type="button" className="transport" onClick={onStopLive} aria-label="停止">
          <Glyph name="stop" />
        </button>
        <div className="progress" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="data player-time">
          {formatTime(liveState.position)} / {formatTime(liveState.received)}
        </span>
      </div>
    )
  }

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      audio.currentTime = 0
      return
    }
    if (currentAudio && currentAudio !== audio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
    }
    currentAudio = audio
    audio.play().catch(() => setPlaying(false))
  }

  const seek = (e) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    audio.currentTime = (Number(e.target.value) / 1000) * duration
  }

  const pct = duration ? (current / duration) * 1000 : 0
  return (
    <div className={`player${compact ? ' is-compact' : ''}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setCurrent(0)
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
      />
      <button type="button" className="transport" onClick={toggle} disabled={!src} aria-label={playing ? '停止' : label}>
        <Glyph name={playing ? 'stop' : 'play'} />
      </button>
      <span
        className="progress-wrap"
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          e.currentTarget.style.setProperty('--tick-x', `${e.clientX - box.left}px`)
        }}
      >
        <input
          type="range"
          className="progress-input"
          min="0"
          max="1000"
          step="1"
          value={Math.round(pct)}
          onChange={seek}
          disabled={!src || !duration}
          aria-label="播放進度"
          style={{ '--pct': `${pct / 10}%` }}
        />
      </span>
      <span className="data player-time">
        {formatTime(current)} / {formatTime(duration)}
      </span>
    </div>
  )
}
