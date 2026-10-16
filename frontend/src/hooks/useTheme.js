import { useEffect, useState } from 'react'

// 主題：auto（跟隨系統）、light、dark。可用 ?theme=dark 指定（截圖用），選擇記在 localStorage。
const KEY = 'drama3.theme'
const VALID = ['auto', 'light', 'dark']

function initial() {
  const fromUrl = new URLSearchParams(window.location.search).get('theme')
  if (VALID.includes(fromUrl)) return fromUrl
  try {
    const saved = window.localStorage.getItem(KEY)
    if (VALID.includes(saved)) return saved
  } catch {
    // 無痕或封鎖儲存：用預設
  }
  return 'auto'
}

export function useTheme() {
  const [theme, setTheme] = useState(initial)
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = theme
    try {
      window.localStorage.setItem(KEY, theme)
    } catch {
      // 忽略
    }
  }, [theme])
  return [theme, setTheme]
}
