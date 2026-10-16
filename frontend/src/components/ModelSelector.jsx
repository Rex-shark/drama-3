// 版本選擇：列三版本，未下載者不可選；切換是明確動作（按鈕 + 確認），切換中以 busy_reason / busy_target 為準。
import { useState } from 'react'
import { BusyMark, Select } from './Bits'

export function ModelSelector({ backend, selected, onSelect, generating }) {
  const { health, connected, models, loadingId, modelError, load, unload } = backend
  const [confirming, setConfirming] = useState(false)
  const loaded = health?.loaded ?? null
  const busy = Boolean(health?.busy) || Boolean(loadingId) || generating
  const switching = health?.busy_reason === 'loading' || health?.busy_reason === 'unloading' || Boolean(loadingId)
  const selectedModel = models.find((m) => m.id === selected)
  const canLoad = connected && !busy && selectedModel?.available && selected !== loaded

  return (
    <div className="model-selector">
      <span className="field-label">模型版本</span>
      <Select
        aria-label="模型版本"
        value={selected ?? ''}
        disabled={busy || !models.length}
        onChange={(e) => {
          onSelect(e.target.value)
          setConfirming(false)
        }}
      >
        {!models.length && <option value="">—</option>}
        {models.map((m) => (
          <option key={m.id} value={m.id} disabled={!m.available}>
            {m.name}
            {m.available ? '' : '（未下載）'}
          </option>
        ))}
      </Select>
      {confirming ? (
        <span className="confirm">
          <span className="body-sm">
            {loaded ? `先卸載 ${loaded} 再載入 ${selected}` : `載入 ${selected}`}，約需數十秒，期間無法產生。
          </span>
          <button
            type="button"
            className="btn-outline"
            disabled={!canLoad}
            onClick={async () => {
              setConfirming(false)
              await load(selected)
              onSelect(null) // 載入結束後下拉回到「跟著已載入的版本」
            }}
          >
            確定
          </button>
          <button type="button" className="btn-text" onClick={() => setConfirming(false)}>
            取消
          </button>
        </span>
      ) : (
        <button type="button" className="btn-outline" disabled={!canLoad} onClick={() => setConfirming(true)}>
          {loaded ? '切換' : '載入'}
        </button>
      )}
      {loaded && !confirming && (
        <button type="button" className="btn-text" disabled={busy} onClick={unload}>
          卸載
        </button>
      )}
      {switching && <span className="visually-hidden">切換中</span>}
      {modelError && <p className="error-text model-error">{modelError}</p>}
    </div>
  )
}

// 頁首狀態列：meta 文字表達狀態，不用顏色
export function BackendStatus({ backend, generating }) {
  const { health, connected, loadingId } = backend
  let text
  let working = false
  if (connected === null) text = '連線中'
  else if (!connected) text = '後端未連線'
  else if (health?.busy_reason === 'loading' || (loadingId && loadingId !== 'unload')) {
    text = `切換中：載入 ${health?.busy_target ?? loadingId}`
    working = true
  } else if (health?.busy_reason === 'unloading' || loadingId === 'unload') {
    text = '卸載中'
    working = true
  } else if (health?.busy_reason === 'generating' || generating) {
    text = `產生中 · ${health?.loaded ?? '—'}`
    working = true
  } else if (health?.loaded) text = `已載入 ${health.loaded}`
  else text = '未載入模型'
  return (
    <p className="meta status-line header-status" role="status" aria-live="polite">
      {text}
      {working && <BusyMark />}
    </p>
  )
}
