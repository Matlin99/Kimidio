<template>
  <div class="min-h-screen w-full relative overflow-hidden transition-theme"
    :class="isDark ? 'bg-[#0a0809]' : 'bg-[#F4EEF0]'"
    :style="backgroundStyle">
    
    <!-- Abstract Art Background -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-1/4 -left-1/4 w-[800px] h-[800px] rounded-full opacity-30 blur-3xl"
        :class="isDark ? 'bg-gradient-to-br from-rose-900/40 to-purple-900/30' : 'bg-gradient-to-br from-rose-200/60 to-pink-200/40'"></div>
      <div class="absolute -bottom-1/4 -right-1/4 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
        :class="isDark ? 'bg-gradient-to-tl from-blue-900/30 to-purple-900/20' : 'bg-gradient-to-tl from-blue-200/50 to-purple-200/30'"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl"
        :class="isDark ? 'bg-rose-800/30' : 'bg-rose-300/50'"></div>
    </div>

    <!-- Loading Screen -->
    <Transition name="fade">
      <div v-if="player.isLoading" class="fixed inset-0 z-50 flex items-center justify-center"
        :class="isDark ? 'bg-[#0a0809]' : 'bg-[#F4EEF0]'">
        <div class="flex flex-col items-center gap-6">
          <!-- Radio Icon SVG -->
          <div class="animate-loading-pulse">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="10" y="25" width="60" height="40" rx="8" 
                :stroke="isDark ? '#B0666D' : '#B0666D'" stroke-width="3" fill="none"/>
              <line x1="15" y1="20" x2="65" y2="20" 
                :stroke="isDark ? '#B0666D' : '#B0666D'" stroke-width="2" stroke-linecap="round"/>
              <circle cx="30" cy="45" r="8" 
                :stroke="isDark ? '#B0666D' : '#B0666D'" stroke-width="2" fill="none"/>
              <rect x="48" y="38" width="16" height="14" rx="2" 
                :fill="isDark ? '#B0666D' : '#B0666D'" opacity="0.6"/>
              <line x1="50" y1="10" x2="55" y2="20" 
                :stroke="isDark ? '#B0666D' : '#B0666D'" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <p class="font-mono text-sm tracking-widest uppercase" :class="isDark ? 'text-primary-cream/60' : 'text-primary-dark/60'">
            {{ loadingMessage }}
          </p>
        </div>
      </div>
    </Transition>

    <!-- Main Layout — base PlayerCard fades in when the DJ cassette starts
         traveling to screen-left; its inner chrome (playlist) and the right
         AlbumWidgets only appear after the cassette has finished inserting. -->
    <div class="relative z-10 flex items-center justify-center min-h-screen p-4">
      <Transition name="main-reveal">
        <div v-if="mainInterfaceReady" class="flex items-start gap-5 scale-90 origin-center">
          <PlayerCard :chrome-visible="playerChromeReady" />

          <!-- Always rendered so PlayerCard is at its final centered-with-widgets
               position from the start — no horizontal jump when widgets appear.
               Content visibility toggles via chrome-slot-hidden class.
               self-center vertically aligns the carousel to PlayerCard's middle
               instead of its top, so the focus widget sits visually centered
               with the album cover / clock area rather than floating high. -->
          <div v-if="!player.isHidden"
            class="flex flex-col items-center self-center chrome-slot"
            :class="{ 'chrome-slot-hidden': !playerChromeReady }">
            <AlbumWidgets />
          </div>
        </div>
      </Transition>
    </div>

    <!-- Ambient toggle — weather-matched background soundscape. Corner
         button, default ON. Only controls the ambient bed, not the main
         player. Shown from the Landing moment onward. -->
    <Transition name="fade">
      <button v-if="showLanding || mainInterfaceReady || showDJ"
        @click="ambient.toggle(settings.preferences.weatherCity || 'Tokyo')"
        :title="ambient.isPlaying.value ? (ambient.current.value?.mood ? `Ambient: ${ambient.current.value.mood} — tap to mute` : 'Ambient on') : 'Ambient off'"
        class="fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ease-out-expo hover:scale-110 active:scale-95"
        :class="isDark
          ? 'bg-primary-rose/25 border border-primary-rose/40 text-primary-rose hover:bg-primary-rose/40'
          : 'bg-primary-rose/15 border border-primary-rose/30 text-primary-rose hover:bg-primary-rose/25'"
        style="backdrop-filter: blur(12px);">
        <!-- Wave icon = ambient playing; muted icon = ambient off -->
        <svg v-if="ambient.isPlaying.value" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <path d="M2 8 Q3.5 5, 5 8 T8 8 T11 8 T14 8"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <path d="M2 8 Q3.5 6.5, 5 8 T8 8 T11 8 T14 8" opacity="0.4"/>
          <line x1="3" y1="3" x2="13" y2="13" stroke-width="1.6"/>
        </svg>
      </button>
    </Transition>

    <!-- Overlays -->
    <ArchivistChat />
    <ProfileOverlay />
    <SettingsOverlay />
    <SchedulePanel />
    <LandingOverlay :show="showLanding" :greeting="greeting" @begin="onBegin" />
    <WelcomeOverlay :show="showWelcome" @start="onWelcomeStart" />
    <BootDiagnostic :show="showBoot" @done="onBootDone" />
    <DJSpeakingOverlay :show="showDJ" :beats="djBeats"
      @reveal-main="onRevealMain" @done="onDJDone" />
  </div>
