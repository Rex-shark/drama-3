// 劇本編輯器：以「行」為單位，每行 = 角色 + 風格前綴 + 台詞 + 導演筆記。能力 5、10、11。
// 使用者不手打 <|speaker:N|>；原始模式可看 / 編輯組好的純文字。
import { useEffect, useLayoutEffect, useRef } from 'react'
import { utf8Bytes } from '../lib/format'
import { composeScript, insertTag } from '../lib/script'
import { uid } from '../lib/uid'
import { Panel, Segmented, Select, SpeakerStamp } from './Bits'
import { Glyph } from './Glyph'
import { TagToolbar } from './TagToolbar'

function ScriptRow({ row, index, count, speakers, dispatch, onFocusField, onEnter, registerRef }) {
  const speaker = speakers.find((s) => s.id === row.speaker)
  const update = (patch) => dispatch({ type: 'row/update', key: row.key, patch })
  const textId = `row-text-${row.key}`
  const focus = (field) => (e) => onFocusField({ el: e.target, key: row.key, field })
  return (
    <li className="script-row">
      <div className="row-main">
        <SpeakerStamp id={row.speaker} title={speaker ? speaker.name : '角色已刪除'} />
        <Select
          className="row-speaker"
          aria-label={`第 ${index + 1} 行角色`}
          value={speaker ? String(row.speaker) : ''}
          onChange={(e) => update({ speaker: Number(e.target.value) })}
        >
          {!speaker && <option value="">（已刪除）</option>}
          {speakers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} · {s.name || `角色 ${s.id}`}
            </option>
          ))}
        </Select>
        <label className="visually-hidden" htmlFor={textId}>
          第 {index + 1} 行台詞
        </label>
        <textarea
          id={textId}
          ref={(el) => registerRef(row.key, el)}
          className="input textarea-script row-text"
          rows={1}
          value={row.text}
          placeholder="台詞"
          onFocus={focus('text')}
          onSelect={focus('text')}
          onChange={(e) => update({ text: e.target.value })}
          onKeyDown={(e) => {
            // Enter 新增下一行（同角色）；Shift+Enter 也不換行，避免打斷「每行一個角色標籤」的結構
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              onEnter(row)
            }
          }}
        />
        <div className="row-actions">
          <button type="button" className="btn-text" aria-expanded={row.expanded} onClick={() => update({ expanded: !row.expanded })}>
            {row.expanded ? '收合' : '展開'}
            {(row.style || row.direction) && !row.expanded ? ' *' : ''}
          </button>
          <span className="row-hover">
            <button
              type="button"
              className="btn-glyph"
              aria-label="上移"
              title="上移"
              disabled={index === 0}
              onClick={() => dispatch({ type: 'row/move', key: row.key, delta: -1 })}
            >
              <Glyph name="up" />
            </button>
            <button
              type="button"
              className="btn-glyph"
              aria-label="下移"
              title="下移"
              disabled={index === count - 1}
              onClick={() => dispatch({ type: 'row/move', key: row.key, delta: 1 })}
            >
              <Glyph name="down" />
            </button>
            <button type="button" className="btn-text" onClick={() => dispatch({ type: 'row/remove', key: row.key })}>
              刪除
            </button>
          </span>
        </div>
      </div>
      {row.expanded && (
        <div className="row-extra">
          <div className="field">
            <label className="field-label" htmlFor={`row-style-${row.key}`}>
              風格前綴
            </label>
            <input
              id={`row-style-${row.key}`}
              className="input"
              value={row.style}
              placeholder="例：疲憊而溫柔、with bright eager excitement"
              onFocus={focus('style')}
              onChange={(e) => update({ style: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor={`row-direction-${row.key}`}>
              導演筆記
            </label>
            <input
              id={`row-direction-${row.key}`}
              className="input"
              value={row.direction}
              placeholder="例：像在深夜廣播，語速慢，帶一點倦意"
              onFocus={focus('direction')}
              onChange={(e) => update({ direction: e.target.value })}
            />
          </div>
        </div>
      )}
    </li>
  )
}

export function ScriptEditor({ state, dispatch, exitRaw }) {
  const { rows, speakers, rawMode, rawText, rawError } = state
  const lastField = useRef(null)
  const rowRefs = useRef(new Map())
  const pendingFocus = useRef(null)
  const rawRef = useRef(null)
  const pendingSelection = useRef(null) // { el, start, end }：插入標籤後要還原的游標

  // 受控欄位重設 value 後游標會跑到尾端；在畫面更新後（layout effect）把游標放回標籤內
  useLayoutEffect(() => {
    const sel = pendingSelection.current
    if (!sel) return
    pendingSelection.current = null
    sel.el?.focus()
    sel.el?.setSelectionRange(sel.start, sel.end)
  }, [rows, rawText])

  useEffect(() => {
    if (!pendingFocus.current) return
    rowRefs.current.get(pendingFocus.current)?.focus()
    pendingFocus.current = null
  }, [rows])

  const registerRef = (key, el) => {
    if (el) rowRefs.current.set(key, el)
    else rowRefs.current.delete(key)
  }

  const addRow = (after, speaker) => {
    const key = uid('r')
    pendingFocus.current = key
    dispatch({ type: 'row/add', after, speaker, key })
  }

  // 標籤插到最後聚焦的文字框游標處；沒有就插到最後一行台詞尾端
  function onInsert(tag, kind) {
    if (!tag) return
    if (rawMode) {
      const el = rawRef.current
      const next = insertTag(rawText, el?.selectionStart ?? rawText.length, el?.selectionEnd ?? rawText.length, tag, kind)
      pendingSelection.current = { el, start: next.start, end: next.end }
      dispatch({ type: 'raw/edit', text: next.value })
      return
    }
    let target = lastField.current
    if (!target || !rows.some((r) => r.key === target.key) || !target.el.isConnected) {
      const last = rows[rows.length - 1]
      if (!last) return
      target = { el: rowRefs.current.get(last.key), key: last.key, field: 'text' }
    }
    const row = rows.find((r) => r.key === target.key)
    const value = row[target.field] ?? ''
    const el = target.el
    const start = el && document.activeElement === el ? el.selectionStart : value.length
    const end = el && document.activeElement === el ? el.selectionEnd : value.length
    const next = insertTag(value, start, end, tag, kind)
    pendingSelection.current = { el, start: next.start, end: next.end }
    dispatch({ type: 'row/update', key: row.key, patch: { [target.field]: next.value } })
  }

  const text = rawMode ? rawText : composeScript(rows)
  const lineCount = rawMode ? text.split('\n').filter((l) => l.trim()).length : rows.length

  const modeToggle = (
    <Segmented
      label="編輯模式"
      value={rawMode}
      options={[
        { value: false, label: '劇本行' },
        { value: true, label: '原始' },
      ]}
      onChange={(raw) => (raw ? dispatch({ type: 'raw/enter' }) : exitRaw())}
    />
  )

  return (
    <Panel en="SCRIPT" zh="劇本" className="panel-script" actions={modeToggle}>
      <TagToolbar onInsert={onInsert} />
      {rawMode ? (
        <div className="raw-mode">
          <p className="body-sm muted">
            組好的純文字（spec 第四節語法）。可直接編輯，產生時以這段文字為準；切回「劇本行」會轉回各行。
          </p>
          <label className="visually-hidden" htmlFor="raw-text">
            原始文字
          </label>
          <textarea
            id="raw-text"
            ref={rawRef}
            className={`input textarea-script raw-text${rawError ? ' is-error' : ''}`}
            value={rawText}
            spellCheck={false}
            onChange={(e) => dispatch({ type: 'raw/edit', text: e.target.value })}
          />
          {rawError && (
            <div className="raw-error">
              <p className="error-text">{rawError}</p>
              <button type="button" className="btn-outline" onClick={() => dispatch({ type: 'raw/discard' })}>
                放棄原始修改
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {rows.length === 0 && <p className="body-sm muted empty">還沒有台詞。新增一行開始寫劇本。</p>}
          <ol className="script-rows">
            {rows.map((row, i) => (
              <ScriptRow
                key={row.key}
                row={row}
                index={i}
                count={rows.length}
                speakers={speakers}
                dispatch={dispatch}
                registerRef={registerRef}
                onFocusField={(f) => (lastField.current = f)}
                onEnter={(r) => addRow(r.key, r.speaker)}
              />
            ))}
          </ol>
          <div className="script-foot">
            <button type="button" className="btn-outline" onClick={() => addRow(undefined, undefined)} disabled={speakers.length === 0}>
              新增一行
            </button>
          </div>
        </>
      )}
      <p className="meta status-line script-meta">
        {lineCount} 行 · {utf8Bytes(text)} bytes · 約每 300 bytes 自動分一段
      </p>
    </Panel>
  )
}
