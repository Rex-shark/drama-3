// 麥克風錄音：以 AudioContext 收集 Float32 PCM，停止時輸出 mono WAV。
// 搬自 whisper-cpp/src/lib/recorder.js；改為保留裝置原始取樣率（不降到 16k）。
import { encodeWav, trimToSeconds } from './wav'

// maxSeconds：stop() 產出的音訊超過此長度就裁到恰好此長度（自動停止的保險）。
export function createRecorder({ maxSeconds = Infinity } = {}) {
  let ctx, source, processor, stream
  let chunks = []
  let inputRate = 44100

  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    inputRate = ctx.sampleRate
    source = ctx.createMediaStreamSource(stream)
    processor = ctx.createScriptProcessor(4096, 1, 1)
    chunks = []
    processor.onaudioprocess = (e) => {
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
    }
    source.connect(processor)
    processor.connect(ctx.destination)
  }

  // 目前已錄秒數（錄音中顯示用）
  function elapsed() {
    return chunks.reduce((n, c) => n + c.length, 0) / inputRate
  }

  // 停止並回傳 { blob, seconds, sampleRate }
  async function stop() {
    processor?.disconnect()
    source?.disconnect()
    stream?.getTracks().forEach((t) => t.stop())
    await ctx?.close()

    const total = chunks.reduce((n, c) => n + c.length, 0)
    const merged = new Float32Array(total)
    let offset = 0
    for (const c of chunks) {
      merged.set(c, offset)
      offset += c.length
    }
    const samples = trimToSeconds(merged, inputRate, maxSeconds)
    return { blob: encodeWav(samples, inputRate), seconds: samples.length / inputRate, sampleRate: inputRate }
  }

  // 放棄錄音（元件卸載時）
  function cancel() {
    processor?.disconnect()
    source?.disconnect()
    stream?.getTracks().forEach((t) => t.stop())
    ctx?.close()
  }

  return { start, stop, elapsed, cancel }
}
