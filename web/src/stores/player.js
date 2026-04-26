import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

import { apiBase, ready as apiReady } from '../composables/useApiBase.js'
const FAV_KEY = 'kimi-favorites-v1'
const VOL_KEY = 'kimi-volume-v1'

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
function loadVolume() {
  try {
    const raw = localStorage.getItem(VOL_KEY)
    if (raw === null) return 0.7
    const v = parseFloat(raw)
    return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.7
  } catch { return 0.7 }
}

export const usePlayerStore = defineStore('player', () => {
  // ── Core audio ──
  const audio = new Audio()

  // ── Queue state ──
  const queue = ref([])
  const currentIndex = ref(0)
  const history = ref([])

  // ── Favorites (persisted) ──
  const favorites = ref(loadFavorites())
  watch(favorites, (v) => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(v)) } catch {}
  }, { deep: true })

  const trackKey = (t) => t && (t.id || `${t.source}:${t.sourceId}` || `${t.title}::${t.artist}`)
  const isFavorite = (t) => {
    const k = trackKey(t); if (!k) return false
    return favorites.value.some(f => trackKey(f) === k)
  }
  const toggleFavorite = (t) => {
    if (!t) return
    const k = trackKey(t)
    const i = favorites.value.findIndex(f => trackKey(f) === k)
    if (i >= 0) favorites.value.splice(i, 1)
    else favorites.value.push({
      id: t.id, source: t.source, sourceId: t.sourceId,
      title: t.title, artist: t.artist, cover: t.cover, duration: t.duration
    })
  }

  // ── Playback state ──
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(loadVolume())
  watch(volume, (v) => {
    try { localStorage.setItem(VOL_KEY, String(v)) } catch {}
  })
  // 3-state collapse: 'full' (everything), 'mini' (slim TopPanel + AI DJ
  // terminal status row), 'hidden' (slim TopPanel only). The chevron in
  // TopPanel cycles forward (hidden → mini → full); the HIDE button in
  // PlayerControls collapses straight to 'hidden'.
  //
  // Under Tauri (production桌寵 form), 'mini' / 'hidden' don't shrink the
  // main window in place — they hide main and show a borderless
  // always-on-top "pet" secondary window. The watch below dispatches the
  // appropriate Tauri commands so the OS-level window state matches.
  //
  // Pet window opens at the slimmest state ('hidden') showing just
  // TopPanel; user clicks the chevron to cycle hidden → mini (reveals
  // LIVE/Terminal bar) → full (the watch below catches the 'full'
  // transition in pet and restores the main window).
  const isInPetWindow = typeof window !== 'undefined' && window.location.hash === '#/pet'
  const viewMode = ref(isInPetWindow ? 'hidden' : 'full')
  const isHidden = computed(() => viewMode.value !== 'full')   // back-compat alias for existing UI checks

  // Tauri window swap. Logic differs by which window the change happens in:
  //   • Main: full → mini/hidden  → spawn pet, hide main.
  //           mini/hidden → full  → hide pet (rare; main is shown by show_main).
  //   • Pet:  hidden ↔ mini       → no Tauri cmd, just toggles MiniStatusBar.
  //           anything → full     → restore main, hide pet.
  // No-op outside Tauri (plain web mode).
  watch(viewMode, async (next) => {
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const me = getCurrentWindow()

      if (me.label === 'pet') {
        if (next === 'full') {
          await invoke('restore_main_window')
          return
        }
        // Eager hint — set approximate size IMMEDIATELY so the OS window
        // starts resizing before MiniStatusBar finishes mounting and the
        // ResizeObserver fires. Without this, the user clicks chevron and
        // sees ~50ms of nothing before the window grows. PetApp's observer
        // still fine-tunes the height to the actual content afterwards.
        const hints = { hidden: 140, mini: 220 }
        if (hints[next]) {
          try {
            const { LogicalSize } = await import('@tauri-apps/api/dpi')
            await me.setSize(new LogicalSize(420, hints[next]))
          } catch (e) { /* swallow */ }
        }
        return
      }

      // Inside main:
      if (next === 'full') {
        await invoke('hide_pet')
      } else {
        await invoke('show_pet')
        try { await me.hide() } catch {}
      }
    } catch (e) {
      console.warn('[player] viewMode → window swap failed:', e?.message)
    }
  })

  // Tauri events:
  //   'view-restore'  → main: snap back to 'full' so the PlayerCard re-expands
  //                     when the pet's chevron pops main back into focus.
  //   'pet-reset-view'→ pet: reset to 'hidden' on every show so the chevron
  //                     and slim layout reappear instead of inheriting last
  //                     session's state.
  if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('view-restore', () => {
        if (!isInPetWindow && viewMode.value !== 'full') viewMode.value = 'full'
      })
      listen('pet-reset-view', () => {
        if (isInPetWindow && viewMode.value !== 'hidden') viewMode.value = 'hidden'
      })
    }).catch(() => {})
  }
  const isLoading = ref(true)
  const slideDirection = ref(null) // 'up' | 'down' | null
  const isBuffering = ref(false)

  // Shuffle / repeat modes — persisted so user's preference carries over.
  const isShuffle = ref(localStorage.getItem('kimi-shuffle-v1') === '1')
  const repeatMode = ref(localStorage.getItem('kimi-repeat-v1') || 'off')  // 'off' | 'all' | 'one'
  watch(isShuffle, (v) => { try { localStorage.setItem('kimi-shuffle-v1', v ? '1' : '0') } catch {} })
  watch(repeatMode, (v) => { try { localStorage.setItem('kimi-repeat-v1', v) } catch {} })
  const toggleShuffle = () => { isShuffle.value = !isShuffle.value }
  const cycleRepeat = () => {
    repeatMode.value = repeatMode.value === 'off' ? 'all' : repeatMode.value === 'all' ? 'one' : 'off'
  }

  // ── Computed ──
  const currentTrack = computed(() => queue.value[currentIndex.value] || null)

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const formattedCurrentTime = computed(() => formatTime(currentTime.value))
  const formattedDuration = computed(() => formatTime(duration.value))
  const progressPercent = computed(() => {
    if (!duration.value || duration.value <= 0) return 0
    return (currentTime.value / duration.value) * 100
  })

  // ── Audio event listeners ──
  audio.ontimeupdate = () => {
    currentTime.value = audio.currentTime || 0
  }

  audio.onended = () => {
    // Repeat-one: replay current track; otherwise advance normally
    if (repeatMode.value === 'one' && audio.src) {
      audio.currentTime = 0
      audio.play().catch(() => {})
      return
    }
    nextTrack()
  }

  audio.onerror = () => {
    console.error('Audio error, skipping to next available...')
    skipToAvailable(currentIndex.value + 1, { autoPlay: true })
  }

  audio.onloadedmetadata = () => {
    duration.value = audio.duration || 0
  }

  audio.onwaiting = () => {
    isBuffering.value = true
  }

  audio.oncanplay = () => {
    isBuffering.value = false
  }

  // ── Volume init ──
  audio.volume = volume.value

  // ── Playback control ──
  const play = async () => {
    if (!currentTrack.value) return

    // Ensure we have a URL
    if (!audio.src) {
      await loadCurrentTrack()
    }
    if (!audio.src) {
      // Current track unavailable, try to find next available
      const found = await skipToAvailable(currentIndex.value + 1, { autoPlay: false })
      if (!found) {
        console.warn('No playable tracks in queue')
        isPlaying.value = false
        return
      }
    }

    try {
      await audio.play()
      isPlaying.value = true
    } catch (e) {
      console.error('Play failed:', e)
      isPlaying.value = false
    }
  }

  const pause = () => {
    audio.pause()
    isPlaying.value = false
  }

  const togglePlay = () => {
    if (isPlaying.value) {
      pause()
    } else {
      play()
    }
  }

  // ── URL loading ──
  async function loadCurrentTrack() {
    const track = currentTrack.value
    if (!track) return

    // STOP the previous audio immediately. Without this, when yt-dlp takes
    // 10s to resolve a new YT track, the OLD song keeps playing while UI
    // already shows the new one — classic "wrong song playing" UX bug.
    // Detaching src + load() aborts the in-flight buffer / playback.
    try { audio.pause() } catch {}
    audio.removeAttribute('src')
    audio.load()
    currentTime.value = 0
    duration.value = 0

    isBuffering.value = true

    // Capture which track we started loading for. If the user switches
    // again mid-fetch (yt-dlp can take 10s+ for cold YT requests), we
    // must NOT assign the late-arriving URL to a now-different
    // currentTrack — that's the other half of the audio/UI desync.
    const loadingTrackId = track.id

    // If track already has a URL, use it directly
    if (track.url) {
      audio.src = track.url
      audio.load()
      isBuffering.value = false
      return
    }

    // Otherwise fetch URL from backend
    try {
      const params = new URLSearchParams({
        id: track.sourceId,
        source: track.source,
        title: track.title || '',
        artist: track.artist || ''
      })
      const res = await fetch(`${apiBase.value}/api/song/url?${params}`)
      const data = await res.json()
      // Stale-response guard: user may have clicked a different track
      // during the yt-dlp wait. If currentTrack changed, drop this URL.
      if (currentTrack.value?.id !== loadingTrackId) {
        console.log('[loadCurrentTrack] discarded stale URL for', track.title)
        return
      }
      if (data.url) {
        audio.src = data.url
        audio.load()
        // Update track with URL for future use (but note: URLs expire)
        track.url = data.url
      } else {
        console.warn('No URL available for track:', track.title)
        // Do NOT auto-skip here — let the caller decide
      }
    } catch (e) {
      console.error('Failed to load track URL:', e)
    } finally {
      isBuffering.value = false
    }
  }

  // ── Skip to next available track (silent, no animation) ──
  async function skipToAvailable(startIndex, options = {}) {
    const { autoPlay = false } = options
    const len = queue.value.length
    if (len === 0) return false

    const visited = new Set()
    let idx = ((startIndex % len) + len) % len

    while (!visited.has(idx)) {
      visited.add(idx)

      currentIndex.value = idx
      currentTime.value = 0
      duration.value = 0

      await loadCurrentTrack()

      if (audio.src) {
        if (autoPlay && isPlaying.value) {
          try {
            await audio.play()
            isPlaying.value = true
          } catch (e) {
            console.error('Auto-play failed:', e)
          }
        }
        return true
      }

      idx = (idx + 1) % len
    }

    return false
  }

  // ── Navigation ──
  const nextTrack = async () => {
    if (queue.value.length === 0) return
    slideDirection.value = 'up'
    // Shuffle: pick a random different index when enabled
    if (isShuffle.value && queue.value.length > 1) {
      let next = currentIndex.value
      while (next === currentIndex.value) {
        next = Math.floor(Math.random() * queue.value.length)
      }
      currentIndex.value = next
    } else {
      // repeat-all vs off: at end of queue, 'all' wraps, 'off' stops; nextTrack
      // should not jump past the end if repeat is off — but auto-advance from
      // onended already handled repeat-one above. Here we always wrap for the
      // explicit-next-click case, since UI expects next to cycle.
      currentIndex.value = (currentIndex.value + 1) % queue.value.length
    }
    currentTime.value = 0
    duration.value = 0

    await loadCurrentTrack()

    if (!audio.src) {
      await skipToAvailable(currentIndex.value + 1)
    }

    if (isPlaying.value && audio.src) {
      await play()
    }
    if (audio.src) recordPlay()

    setTimeout(() => { slideDirection.value = null }, 500)
  }

  const prevTrack = async () => {
    if (queue.value.length === 0) return
    slideDirection.value = 'down'
    currentIndex.value = (currentIndex.value - 1 + queue.value.length) % queue.value.length
    currentTime.value = 0
    duration.value = 0

    await loadCurrentTrack()

    if (!audio.src) {
      await skipToAvailable(currentIndex.value - 1)
    }

    if (isPlaying.value && audio.src) {
      await play()
    }
    if (audio.src) recordPlay()

    setTimeout(() => { slideDirection.value = null }, 500)
  }

  const selectTrack = async (index) => {
    if (index < 0 || index >= queue.value.length) return
    const diff = index - currentIndex.value
    if (diff > 0 || (diff < 0 && Math.abs(diff) > queue.value.length / 2)) {
      slideDirection.value = 'up'
    } else if (diff < 0 || (diff > 0 && Math.abs(diff) > queue.value.length / 2)) {
      slideDirection.value = 'down'
    }

    currentIndex.value = index
    currentTime.value = 0
    duration.value = 0

    await loadCurrentTrack()

    if (!audio.src) {
      // Selected track unavailable, silently find next available
      const found = await skipToAvailable(index + 1)
      if (!found) {
        // Nothing playable in the entire queue
        setTimeout(() => { slideDirection.value = null }, 500)
        return
      }
    }

    isPlaying.value = true
    await play()
    recordPlay()

    setTimeout(() => { slideDirection.value = null }, 500)
  }

  // ── Queue management ──
  const addToQueue = (track) => {
    queue.value.push(track)
  }

  const insertNext = (track) => {
    queue.value.splice(currentIndex.value + 1, 0, track)
  }

  const replaceQueue = (newQueue, startIndex = 0) => {
    queue.value = newQueue
    currentIndex.value = startIndex
    currentTime.value = 0
    duration.value = 0
    loadCurrentTrack().then(() => {
      if (!audio.src) {
        skipToAvailable(startIndex + 1)
      }
    })
  }

  const removeFromQueue = (index) => {
    if (index < 0 || index >= queue.value.length) return
    queue.value.splice(index, 1)
    if (index < currentIndex.value) {
      currentIndex.value--
    } else if (index === currentIndex.value) {
      // Removed current track, load new one at same index
      currentTime.value = 0
      duration.value = 0
      loadCurrentTrack().then(() => {
        if (!audio.src) skipToAvailable(currentIndex.value + 1)
        if (isPlaying.value && audio.src) play()
      })
    }
  }

  // ── Volume / Progress ──
  const setVolume = (v) => {
    const clamped = Math.max(0, Math.min(1, v))
    volume.value = clamped
    audio.volume = clamped
  }

  const setProgress = (seconds) => {
    if (!audio.duration) return
    const clamped = Math.max(0, Math.min(seconds, audio.duration))
    audio.currentTime = clamped
    currentTime.value = clamped
  }

  // Legacy single-step toggle — kept so the HIDE button keeps working as
  // "collapse all the way to slim bar". Unhides back to full.
  const toggleHide = () => {
    viewMode.value = viewMode.value === 'full' ? 'hidden' : 'full'
  }
  // Cycle forward: hidden → mini → full → hidden (the show chevron).
  const cycleViewModeUp = () => {
    viewMode.value =
      viewMode.value === 'hidden' ? 'mini' :
      viewMode.value === 'mini'   ? 'full' :
                                    'hidden'
  }
  const setViewMode = (mode) => {
    if (['full', 'mini', 'hidden'].includes(mode)) viewMode.value = mode
  }

  // ── History / Analytics ──
  const recordPlay = async () => {
    const track = currentTrack.value
    if (!track) return
    history.value.push({
      track,
      playedAt: new Date().toISOString()
    })
    // Also log to backend
    try {
      await fetch(`${apiBase.value}/api/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: track.sourceId,
          track_title: track.title,
          track_artist: track.artist,
          duration: track.duration || 0
        })
      })
    } catch (e) {
      // Silently fail - analytics are not critical
    }
  }

  // ── Initialize playlist from backend ──
  const initPlaylist = async (keyword = 'Nujabes') => {
    try {
      const res = await fetch(`${apiBase.value}/api/playlist/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, source: 'sc', limit: 10 })
      })
      const data = await res.json()
      if (data.playlist?.length > 0) {
        replaceQueue(data.playlist, 0)
        return true
      }
      return false
    } catch (e) {
      console.error('Failed to init playlist:', e)
      return false
    }
  }

  // ── AI DJ curated opening queue (with server-side fallback to keyword pool) ──
  // calendarUrls is included so the server can pull today's events into the
  // prompt context. If no events / no URLs, the server skips that section
  // entirely (per design — no calendar = no schedule-aware curation).
  const curatePlaylist = async ({ provider, hint, taste, calendarUrls } = {}) => {
    try {
      // Wait for the sidecar port lookup to complete — this fires at module
      // load but in Tauri may not resolve before App.vue's onMounted kicks
      // off curate at boot. Without this gate the fetch goes to FALLBACK
      // (8080) which is dead and the playlist loads empty.
      await apiReady
      const res = await fetch(`${apiBase.value}/api/playlist/curate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 10, provider, hint, taste, calendarUrls })
      })
      if (!res.ok) return null
      const data = await res.json()
      if (data.queue?.length > 0) {
        replaceQueue(data.queue, 0)
        return { say: data.say || '', source: data.source, seed: data.seed }
      }
      return null
    } catch (e) {
      console.error('Failed to curate playlist:', e)
      return null
    }
  }

  return {
    // Audio element (exposed for TTS ducking; do not replace)
    audio,

    // State
    queue, currentIndex, history,
    isPlaying, currentTime, duration, volume,
    isHidden, isLoading, slideDirection, isBuffering,

    // Favorites
    favorites, isFavorite, toggleFavorite,

    // Modes
    isShuffle, repeatMode, toggleShuffle, cycleRepeat,

    // Computed
    currentTrack,
    formattedCurrentTime, formattedDuration, progressPercent,

    // Playback
    play, pause, togglePlay,
    nextTrack, prevTrack, selectTrack,

    // Queue
    addToQueue, insertNext, replaceQueue, removeFromQueue,

    // Settings
    setVolume, setProgress, toggleHide, cycleViewModeUp, setViewMode, viewMode,

    // Init
    initPlaylist, curatePlaylist,

    // Utilities
    formatTime,
  }
})
