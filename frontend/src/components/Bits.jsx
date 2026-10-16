// 小元件：面板標題、角色章、雙鈕開關、滑桿、下拉選單、狀態方塊。
import { Glyph } from './Glyph'

export function Panel({ en, zh, actions, className = '', children, id }) {
  return (
    <section className={`panel ${className}`} id={id} aria-label={zh}>
      <header className="panel-label">
        <h2 className="panel-title">
          <span className="label">{en}</span>
          <span className="label-cjk">{zh}</span>
        </h2>
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

export function SpeakerStamp({ id, active = false, onClick, title }) {
  const cls = `stamp${active ? ' is-active' : ''}`
  const label = id === null || id === undefined ? '?' : String(id)
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={active} title={title}>
        {label}
      </button>
    )
  }
  return (
    <span className={cls} title={title}>
      {label}
    </span>
  )
}

// 相鄰的方形文字鈕；選中的反白。options: [{ value, label }]
export function Segmented({ value, options, onChange, label, disabled = false }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`seg${value === o.value ? ' is-on' : ''}`}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({ id, label, value, min, max, step, format, onChange, disabled }) {
  const pct = ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100
  return (
    <div className="field slider-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ '--pct': `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output className="data slider-value" htmlFor={id}>
        {format ? format(value) : value}
      </output>
    </div>
  )
}

export function Select({ className = '', children, ...props }) {
  return (
    <span className={`select-wrap ${className}`}>
      <select className="select" {...props}>
        {children}
      </select>
      <Glyph name="down" className="select-arrow" />
    </span>
  )
}

// 處理中的 1Hz 閃爍方塊（reduced-motion 下改成靜態文字，見 CSS）
export function BusyMark() {
  return (
    <span className="busy-mark" aria-hidden="true">
      ▪
    </span>
  )
}
