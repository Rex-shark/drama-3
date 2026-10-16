// 產出的 take：唯一有厚度與陰影的卡紙（frontend/DESIGN.md take-sheet）。
import { fileStamp, formatClock, formatSeconds } from '../lib/format'
import { scriptSummary } from '../lib/script'
import { SpeakerStamp } from './Bits'
import { Player } from './Player'

const STATUS = {
  streaming: '串流中',
  done: '',
  stopped: '已停止（保留已收到的部分）',
  interrupted: '產生中斷（保留已收到的部分）',
}

export function TakeMeta({ take }) {
  const rtf = take.audioSeconds && take.elapsed ? take.audioSeconds / take.elapsed : null
  return (
    <p className="meta take-meta">
      <span>{formatClock(take.createdAt)}</span>
      <span>{take.model ?? '—'}</span>
      <span>{take.streamed ? '串流' : '非串流'}</span>
      {take.audioSeconds ? <span>音訊 {formatSeconds(take.audioSeconds)}</span> : null}
      {take.elapsed ? <span>耗時 {formatSeconds(take.elapsed)}</span> : null}
      {take.chunks ? <span>{take.chunks} 段</span> : null}
      {rtf ? <span>{rtf.toFixed(2)}× 即時</span> : null}
    </p>
  )
}

export function DownloadLink({ take, children = '下載 WAV' }) {
  if (!take.url) {
    return (
      <button type="button" className="btn-outline" disabled>
        {children}
      </button>
    )
  }
  return (
    <a className="btn-outline" href={take.url} download={`drama3-${fileStamp(take.createdAt)}.wav`}>
      {children}
    </a>
  )
}

export function TakeSheet({ take, number, onRegenerate, onStopLive, canRegenerate }) {
  return (
    <article className="take-sheet" aria-label={`第 ${number} 次產生`}>
      <header className="take-head">
        <span className="label take-label">TAKE {String(number).padStart(2, '0')}</span>
        <span className="take-stamps">
          {take.speakers.map((s) => (
            <SpeakerStamp key={s.id} id={s.id} title={s.name} />
          ))}
        </span>
      </header>
      <p className="take-text">{scriptSummary(take.text)}</p>
      <div className="take-rule" />
      <Player src={take.url} live={take.live ? take.player : null} onStopLive={onStopLive} />
      {STATUS[take.status] && <p className="meta take-status">{STATUS[take.status]}</p>}
      {take.earlyStop ? (
        // 提前中斷（後端偵測到長時間無聲而自動停止：尾端靜音或開頭無聲）：校對紅筆文字 + 緊鄰的「重新產生」，排在下載之前
        <div className="take-warning">
          <p className="error-text" role="alert">
            偵測到長時間無聲，已自動停止；若內容不完整請重新產生
          </p>
          <div className="take-actions">
            <button type="button" className="btn-outline" onClick={onRegenerate} disabled={!canRegenerate}>
              重新產生
            </button>
            <DownloadLink take={take} />
          </div>
        </div>
      ) : (
        <div className="take-actions">
          <DownloadLink take={take} />
          <button type="button" className="btn-outline" onClick={onRegenerate} disabled={!canRegenerate}>
            重新產生
          </button>
        </div>
      )}
      <TakeMeta take={take} />
    </article>
  )
}
