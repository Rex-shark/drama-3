// 取樣參數：temperature / top_p / top_k / max_tokens。能力 19。
// 版本切換時沒改過的欄位換成新版本預設，改過的保留（標 *）。
import { Slider } from './Bits'

export function SamplingPanel({ params, touched, defaults, defaultsFrom, dispatch, disabled }) {
  const set = (name) => (value) => dispatch({ type: 'params/set', name, value })
  const mark = (name) => (touched[name] ? ' *' : '')
  const anyTouched = Object.values(touched).some(Boolean)
  return (
    <div className="sampling">
      <Slider
        id="p-temperature"
        label={`溫度${mark('temperature')}`}
        value={params.temperature}
        min={0}
        max={2}
        step={0.05}
        format={(v) => v.toFixed(2)}
        onChange={set('temperature')}
        disabled={disabled}
      />
      <Slider
        id="p-top-p"
        label={`top_p${mark('top_p')}`}
        value={params.top_p}
        min={0.01}
        max={1}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={set('top_p')}
        disabled={disabled}
      />
      <Slider
        id="p-top-k"
        label={`top_k${mark('top_k')}`}
        value={params.top_k}
        min={1}
        max={200}
        step={1}
        onChange={set('top_k')}
        disabled={disabled}
      />
      <div className="field slider-field field-max-tokens">
        <label className="field-label" htmlFor="p-max-tokens">
          max_tokens{mark('max_tokens')}
        </label>
        <input
          id="p-max-tokens"
          className={`input input-data${Number.isInteger(params.max_tokens) && params.max_tokens >= 1 ? '' : ' is-error'}`}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          title="每個自動分段最多產生的 frame 數"
          value={Number.isNaN(params.max_tokens) ? '' : params.max_tokens}
          disabled={disabled}
          onChange={(e) => set('max_tokens')(e.target.value === '' ? NaN : Number(e.target.value))}
        />
      </div>
      <p className="meta sampling-meta">
        <span>{defaults ? `預設值取自 ${defaultsFrom ?? '—'}` : '尚未取得版本預設值'}{anyTouched ? '；* 為手動調整，切換版本時保留' : ''}</span>
        <button type="button" className="btn-text" onClick={() => dispatch({ type: 'params/reset' })} disabled={!defaults || !anyTouched || disabled}>
          重設為預設
        </button>
      </p>
    </div>
  )
}
