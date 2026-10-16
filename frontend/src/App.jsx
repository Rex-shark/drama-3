// DRAMA 3 工作台：角色 → 劇本 → 產生與輸出（frontend/DESIGN.md Layout）。
import { useEffect, useRef, useState } from 'react'
import './App.css'
import { Segmented } from './components/Bits'
import { BackendStatus, ModelSelector } from './components/ModelSelector'
import { OutputPanel } from './components/OutputPanel'
import { ScriptEditor } from './components/ScriptEditor'
import { SpeakerPanel } from './components/SpeakerPanel'
import { useBackend } from './hooks/useBackend'
import { useLayout } from './hooks/useMediaQuery'
import { useStudio } from './hooks/useStudio'
import { useTheme } from './hooks/useTheme'
import { collectIssues, speakersInText } from './lib/script'

const flat = (s) => s.replace(/\s*\n\s*/g, ' ').trim()

function blockReasonOf(backend) {
  const { health, connected, loadingId } = backend
  if (connected === null) return '連線中'
  if (!connected) return '後端未連線，請先啟動後端'
  if (loadingId || health?.busy_reason === 'loading' || health?.busy_reason === 'unloading') return '切換模型中，請稍候'
  if (health?.busy) return '後端忙碌中，請稍候'
  if (!health?.loaded) return '尚未載入模型版本，請先在頁首載入'
  return ''
}

export default function App() {
  const layout = useLayout()
  const [theme, setTheme] = useTheme()
  const pokeRef = useRef(null)
  const studio = useStudio({ onBackendChanged: () => pokeRef.current?.() })
  const { state, dispatch } = studio
  const generating = state.phase !== 'idle'
  const backend = useBackend({ active: generating })
  const [picked, setPicked] = useState(null)
  const [showIssues, setShowIssues] = useState(false)
  const [tab, setTab] = useState(() => {
    // 手機分頁；?tab=speakers|script|output 可指定初始分頁（截圖用）
    const fromUrl = new URLSearchParams(window.location.search).get('tab')
    return ['speakers', 'script', 'output'].includes(fromUrl) ? fromUrl : 'script'
  })

  useEffect(() => {
    pokeRef.current = backend.poke
  })

  // 開發用示範狀態：?demo（?demo=early 讓最新 take 顯示提前中斷提示）
  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).get('demo')
    if (import.meta.env.DEV && demo !== null) {
      import('./lib/demo').then((m) => dispatch({ type: 'demo/load', state: m.buildDemoState({ early: demo === 'early' }) }))
    }
  }, [dispatch])

  // 版本下拉：使用者挑的 > 已載入的 > 建議的 8bit
  const { health, models } = backend
  const loaded = health?.loaded ?? null
  const recommended = (models.find((m) => m.id === '8bit' && m.available) ?? models.find((m) => m.available))?.id ?? null
  const selected = picked ?? loaded ?? recommended

  // 取樣預設跟著「實際生效」的版本：已載入 > 載入中 > 下拉選的
  const defaultsFrom = loaded ?? health?.busy_target ?? selected
  const defaultsModel = models.find((m) => m.id === defaultsFrom)
  const defaultsKey = defaultsModel ? JSON.stringify(defaultsModel.defaults) : ''
  useEffect(() => {
    if (defaultsKey) dispatch({ type: 'params/defaults', defaults: JSON.parse(defaultsKey) })
  }, [defaultsFrom, defaultsKey, dispatch])

  // 409 的「後端忙碌中」在後端 busy 由 true 變 false 時收掉，避免殘留過時訊息
  const busy = Boolean(health?.busy)
  const wasBusy = useRef(busy)
  useEffect(() => {
    if (wasBusy.current && !busy) dispatch({ type: 'error/clearBusy' })
    wasBusy.current = busy
  }, [busy, dispatch])

  const blockReason = blockReasonOf(backend)
  const check = () =>
    collectIssues({
      rawMode: state.rawMode,
      rawText: state.rawText,
      rows: state.rows,
      speakers: state.speakers,
      params: state.params,
    })
  const liveIssues = showIssues ? check().issues : []

  function onGenerate() {
    const { issues, text } = check()
    if (issues.length) {
      setShowIssues(true)
      return
    }
    setShowIssues(false)
    const used = speakersInText(text)
    const speakers = state.speakers.filter((s) => used.includes(s.id))
    studio.generate({
      text,
      refs: speakers.flatMap((s) =>
        s.refs.map((r) => ({ blob: r.blob, name: r.name, transcript: flat(r.transcript), speaker: s.id })),
      ),
      params: { ...state.params },
      stream: state.stream,
      model: loaded,
      speakers: used.map((id) => ({ id, name: state.speakers.find((s) => s.id === id)?.name ?? `角色 ${id}` })),
    })
    if (layout === 'narrow') setTab('output')
  }

  function onRegenerate(take) {
    if (!take.request) return onGenerate()
    studio.generate({ ...take.request, model: loaded })
  }

  const speakerPanel = (
    <SpeakerPanel
      state={state}
      dispatch={dispatch}
      removeRef={studio.removeRef}
      removeSpeaker={studio.removeSpeaker}
      layout={layout === 'mid' ? 'strip' : 'column'}
      disabled={generating}
    />
  )
  const scriptPanel = <ScriptEditor state={state} dispatch={dispatch} exitRaw={studio.exitRaw} />
  const outputPanel = (
    <OutputPanel
      state={state}
      dispatch={dispatch}
      onGenerate={onGenerate}
      onRegenerate={onRegenerate}
      onStop={studio.stop}
      blockReason={blockReason}
      issues={liveIssues}
      defaultsFrom={defaultsModel ? defaultsFrom : null}
    />
  )

  return (
    <div className={`app layout-${layout}`}>
      <header className="app-header">
        <h1 className="title press">DRAMA 3 工作台</h1>
        <div className="header-tools">
          <ModelSelector backend={backend} selected={selected} onSelect={setPicked} generating={generating} />
          <BackendStatus backend={backend} generating={generating} />
          <Segmented
            label="主題"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'auto', label: '自動' },
              { value: 'light', label: '亮' },
              { value: 'dark', label: '暗' },
            ]}
          />
        </div>
      </header>
      {health?.mock && (
        <p className="mock-banner" role="note">
          <span className="label">模擬後端</span>
          <span className="body-sm">目前接的是模擬後端，產生的是測試音，不是模型推理結果</span>
        </p>
      )}

      {layout === 'narrow' && (
        <nav className="tabs" role="tablist" aria-label="面板">
          {[
            ['speakers', '角色'],
            ['script', '劇本'],
            ['output', '輸出'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`tab${tab === id ? ' is-on' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}

      <main className="workbench">
        {layout === 'wide' && (
          <>
            {speakerPanel}
            {scriptPanel}
            {outputPanel}
          </>
        )}
        {layout === 'mid' && (
          <>
            {speakerPanel}
            <div className="mid-columns">
              {scriptPanel}
              {outputPanel}
            </div>
          </>
        )}
        {layout === 'narrow' && (
          <>
            {tab === 'speakers' && speakerPanel}
            {tab === 'script' && scriptPanel}
            {tab === 'output' && outputPanel}
          </>
        )}
      </main>

      <footer className="app-footer meta">
        <span>Built with Fish Audio</span>
        <span>Fish Audio Drama 3 · Fish Audio Community License · 本機自用工具</span>
      </footer>
    </div>
  )
}
