import { ref } from 'vue'
import { apiBase, ready as apiReady } from './useApiBase.js'

const STORAGE_KEY = 'kimi-ambient-enabled-v1'

// Dedicated audio element for weather-matched ambient background. Separate
// from the music player (player.audio) and TTS (tts.audio) so toggling one
// doesn't affect the other. Loops continuously.
const audio = new Audio()
audio.preload = 'auto'
audio.loop = true
audio.volume = 0.3

const isPlaying = ref(false)
const isLoading = ref(false)
const current = ref(null)  // { weather, mood, track, url }

// Persist the enabled preference — default ON per spec
const loadEnabled = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === null ? true : v === '1'
  } catch { return true }
}
const enabled = ref(loadEnabled())
const saveEnabled = (v) => {
  try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0') } catch {}
}

audio.addEventListener('playing', () => { isPlaying.value = true })
audio.addEventListener('pause',   () => { isPlaying.value = false })
audio.addEventListener('ended',   () => { isPlaying.value = false })
audio.addEventListener('error',   () => { isPlaying.value = false })

async function ensureTrackLoaded(city = 'Tokyo') {
  if (current.value?.url) return current.value
  isLoading.value = true
  try {
    await apiReady
    const res = await fetch(`${apiBase.value}/api/ambient?city=${encodeURIComponent(city)}`)
    if (!res.ok) return null
    const data = await res.json()
    current.value = data
    console.log(`[ambient] ${data.mood} — ${data.track?.title} by ${data.track?.artist}`)
    return data
  } catch (e) {
    console.warn('[ambient] fetch failed:', e.message)
    return null
  } finally {
    isLoading.value = false
  }
}

async function start(city = 'Tokyo') {
  if (!enabled.value) return
  const t = await ensureTrackLoaded(city)
  if (!t?.url) return
  if (audio.src !== t.url) {
    audio.src = t.url
  }
  try {
    await audio.play()
  } catch (e) {
    // Autoplay might still be blocked; will retry on the next user gesture
    console.warn('[ambient] play blocked:', e.name)
  }
}

function pause() {
  if (!audio.paused) audio.pause()
}

async function toggle(city = 'Tokyo') {
  if (isPlaying.value) {
    enabled.value = false
    saveEnabled(false)
    pause()
  } else {
    enabled.value = true
    saveEnabled(true)
    await start(city)
  }
}

export const ambient = {
  start,
  pause,
  toggle,
  isPlaying,
  isLoading,
  enabled,
  current,
}
