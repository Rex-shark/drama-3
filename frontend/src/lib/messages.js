// 後端 error 代碼 → 中文訊息（代碼見 spec/api-conventions.md）。

const MESSAGES = {
  invalid_text: '文字格式不符',
  reference_mismatch: '參考音檔、逐字稿與角色編號的數量不一致',
  reference_too_long: '參考音檔超過 60 秒',
  reference_decode_failed: '參考音檔無法解碼',
  busy: '後端忙碌中，請稍候',
  no_model_loaded: '尚未載入模型版本，請先在頁首載入',
  generation_failed: '產生失敗',
  invalid_request: '參數格式或範圍錯誤',
  unknown_model: '沒有這個模型版本',
  model_not_available: '這個版本尚未下載完成',
  model_load_failed: '模型載入失敗，先前的版本已卸載',
  no_generation_yet: '後端尚無產生紀錄',
  stream_interrupted: '產生中斷，串流沒有正常結束，可以重新產生',
  network: '無法連線到後端，請確認後端已啟動',
  internal_error: '後端內部錯誤',
}

// 回傳一行可顯示的訊息；busy 只顯示固定文案。
export function describeError(err) {
  if (!err) return ''
  if (err.name === 'AbortError') return ''
  const code = err.error ?? 'unknown'
  const title = MESSAGES[code] ?? `未預期的錯誤（${code}）`
  if (code === 'busy') return title
  const detail = err.detail ?? (err.error ? '' : String(err.message ?? err))
  return detail ? `${title}：${detail}` : title
}