</template>

<script setup>
import { onMounted, computed, ref, watch } from 'vue'
import { useTheme } from './composables/useTheme.js'
import { usePlayerStore } from './stores/player.js'
import { useSettingsStore } from './stores/settings.js'
import { useWebSocket } from './composables/useWebSocket.js'
import { tts } from './composables/useTTS.js'
import PlayerCard from './components/PlayerCard.vue'
import AlbumWidgets from './components/AlbumWidgets.vue'
import ArchivistChat from './components/ArchivistChat.vue'
import ProfileOverlay from './components/ProfileOverlay.vue'
import SettingsOverlay from './components/SettingsOverlay.vue'
import SchedulePanel from './components/SchedulePanel.vue'
import WelcomeOverlay from './components/WelcomeOverlay.vue'
import LandingOverlay from './components/LandingOverlay.vue'
import DJSpeakingOverlay from './components/DJSpeakingOverlay.vue'
import BootDiagnostic from './components/BootDiagnostic.vue'
import { ambient } from './composables/useAmbient.js'
import { useScheduleStore } from './stores/schedule.js'
import { useCalendarStore } from './stores/calendar.js'
import { useTimeBlock } from './composables/useTimeBlock.js'
import { startBroadcastSync } from './composables/useBroadcastSync.js'

// Main window broadcasts player state changes so the pet window can
// mirror the cover/title/playing indicator. No-op if pet is closed.
startBroadcastSync('main')

import { apiBase, ready as apiReady } from './composables/useApiBase.js'

const { isDark } = useTheme()
const player = usePlayerStore()
const settings = useSettingsStore()
const schedule = useScheduleStore()
const calendar = useCalendarStore()
const { currentBlockId } = useTimeBlock()
const { messages } = useWebSocket()

const loadingMessage = ref('Loading Kimi Radio...')
const showLanding = ref(false)
const showWelcome = ref(false)
const showBoot = ref(false)
const showDJ = ref(false)
const greeting = ref('')
const djBeats = ref([])  // 6-beat monologue for the DJSpeakingOverlay

// Driven by DJSpeakingOverlay phase events so the main UI reveals gradually
// around the cassette's motion:
//   mainInterfaceReady — true at 2.7s into exit (cassette slides to left)
//   playerChromeReady  — true at 5.0s, after cassette fully inserted
const mainInterfaceReady = ref(false)
const playerChromeReady = ref(false)

let beginResolve = null
let welcomeResolve = null
let bootResolve = null
let djDoneResolve = null

function onBootDone() {
  if (bootResolve) { bootResolve(); bootResolve = null }
}

