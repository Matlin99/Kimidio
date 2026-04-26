import { ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useSettingsStore } from '../stores/settings.js'

import { apiBase, ready as apiReady } from './useApiBase.js'
const DUCK_VOLUME = 0.25

const audio = new Audio()
audio.preload = 'auto'

const isSpeaking = ref(false)
const currentText = ref('')

let savedMusicVolume = null
let pendingToken = 0

function duckMusic() {
  const player = usePlayerStore()
  if (!player?.audio) return
  if (savedMusicVolume === null) {
    savedMusicVolume = player.audio.volume
  }
  player.audio.volume = Math.min(savedMusicVolume, DUCK_VOLUME)
}

function restoreMusic() {
  const player = usePlayerStore()
  if (!player?.audio) return
  if (savedMusicVolume !== null) {
    player.audio.volume = savedMusicVolume
    savedMusicVolume = null
  }
}

audio.addEventListener('ended', () => {
  isSpeaking.value = false
  currentText.value = ''
  restoreMusic()
})

audio.addEventListener('error', () => {
  isSpeaking.value = false
  currentText.value = ''
  restoreMusic()
})

// Streaming MP3 from /api/tts-stream can underrun the buffer when the
// network is briefly slow (especially under Tauri WebView). The audio
// element fires pause → waiting → playing in that case. Treating pause
// as instant-stop would cut TTS off after the first sentence. Debounce
// 300ms: if `playing` fires within that window, it was just buffering;
// if not, it's a real stop (manual tts.stop() or end of stream).
let pauseDebounceTimer = null
audio.addEventListener('pause', () => {
  if (audio.ended) return
  if (pauseDebounceTimer) clearTimeout(pauseDebounceTimer)
  pauseDebounceTimer = setTimeout(() => {
    pauseDebounceTimer = null
    if (audio.paused && !audio.ended) {
      isSpeaking.value = false
      currentText.value = ''
      restoreMusic()
    }
  }, 300)
})
audio.addEventListener('playing', () => {
  if (pauseDebounceTimer) {
    clearTimeout(pauseDebounceTimer)
    pauseDebounceTimer = null
  }
})

// Autoplay-policy unlock: Safari/Chrome block audio.play() before any user
// gesture. On the first NotAllowedError we stash the text and arm one-shot
// listeners so the very next click/touch/keydown replays the queued speech.
let pendingGestureText = null
let gestureHandlers = null

function disarmGestureUnlock() {
  pendingGestureText = null
  if (!gestureHandlers) return
  for (const [ev, h] of gestureHandlers) window.removeEventListener(ev, h)
  gestureHandlers = null
}

function armGestureUnlock(text) {
  pendingGestureText = text
  if (gestureHandlers) return
  const fire = () => {
    const t = pendingGestureText
    disarmGestureUnlock()
    if (t) speak(t, { force: true })
  }
  gestureHandlers = [
    ['pointerdown', fire], ['touchstart', fire], ['keydown', fire]
  ]
  for (const [ev, h] of gestureHandlers) window.addEventListener(ev, h, { once: true })
  console.info('[TTS] queued until first user gesture (autoplay policy)')
}

function waitForPlaybackEnd() {
  return new Promise((resolve) => {
    let pauseTimer = null
    const cleanup = () => {
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('error', onErr)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('playing', onPlay)
      if (pauseTimer) clearTimeout(pauseTimer)
    }
    const onEnd = () => { cleanup(); resolve() }
    const onErr = () => { cleanup(); resolve() }
    // Same debounce trick as the global pause handler above: a stream
    // buffer underrun fires pause → waiting → playing within ~300ms,
    // and we should NOT treat that as the speech ending. Real stops
    // (ended, manual tts.stop()) stay paused past the timer.
    const onPause = () => {
      if (pauseTimer) clearTimeout(pauseTimer)
      pauseTimer = setTimeout(() => { cleanup(); resolve() }, 300)
    }
    const onPlay = () => {
      if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null }
    }
    audio.addEventListener('ended', onEnd, { once: true })
    audio.addEventListener('error', onErr, { once: true })
    audio.addEventListener('pause', onPause)
    audio.addEventListener('playing', onPlay)
  })
}

export async function speak(text, { force = false } = {}) {
  if (!text || !text.trim()) {
    console.warn('[TTS] speak skipped: empty text')
    return
  }
  const settings = useSettingsStore()
  if (!force && !settings.preferences.ttsEnabled) {
    console.warn('[TTS] speak skipped: ttsEnabled=false (check Settings → DJ Voice)')
    return
  }
  console.log('[TTS] speak:', text.slice(0, 60) + (text.length > 60 ? '…' : ''))

  stop()
  const token = ++pendingToken

  // Use the non-streaming endpoint: server fully synthesizes (or hits its
  // md5 cache) and returns a /tts-cache/*.mp3 URL we can hand to the audio
  // element as a complete file. Streaming /api/tts-stream worked fine in
  // Chrome but cuts off mid-sentence in Tauri's WebView (the audio element
  // can't tell when an Infinity-duration stream is "done" and bails after
  // its initial buffer drains). Static file = known Content-Length =
  // reliable end-of-stream detection.
  let audioUrl
  try {
    await apiReady
    const resp = await fetch(`${apiBase.value}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
    if (!resp.ok) {
      console.warn('[TTS] /api/tts non-OK', resp.status)
      return
    }
    const data = await resp.json()
    if (!data?.audioUrl) {
      console.warn('[TTS] /api/tts returned no audioUrl')
      return
    }
    // audioUrl is a server-relative path like '/tts-cache/abc.mp3'
    audioUrl = data.audioUrl.startsWith('http')
      ? data.audioUrl
      : `${apiBase.value}${data.audioUrl}`
  } catch (e) {
    console.warn('[TTS] synth fetch failed:', e.message)
    return
  }
  if (token !== pendingToken) return

  try {
    audio.src = audioUrl
    currentText.value = text
    isSpeaking.value = true
    duckMusic()
    if (token !== pendingToken) return
    await audio.play()
    await waitForPlaybackEnd()
  } catch (e) {
    isSpeaking.value = false
    currentText.value = ''
    restoreMusic()
    if (e.name === 'NotAllowedError') {
      armGestureUnlock(text)
    } else {
      console.warn('[TTS] play failed:', e.message)
    }
  }
}

export function stop() {
  pendingToken++
  // Cancel any pending gesture-replay so a subsequent user click (e.g. the
  // Skip button) doesn't trigger speak() via the autoplay-unlock handlers.
  disarmGestureUnlock()
  try { audio.pause() } catch { /* element may be in no-source state */ }
  // pause() alone doesn't truly stop streaming audio — the browser keeps
  // playing whatever's already in its buffer and may still pull bytes from
  // the in-flight fetch. Detach src + load() to abort the fetch and dump
  // the buffer so playback halts immediately.
  audio.removeAttribute('src')
  audio.load()
  isSpeaking.value = false
  currentText.value = ''
  restoreMusic()
}

export function isSpeakingText(text) {
  return isSpeaking.value && currentText.value === text
}

// Fire-and-forget cache warm-up. Hits the same /api/tts endpoint the real
// playback uses, so server-side md5 cache holds the synthesized mp3 ready.
// When speak() runs later with the same text, the response is instant.
export async function preload(text) {
  if (!text || !text.trim()) return
  await apiReady
  try {
    await fetch(`${apiBase.value}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
  } catch { /* best-effort */ }
}

export const tts = {
  speak,
  stop,
  preload,
  isSpeaking,
  currentText,
  isSpeakingText,
  audio,
}
