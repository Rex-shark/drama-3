// 傳輸控制字形：1.5px 筆畫、方頭、16px 框，與品牌箭頭同一語言（frontend/DESIGN.md Shapes）。
// 不引入圖示庫；只有播放、停止、錄音、上移 / 下移、下拉箭頭。

const ARROW = (
  <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter">
    <path d="M2.5 8H13.5" />
    <path d="M9.5 4L13.5 8L9.5 12" />
  </g>
)

const SHAPES = {
  play: (
    <path d="M4.5 3L12.5 8L4.5 13Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" />
  ),
  stop: <rect x="3.5" y="3.5" width="9" height="9" fill="currentColor" />,
  rec: <rect x="4" y="4" width="8" height="8" fill="currentColor" />,
  up: <g transform="rotate(-90 8 8)">{ARROW}</g>,
  down: <g transform="rotate(90 8 8)">{ARROW}</g>,
}

export function Glyph({ name, className = '' }) {
  return (
    <svg className={`glyph ${className}`} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {SHAPES[name]}
    </svg>
  )
}
