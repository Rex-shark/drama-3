// 產生與輸出：取樣參數、串流開關、產生 / 停止、錯誤、最新 take 卡紙（窗光只在這裡）、歷史 take。能力 18、19。
import { formatClock, formatSeconds } from '../lib/format'
import { scriptSummary } from '../lib/script'
import { BusyMark, Panel, Segmented } from './Bits'
import { Glyph } from './Glyph'
import { Player } from './Player'
import { SamplingPanel } from './SamplingPanel'
import { DownloadLink, TakeSheet } from './TakeSheet'

export function OutputPanel({
  state,
  dispatch,
  onGenerate,
  onRegenerate,
  onStop,
  blockReason,
  issues,
  defaultsFrom,
}) {
  const { params, touched, defaults, stream, phase, error, notice, takes } = state
  const generating = phase !== 'idle'
  const [latest, ...history] = takes
  const phaseText = phase === 'streaming' ? '串流中' : phase === 'requesting' ? (stream ? '等待第一段' : '產生中') : ''

  return (
    <Panel en="OUTPUT" zh="產生與輸出" className="panel-output">
      <SamplingPanel
        params={params}
        touched={touched}
        defaults={defaults}
        defaultsFrom={defaultsFrom}
        dispatch={dispatch}
        disabled={generating}
      />
      <div className="field toggle-field">
        <span className="field-label">串流</span>
        <Segmented
          label="串流輸出"
          value={stream}
          disabled={generating}
          options={[
            { value: false, label: '關' },
            { value: true, label: '開' },
          ]}
          onChange={(v) => dispatch({ type: 'stream/set', value: v })}
        />
        <span className="meta">{stream ? '收到第一段就開始播放' : '產生完成後一次播放'}</span>
      </div>

      <div className="generate-row">
        <button type="button" className="btn-primary" onClick={onGenerate} disabled={Boolean(blockReason) || generating}>
          產生
        </button>
        {generating && (
          <button type="button" className="btn-outline btn-stop" onClick={onStop}>
            <Glyph name="stop" />
            停止
          </button>
        )}
        <p className="meta status-line" role="status" aria-live="polite">
          {generating ? (
            <>
              {phaseText}
              <BusyMark />
            </>
          ) : (
            blockReason || '就緒'
          )}
        </p>
      </div>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="meta status-line">{notice}</p>}
      {issues.length > 0 && (
        <ul className="issue-list" role="alert" aria-label="送出前需要修正">
          {issues.map((msg) => (
            <li key={msg} className="error-text">
              {msg}
            </li>
          ))}
        </ul>
      )}

      <div className={`take-area${latest ? '' : ' is-empty'}`}>
        {latest ? (
          <TakeSheet
            key={latest.id}
            take={latest}
            number={latest.number}
            onRegenerate={() => onRegenerate(latest)}
            onStopLive={onStop}
            canRegenerate={!blockReason && !generating}
          />
        ) : (
          <p className="body-sm muted take-empty">還沒有產生任何 take。寫好劇本、載入版本後按「產生」。</p>
        )}
      </div>

      {history.length > 0 && (
        <section className="history" aria-label="先前的 take">
          <h3 className="field-label history-title">先前的 take</h3>
          <ol className="history-list">
            {history.map((t) => (
              <li key={t.id} className="history-row">
                <div className="history-head">
                  <span className="data">#{String(t.number).padStart(2, '0')}</span>
                  <span className="meta">
                    {formatClock(t.createdAt)} · {t.model ?? '—'} · {formatSeconds(t.audioSeconds)}
                  </span>
                </div>
                <p className="body-sm history-text">{scriptSummary(t.text)}</p>
                {t.earlyStop && <p className="error-text">長時間無聲，已自動停止</p>}
                <div className="history-actions">
                  <Player src={t.url} compact />
                  <DownloadLink take={t}>下載</DownloadLink>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </Panel>
  )
}
