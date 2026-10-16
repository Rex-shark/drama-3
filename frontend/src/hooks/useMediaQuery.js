import { useEffect, useState } from 'react'

// 依視口寬度回傳版面：wide（≥1280）、mid（768–1279）、narrow（<768），見 frontend/DESIGN.md Layout。
const QUERIES = { wide: '(min-width: 1280px)', mid: '(min-width: 768px)' }

function current() {
  if (typeof window === 'undefined') return 'wide'
  if (window.matchMedia(QUERIES.wide).matches) return 'wide'
  if (window.matchMedia(QUERIES.mid).matches) return 'mid'
  return 'narrow'
}

export function useLayout() {
  const [layout, setLayout] = useState(current)
  useEffect(() => {
    const lists = Object.values(QUERIES).map((q) => window.matchMedia(q))
    const onChange = () => setLayout(current())
    // 有些環境（裝置模擬、縮放）不一定送 matchMedia change，resize 一併監聽保險
    lists.forEach((l) => l.addEventListener('change', onChange))
    window.addEventListener('resize', onChange)
    return () => {
      lists.forEach((l) => l.removeEventListener('change', onChange))
      window.removeEventListener('resize', onChange)
    }
  }, [])
  return layout
}
