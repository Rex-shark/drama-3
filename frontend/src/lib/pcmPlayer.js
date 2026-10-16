// 串流播放：raw s16le mono PCM → AudioBuffer → 依序排程到 AudioContext。
// 片段邊界無意義（可能切在一個 sample 中間），奇數位元組留到下一段。

export function createPcmPlayer(ctx, sampleRate) {
  const sources = new Set()
  let received = [] // 收到的完整位元組（串流結束後由 drain() 取走組 WAV）
  let leftover = null
  let nextTime = 0
  let startedAt = null
  let totalSamples = 0
  let stopped = false
  let finished = false

  function feed(chunk) {
    if (stopped || !chunk?.byteLength) return
    let bytes = chunk
    if (leftover) {
      bytes = new Uint8Array(leftover.byteLength + chunk.byteLength)
      bytes.set(leftover, 0)
      bytes.set(chunk, leftover.byteLength)
      leftover = null
    }
    const usable = bytes.byteLength - (bytes.byteLength % 2)
    if (usable < bytes.byteLength) leftover = bytes.slice(usable)
    if (usable === 0) return
    const aligned = bytes.slice(0, usable) // 複本，確保 buffer 對齊 2 bytes
    received.push(aligned)
    const view = new DataView(aligned.buffer)
    const n = usable / 2
    const buffer = ctx.createBuffer(1, n, sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < n; i++) data[i] = view.getInt16(i * 2, true) / 0x8000
    totalSamples += n

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    // 收到第一段立刻出聲；之後接在上一段尾端，若網路慢於播放就從現在重新接上。
    const at = Math.max(nextTime, ctx.currentTime + 0.03)
    if (startedAt === null) startedAt = at
    source.start(at)
    nextTime = at + buffer.duration
    sources.add(source)
    source.onended = () => sources.delete(source)
  }

  function stop() {
    stopped = true
    for (const s of sources) {
      try {
        s.stop()
      } catch {
        // 尚未開始或已結束
      }
    }
    sources.clear()
  }

  // 已收到的音訊秒數
  const receivedSeconds = () => totalSamples / sampleRate
  // 目前播放到的秒數
  const position = () =>
    startedAt === null ? 0 : Math.max(0, Math.min(ctx.currentTime - startedAt, receivedSeconds()))
  // 已排程的音訊何時播完（秒，相對現在）
  const remaining = () => Math.max(0, nextTime - ctx.currentTime)

  // 取走收到的全部位元組並釋放內部副本（take 改由 WAV Blob 保存，不留兩份）。只在串流結束後呼叫一次。
  function drain() {
    const total = received.reduce((n, c) => n + c.byteLength, 0)
    const out = new Uint8Array(total)
    let offset = 0
    for (const c of received) {
      out.set(c, offset)
      offset += c.byteLength
    }
    received = []
    leftover = null
    return out
  }

  // 串流已結束（不會再有資料）
  function finish() {
    finished = true
  }
  // 是否還在出聲或等資料：串流中，或已排程的音訊還沒播完
  const isActive = () => !stopped && (!finished || ctx.currentTime < nextTime)
  const isFinished = () => finished

  return { feed, stop, finish, isActive, isFinished, position, receivedSeconds, remaining, drain, sampleRate }
}
