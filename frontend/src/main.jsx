import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 字型隨前端打包，不連 Google Fonts（離線可用）
import '@fontsource/lexend/300.css'
import '@fontsource/lexend/500.css'
import '@fontsource/noto-sans-tc/400.css'
import '@fontsource/noto-sans-tc/500.css'
import '@fontsource/ibm-plex-mono/400.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
