// 開發用示範狀態（只在 npm run dev 下以 ?demo 啟用）：兩個角色、三行劇本、兩張 take。
// 音訊是前端合成的測試音，不經後端；用途是截圖與檢查版面，不代表推理結果。
import { uid } from './uid'
import { encodeWav } from './wav'

function tone(seconds, sampleRate, baseHz) {
  const n = Math.round(seconds * sampleRate)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const syllable = Math.max(0, Math.sin(Math.PI * ((t * 3.1) % 1))) // 一秒約三個音節
    const pitch = baseHz * (1 + 0.04 * Math.sin(2 * Math.PI * 0.7 * t))
    out[i] = 0.25 * syllable * Math.sin(2 * Math.PI * pitch * t)
  }
  return encodeWav(out, sampleRate)
}

function ref(name, transcript, seconds, sampleRate, hz) {
  const blob = tone(seconds, sampleRate, hz)
  return { key: uid('a'), name, status: 'ready', transcript, seconds, sampleRate, blob, url: URL.createObjectURL(blob) }
}

// early = true 時最新一張 take 標為疑似提前中斷（?demo=early，檢查提示版面用）
export function buildDemoState({ early = false } = {}) {
  const speakers = [
    {
      id: 0,
      name: '林晚',
      refs: [ref('linwan-01.wav', '今天的風有點大，我們走慢一點，好嗎？', 12.4, 44100, 220)],
    },
    {
      id: 1,
      name: '周序',
      refs: [
        ref('zhouxu-01.wav', '我在月台等了二十分鐘，車一直沒來。', 8.2, 48000, 150),
        ref('zhouxu-02.wav', '算了，走回去也不遠。', 64.5, 48000, 150),
      ],
    },
  ]
  const rows = [
    { key: uid('r'), speaker: 0, style: '疲憊而溫柔', text: '你來了。我還以為你今晚不會出現。', direction: '', expanded: false },
    {
      key: uid('r'),
      speaker: 1,
      style: '',
      text: '路上下雨，[sighs] 公車又誤點了。<whisper>她睡了嗎？</whisper>',
      direction: '',
      expanded: false,
    },
    {
      key: uid('r'),
      speaker: 0,
      style: '',
      text: '睡了。[pause] 我們小聲一點，明天再談。',
      direction: '像在深夜廣播，語速慢，帶一點倦意',
      expanded: true,
    },
  ]
  const text = [
    '<|speaker:0|> [疲憊而溫柔] 你來了。我還以為你今晚不會出現。',
    '<|speaker:1|> 路上下雨，[sighs] 公車又誤點了。<whisper>她睡了嗎？</whisper>',
    '<|speaker:0|> Direction: 像在深夜廣播，語速慢，帶一點倦意\nLine: 睡了。[pause] 我們小聲一點，明天再談。',
  ].join('\n')
  const take = (number, seconds, minutesAgo, model, streamed, earlyStop) => {
    const blob = tone(seconds, 44100, 196)
    return {
      id: uid('t'),
      number,
      blob,
      url: URL.createObjectURL(blob),
      createdAt: new Date(Date.now() - minutesAgo * 60000),
      model,
      text,
      speakers: [
        { id: 0, name: '林晚' },
        { id: 1, name: '周序' },
      ],
      request: null,
      streamed,
      status: 'done',
      elapsed: seconds * 1.12,
      audioSeconds: seconds,
      chunks: 1,
      earlyStop,
    }
  }
  return {
    speakers,
    activeSpeaker: 0,
    rows,
    takes: [take(2, 9.6, 1, '8bit', true, early), take(1, 3.2, 6, '8bit', false, true)],
    takeSeq: 2,
  }
}
