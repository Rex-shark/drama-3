// 角色面板：最多 16 個角色，自動配 0–15 編號，用角色章（方形編號章）區分，不用顏色。
// layout = column（寬版與手機分頁）或 strip（中寬：頂端橫向列，點章展開編輯）。
import { useState } from 'react'
import { MAX_SPEAKERS } from '../lib/script'
import { Panel, SpeakerStamp } from './Bits'
import { SpeakerCard } from './SpeakerCard'

export function SpeakerPanel({ state, dispatch, removeRef, removeSpeaker, layout, disabled }) {
  const [openId, setOpenId] = useState(null)
  const { speakers, activeSpeaker, rows } = state
  const full = speakers.length >= MAX_SPEAKERS
  const usedRows = (id) => rows.filter((r) => r.speaker === id).length

  const addButton = (
    <button type="button" className="btn-outline" onClick={() => dispatch({ type: 'speaker/add' })} disabled={full}>
      新增角色
    </button>
  )
  const card = (s) => (
    <SpeakerCard
      key={s.id}
      speaker={s}
      active={s.id === activeSpeaker}
      onSelect={() => s.id !== activeSpeaker && dispatch({ type: 'speaker/select', id: s.id })}
      dispatch={dispatch}
      onRemoveRef={removeRef}
      onRemoveSpeaker={removeSpeaker}
      usedRows={usedRows(s.id)}
      disabled={disabled}
    />
  )

  if (layout === 'strip') {
    const open = speakers.find((s) => s.id === openId)
    return (
      <Panel en="SPEAKERS" zh="角色" className="panel-speakers is-strip" actions={addButton}>
        <div className="speaker-strip" role="list">
          {speakers.map((s) => (
            <button
              key={s.id}
              type="button"
              role="listitem"
              className={`strip-item${openId === s.id ? ' is-open' : ''}`}
              aria-expanded={openId === s.id}
              onClick={() => {
                setOpenId(openId === s.id ? null : s.id)
                dispatch({ type: 'speaker/select', id: s.id })
              }}
            >
              <SpeakerStamp id={s.id} active={s.id === activeSpeaker} />
              <span className="strip-name">{s.name || `角色 ${s.id}`}</span>
              <span className="meta">{s.refs.length ? `${s.refs.length} 段` : '無參考'}</span>
            </button>
          ))}
          {full && <span className="meta">已達 16 個角色上限</span>}
        </div>
        {open && <div className="strip-editor">{card(open)}</div>}
      </Panel>
    )
  }

  return (
    <Panel en="SPEAKERS" zh="角色" className="panel-speakers" actions={addButton}>
      <div className="speaker-list">{speakers.map(card)}</div>
      <p className="meta speaker-count">
        {speakers.length} / {MAX_SPEAKERS} 個角色
      </p>
    </Panel>
  )
}
