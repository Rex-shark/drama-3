// 後端狀態：輪詢 /v1/health（產生中或忙碌時每 1 秒、閒置每 5 秒），版本清單與載入 / 卸載。
// 後端不排隊：busy 期間前端禁用產生與版本切換，「切換中」以 busy_reason / busy_target 為準。
import { useCallback, useEffect, useRef, useState } from 'react'
import { getHealth, getModels, loadModel, unloadModel } from '../lib/api'
import { describeError } from '../lib/messages'

const FAST_MS = 1000
const IDLE_MS = 5000

// 輪詢結果內容沒變就沿用舊物件，避免每次輪詢都讓整個 App 重繪
const HEALTH_FIELDS = ['status', 'mock', 'loaded', 'busy', 'busy_reason', 'busy_target']
const sameHealth = (a, b) => Boolean(a && b) && HEALTH_FIELDS.every((k) => a[k] === b[k])
const sameModels = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export function useBackend({ active = false } = {}) {
  const [health, setHealth] = useState(null)
  const [connected, setConnected] = useState(null) // null = 尚未查過
  const [models, setModels] = useState([])
  const [loadingId, setLoadingId] = useState(null) // 本頁送出的載入 / 卸載請求
  const [modelError, setModelError] = useState('')
  const [tick, setTick] = useState(0)
  const lastLoaded = useRef(undefined)

  const refreshModels = useCallback(async () => {
    try {
      const next = await getModels()
      setModels((prev) => (sameModels(prev, next) ? prev : next))
    } catch {
      // 由 health 顯示連線狀態
    }
  }, [])

  // withModels：閒置輪詢順便重抓版本清單，頁面開著時下載完成的版本才會變成可選
  const refresh = useCallback(async ({ withModels = false } = {}) => {
    try {
      const h = await getHealth()
      setHealth((prev) => (sameHealth(prev, h) ? prev : h))
      setConnected(true)
      if (withModels || lastLoaded.current !== h.loaded) {
        lastLoaded.current = h.loaded
        refreshModels()
      }
    } catch {
      setConnected(false)
    }
  }, [refreshModels])

  // 外部要求「立刻再查一次」（例如收到 409、產生結束）
  const poke = useCallback(() => setTick((n) => n + 1), [])

  const fast = active || Boolean(loadingId) || Boolean(health?.busy) || connected === false
  useEffect(() => {
    let timer
    let cancelled = false
    const loop = async () => {
      await refresh({ withModels: !fast })
      if (!cancelled) timer = setTimeout(loop, fast ? FAST_MS : IDLE_MS)
    }
    loop()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [fast, refresh, tick])

  const load = useCallback(
    async (id) => {
      setModelError('')
      setLoadingId(id)
      poke()
      try {
        await loadModel(id)
      } catch (err) {
        setModelError(describeError(err))
      } finally {
        setLoadingId(null)
        await refresh()
        refreshModels()
      }
    },
    [poke, refresh, refreshModels],
  )

  const unload = useCallback(async () => {
    setModelError('')
    setLoadingId('unload')
    poke()
    try {
      await unloadModel()
    } catch (err) {
      setModelError(describeError(err))
    } finally {
      setLoadingId(null)
      await refresh()
      refreshModels()
    }
  }, [poke, refresh, refreshModels])

  return { health, connected, models, loadingId, modelError, load, unload, poke }
}