function onBegin() {
  // Start weather-matched ambient as soon as user gestures — fills the
  // silence while curate + monologue fetch in the background. User can
  // toggle it off via the corner button.
  ambient.start(settings.preferences.weatherCity || 'Tokyo').catch(() => {})

  // Warm up the TTS pipeline NOW (the BEGIN click counts as a user gesture
  // for autoplay policy) so when the DJ overlay starts speaking ~6s later,
  // the synthesis is cached server-side. We use the non-streaming endpoint
  // because it hits the same md5 cache the actual playback reads from.
  apiReady.then(() => {
    fetch(`${apiBase.value}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'This is Kimi Radio.' })
    }).catch(() => { /* swallow — preload is best-effort */ })
  })

  // Warm up the player's <audio> element with a real user gesture. yt-dlp
  // takes 8-12s per cold lookup, which blows past Chromium / WebKit's
  // ~5s autoplay-policy window — so when selectTrack later calls play()
  // after the URL arrives, the browser blocks it. Calling play() here on
  // a 1-frame silent MP3 *during the gesture* permanently grants this
  // <audio> element autoplay rights for the rest of the session.
  if (player.audio) {
    const SILENT_MP3 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMABUSVQyAAAAAAAAAAA='
    const a = player.audio
    const wasMuted = a.muted
    a.muted = true
    a.src = SILENT_MP3
    a.play().then(() => {
      a.pause()
      a.removeAttribute('src')
      a.load()
      a.muted = wasMuted
    }).catch(() => { a.muted = wasMuted })
  }

  if (beginResolve) { beginResolve(); beginResolve = null }
}

// When the user actually starts playing a playlist track, the ambient bed
// should yield — the listener has "moved on" from the DJ-intro atmosphere.
watch(() => player.isPlaying, (playing) => {
  if (playing) ambient.pause()
})

// Global keyboard shortcuts — skip if the user is typing in an input /
// textarea / contenteditable so we don't hijack chat input.
function isTypingTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (isTypingTarget(e.target)) return
  if (player.isLoading) return
  if (e.code === 'Space') {
    e.preventDefault()
    player.togglePlay()
  } else if (e.code === 'ArrowRight') {
    e.preventDefault()
    player.nextTrack()
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault()
    player.prevTrack()
  } else if (e.code === 'ArrowUp') {
    e.preventDefault()
    player.setVolume(Math.min(1, player.volume + 0.05))
  } else if (e.code === 'ArrowDown') {
    e.preventDefault()
    player.setVolume(Math.max(0, player.volume - 0.05))
  } else if (e.key === 'f' || e.key === 'F') {
    if (player.currentTrack) player.toggleFavorite(player.currentTrack)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
function onWelcomeStart(taste) {
  if (welcomeResolve) { welcomeResolve(taste); welcomeResolve = null }
}
function onRevealMain() {
  mainInterfaceReady.value = true
}
function onDJDone() {
  playerChromeReady.value = true
  if (djDoneResolve) { djDoneResolve(); djDoneResolve = null }
}

// Time-aware fallback so users never see "Evening" at midday when the
// greeting API is slow or down. Mirrors the server's timeOfDay buckets.
function fallbackGreeting() {
  const h = new Date().getHours()
  if (h < 5)  return "Late night. The world's quiet — let's keep it low."
  if (h < 9)  return "Early morning. Ease in — something gentle to start."
  if (h < 12) return "Morning. Let's set the tone for the day."
  if (h < 14) return "Midday. Something easy while you reset."
  if (h < 17) return "Afternoon. Let's keep the rhythm moving."
  if (h < 20) return "Early evening. Wind it down — softly."
  if (h < 23) return "Evening. Let's see what tonight sounds like."
  return "Late night. The world's quiet — let's keep it low."
}

async function fetchGreeting() {
  try {
    await apiReady
    // No provider — server picks its speed-priority order (Kimi first).
    const res = await fetch(`${apiBase.value}/api/greeting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    if (!res.ok) return ''
    const data = await res.json()
    return (data.greeting || '').trim()
  } catch { return '' }
}

async function fetchDJMonologue(track, userContext = '') {
  try {
    await apiReady
    const res = await fetch(`${apiBase.value}/api/dj-monologue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track: { title: track?.title, artist: track?.artist, year: track?.year },
        userContext
      })
    })
    console.log(`[monologue] status=${res.status}`)
    if (!res.ok) return null
    const data = await res.json()
    const b = data.beats || {}
    const ordered = [b.identity, b.moment, b.origin, b.sensation, b.title, b.closer]
        .filter(s => typeof s === 'string' && s.trim())
    console.log(`[monologue] received ${ordered.length} beats`)
    return ordered.length >= 3 ? ordered : null
  } catch (e) {
    console.warn('[monologue] fetch failed:', e.message)
    return null
  }
}

const backgroundStyle = computed(() => ({
  background: isDark.value
    ? 'radial-gradient(ellipse at 30% 20%, rgba(176,102,109,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(167,196,255,0.05) 0%, transparent 50%), #0a0809'
    : 'radial-gradient(ellipse at 30% 20%, rgba(255,167,167,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(167,196,255,0.1) 0%, transparent 50%), #F4EEF0'
}))

onMounted(async () => {
  // Ensure provider list is loaded so curate can request the user's selected LLM
  settings.fetchProviders().catch(() => {})

  // Pull today's calendar events in parallel with the curate flow so the
  // schedule panel + curate prompt have data ready as soon as possible.
  // Errors swallowed: an empty events list is the natural fallback.
  calendar.refresh().catch(() => {})
  calendar.startAutoRefresh()

  // Kick off greeting + first curate in parallel. Landing waits for greeting
  // so the brand, text and button all appear together — no two-stage reveal.
  const greetingPromise = fetchGreeting()
  const initialCuratePromise = player.curatePlaylist({
    provider: settings.llmProvider,
    taste: settings.taste,
    calendarUrls: settings.preferences.calendarUrls
  })

  // Wait up to 3.5s for greeting; if LLM is slow / down, use a static opener
  // so the user isn't stuck on the loader.
  loadingMessage.value = 'Tuning in…'
  const greetingTimeout = new Promise((r) => setTimeout(() => r(''), 3500))
  const g = await Promise.race([greetingPromise, greetingTimeout])
  greeting.value = g || fallbackGreeting()

  // 1) Landing — everything appears at once (brand + greeting + button).
  player.isLoading = false
  showLanding.value = true
  await new Promise((resolve) => { beginResolve = resolve })
  showLanding.value = false

  // 2) First-time only: Welcome questionnaire. Returning users skip straight
  //    to the DJ speaking overlay.
  let curated
  if (!settings.taste.onboarded) {
    showWelcome.value = true
    const userTaste = await new Promise((resolve) => { welcomeResolve = resolve })
    const filledSomething =
      userTaste.genres.length > 0 ||
      userTaste.vibes.length > 0 ||
      userTaste.artists.trim().length > 0
    settings.setTaste(userTaste)
    showWelcome.value = false

    // Loader covers the (potentially) 3-5s curate so the main UI isn't flashed
    // behind an empty overlay.
    player.isLoading = true
    loadingMessage.value = filledSomething ? 'Reading your taste…' : 'AI DJ is picking tonight\'s set...'

    curated = filledSomething
      ? await player.curatePlaylist({ provider: settings.llmProvider, taste: settings.taste, calendarUrls: settings.preferences.calendarUrls })
      : await initialCuratePromise
    player.isLoading = false
  } else {
    player.isLoading = true
    loadingMessage.value = 'AI DJ is picking tonight\'s set...'
    // Min display time so the loading icon is actually visible even when
    // curate already resolved (the kick-off happens at app boot, well
    // before the user clicks BEGIN — so the await here is often instant
    // and Vue batches isLoading 0→1→0 within a tick = invisible loader).
    await Promise.all([
      initialCuratePromise.then(c => { curated = c }),
      new Promise(r => setTimeout(r, 800))
    ])
    player.isLoading = false
  }

  if (curated) {
    console.log(`[Player] Curated via ${curated.source}${curated.seed ? ' (seed: ' + curated.seed + ')' : ''}`)
    // Mirror the freshly-curated queue into the schedule cache as the
    // current block's set so the panel shows it as "ready" without a
    // second LLM round-trip.
    schedule.setBlockTracks(currentBlockId.value, [...player.queue])
  } else {
    console.warn('[Player] Curate failed; falling back to legacy init')
    await player.initPlaylist('Nujabes')
  }

  // 2.5) BootDiagnostic + monologue preload run in PARALLEL. Without this
  //      preload, the DJ overlay would appear after BootDiagnostic and
  //      THEN start the monologue fetch — a ~2-4s LLM round-trip the user
  //      sits through staring at silent text. By kicking it off here, by
  //      the time the boot finishes, the monologue is usually already in
  //      hand and TTS audio is warm in the server cache.
  schedule.curateFullDay({
    provider: settings.llmProvider,
    taste: settings.taste,
    calendarUrls: settings.preferences.calendarUrls
  }).catch(() => {})

  const firstTrack = player.queue[0] || {}
  const userContextHints = [
    settings.taste.vibes.length ? `after a ${settings.taste.vibes.join(' / ')} kind of day` : '',
    settings.taste.artists ? `someone who loves ${settings.taste.artists}` : ''
  ].filter(Boolean).join(', ')

  // Pre-fetch monologue and warm TTS cache for every beat as soon as the
  // beats arrive. Wrapped so the boot overlay can race against it later.
  const monologuePromise = fetchDJMonologue(firstTrack, userContextHints)
    .then(beats => {
      const final = beats || [
        "This is Kimi Radio.",
        greeting.value || "Tonight's set is ready.",
        firstTrack.title ? `We're opening with ${firstTrack.title}${firstTrack.artist ? ' by ' + firstTrack.artist : ''}.` : '',
        "Settle in.",
      ].filter(Boolean)
      // Mirror DJSpeakingOverlay's fullMonologue computation EXACTLY so
      // the md5 cache key matches and speak() resolves instantly.
      const fullText = final.map(b => {
        const t = (b || '').trim()
        if (!t) return ''
        return /[.!?…]$/.test(t) ? t : t + '.'
      }).filter(Boolean).join(' ')
      tts.preload(fullText)
      return final
    })

  showBoot.value = true
  await new Promise((resolve) => { bootResolve = resolve })
  showBoot.value = false

  // 3) Show DJ overlay. Monologue + TTS audio are usually already cached
  //    (kicked off above before BootDiagnostic) so the text appears almost
  //    immediately and the audio plays without buffer delay.
  showDJ.value = true
  djBeats.value = await monologuePromise

  await new Promise((resolve) => { djDoneResolve = resolve })
  showDJ.value = false
})
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

