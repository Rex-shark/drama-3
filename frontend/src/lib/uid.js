// 前端暫用的唯一鍵（React key 與 reducer 找項目用）；在 action 建立時產生，reducer 保持純函式。
let seq = 0
export const uid = (prefix = 'k') => `${prefix}${Date.now().toString(36)}${(++seq).toString(36)}`
