import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 後端埠預設 8793（spec/api-conventions.md）；開發時可用 DRAMA3_API_PORT 覆寫，
// 例如 DRAMA3_API_PORT=8794 npm run dev 連到另一隻 MOCK 後端。
const apiPort = process.env.DRAMA3_API_PORT || '8793'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
