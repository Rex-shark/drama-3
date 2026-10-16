// 音訊處理工具：混成單聲道並編碼成 16-bit PCM WAV。
// 搬自 whisper-cpp/src/lib/wav.js，但**保留原始取樣率**（不降到 16k）：
// Drama 3 參考音檔品質越高越好，降頻會損失音色。

// 將 Float32 PCM（-1..1）編碼成 16-bit PCM mono WAV Blob。
export function encodeWav(samples, sampleRate) {
  const pcm = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return pcm16ToWav(new Uint8Array(pcm.buffer), sampleRate)
}

// 已是 s16le mono 的位元組（例如串流收到的 PCM）直接包成 WAV Blob。
export function pcm16ToWav(bytes, sampleRate) {
  const length = bytes.byteLength - (bytes.byteLength % 2)
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + length, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, length, true)
  return new Blob([header, bytes.subarray(0, length)], { type: 'audio/wav' })
}

// 把任意 AudioBuffer（多聲道）混成單聲道 Float32Array。
export function toMono(audioBuffer) {
  const ch = audioBuffer.numberOfChannels
  if (ch === 1) return audioBuffer.getChannelData(0)
  const length = audioBuffer.length
  const out = new Float32Array(length)
  for (let c = 0; c < ch; c++) {
    const data = audioBuffer.getChannelData(c)
    for (let i = 0; i < length; i++) out[i] += data[i] / ch
  }
  return out
}

// decodeAudioData 會把結果重新取樣到 context 的取樣率，
// 所以先從檔頭讀出原始取樣率，再用同取樣率的 OfflineAudioContext 解碼。
// 支援 WAV、FLAC、MP3、M4A；讀不出來的格式（如 ogg、webm）以 48000 解碼，不會低於常見來源。
export const FALLBACK_SAMPLE_RATE = 48000

export function sniffSampleRate(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  const view = new DataView(arrayBuffer)
  const ascii = (offset, len) => String.fromCharCode(...bytes.subarray(offset, offset + len))
  try {
    // WAV：RIFF....WAVE，逐 chunk 找 fmt
    if (bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') {
      let offset = 12
      while (offset + 8 <= bytes.length) {
        const id = ascii(offset, 4)
        const size = view.getUint32(offset + 4, true)
        if (id === 'fmt ') return view.getUint32(offset + 12, true)
        offset += 8 + size + (size % 2)
      }
    }
    // FLAC：fLaC + STREAMINFO（第 10–12 位元組含 20 bit 取樣率）
    if (bytes.length > 22 && ascii(0, 4) === 'fLaC') {
      return (bytes[18] << 12) | (bytes[19] << 4) | (bytes[20] >> 4)
    }
    // MP4 / M4A：找音訊 sample entry（mp4a），box 起點 +32 是 16.16 取樣率的整數部分
    if (bytes.length > 12 && ascii(4, 4) === 'ftyp') {
      for (let i = 8; i < bytes.length - 40; i++) {
        if (bytes[i] === 0x6d && ascii(i, 4) === 'mp4a') {
          const rate = view.getUint16(i - 4 + 32, false)
          if (rate) return rate
        }
      }
      return null
    }
    // MP3：略過 ID3v2，第一個 frame header 必須緊接在後（避免在其他格式誤判同步字）
    let start = 0
    if (ascii(0, 3) === 'ID3' && bytes.length > 10) {
      start = 10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9])
    }
    if (bytes[start] === 0xff && (bytes[start + 1] & 0xe0) === 0xe0) {
      const version = (bytes[start + 1] >> 3) & 0x03 // 3=MPEG1 2=MPEG2 0=MPEG2.5
      const layer = (bytes[start + 1] >> 1) & 0x03
      const rateIndex = (bytes[start + 2] >> 2) & 0x03
      if (version !== 1 && layer !== 0 && rateIndex !== 3) {
        const base = [44100, 48000, 32000][rateIndex]
        return version === 3 ? base : version === 2 ? base / 2 : base / 4
      }
    }
  } catch {
    // 檔頭不完整：走後備取樣率
  }
  return null
}

// 以指定取樣率的 OfflineAudioContext 解碼。decodeAudioData 會轉移（detach）傳入的 ArrayBuffer，
// 需要重試時呼叫端要傳複本。
async function decodeAt(arrayBuffer, sampleRate) {
  const ctx = new OfflineAudioContext(1, 1, sampleRate)
  return ctx.decodeAudioData(arrayBuffer)
}

// 先用嗅探到的取樣率解碼；瀏覽器不接受該取樣率（Safari 範圍較窄，8 kHz / 22.05 kHz 可能被拒）
// 或解碼失敗時，改用 48 kHz 重試一次；仍失敗才拋出。
export async function decodeAudio(arrayBuffer) {
  const sniffed = sniffSampleRate(arrayBuffer)
  const sampleRate = sniffed && sniffed >= 3000 && sniffed <= 384000 ? sniffed : FALLBACK_SAMPLE_RATE
  if (sampleRate === FALLBACK_SAMPLE_RATE) return decodeAt(arrayBuffer, FALLBACK_SAMPLE_RATE)
  try {
    return await decodeAt(arrayBuffer.slice(0), sampleRate)
  } catch (err) {
    console.warn(`以 ${sampleRate} Hz 解碼失敗，改用 ${FALLBACK_SAMPLE_RATE} Hz 重試`, err)
    return decodeAt(arrayBuffer, FALLBACK_SAMPLE_RATE)
  }
}

// 錄音裁切：超過 maxSeconds 的部分以樣本數裁掉（恰為 maxSeconds × sampleRate 個樣本），未超過原樣回傳。
export function trimToSeconds(samples, sampleRate, maxSeconds) {
  const max = Math.floor(maxSeconds * sampleRate)
  return samples.length > max ? samples.subarray(0, max) : samples
}

// File / Blob 音檔 → { blob: mono 16-bit WAV（原始取樣率）, seconds, sampleRate }
export async function fileToWav(file) {
  const audioBuffer = await decodeAudio(await file.arrayBuffer())
  const mono = toMono(audioBuffer)
  return {
    blob: encodeWav(mono, audioBuffer.sampleRate),
    seconds: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
  }
}
