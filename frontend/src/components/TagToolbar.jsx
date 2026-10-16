// 標籤快捷：點狀標籤插入游標處、區間標籤包住選取範圍。能力 8、9。
import { useState } from 'react'
import { POINT_TAGS, RANGE_TAGS } from '../lib/script'

export function TagToolbar({ onInsert, disabled }) {
  const [custom, setCustom] = useState('')
  const tag = custom.trim().replace(/[[\]<>]/g, '')
  // onMouseDown 擋掉預設，保留文字框的焦點與選取範圍
  const keep = (e) => e.preventDefault()
  return (
    <div className="tag-toolbar" role="toolbar" aria-label="表演標籤">
      <span className="field-label">點狀</span>
      {POINT_TAGS.map((t) => (
        <button key={t} type="button" className="chip" onMouseDown={keep} onClick={() => onInsert(t, 'point')} disabled={disabled}>
          [{t}]
        </button>
      ))}
      <span className="field-label">區間</span>
      {RANGE_TAGS.map((t) => (
        <button key={t} type="button" className="chip" onMouseDown={keep} onClick={() => onInsert(t, 'range')} disabled={disabled}>
          &lt;{t}&gt;…
        </button>
      ))}
      <span className="tag-custom">
        <label className="visually-hidden" htmlFor="custom-tag">
          自訂標籤
        </label>
        <input
          id="custom-tag"
          className="input input-chip"
          placeholder="自訂標籤"
          value={custom}
          maxLength={40}
          onChange={(e) => setCustom(e.target.value)}
        />
        <button type="button" className="chip" onMouseDown={keep} onClick={() => onInsert(tag, 'point')} disabled={disabled || !tag}>
          插入 [ ]
        </button>
        <button type="button" className="chip" onMouseDown={keep} onClick={() => onInsert(tag, 'range')} disabled={disabled || !tag}>
          包住 &lt; &gt;
        </button>
      </span>
    </div>
  )
}