/* Main interface reveal — pure translateY slide, no scale (scale creates a
   "pop" feel rather than a glide). Opacity fades in over 1.5s so the
   PlayerCard is visible early; the translation then takes a full 7s over
   90px on a near-linear curve so the slide is continuously perceptible
   frame by frame. */
.main-reveal-enter-active {
  transition:
    opacity 1.5s cubic-bezier(0.33, 1, 0.68, 1),
    transform 7s cubic-bezier(0.45, 0.1, 0.55, 0.9);
}
.main-reveal-leave-active { transition: opacity 0.6s ease; }
.main-reveal-enter-from {
  opacity: 0;
  transform: translateY(90px);
}
.main-reveal-leave-to {
  opacity: 0;
}

/* Chrome slot — AlbumWidgets wrapper. Always rendered so PlayerCard stays
   at its final centered-with-widgets position from the moment it appears
   (no horizontal layout jump). Content fades + lifts in once PlayerCard has
   finished its 7s main-reveal glide. */
.chrome-slot {
  transition:
    opacity 1.2s cubic-bezier(0.33, 1, 0.68, 1),
    transform 1.5s cubic-bezier(0.33, 1, 0.68, 1);
  opacity: 1;
  transform: translateY(0);
}
.chrome-slot.chrome-slot-hidden {
  opacity: 0;
  transform: translateY(24px);
  pointer-events: none;
}
</style>
