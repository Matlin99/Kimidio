<template>
  <Transition name="boot-fade">
    <div v-if="show" class="boot-root fixed inset-0 z-50 flex items-center justify-center p-6"
      :style="backgroundStyle">

      <!-- Terminal window -->
      <div class="terminal w-[640px] max-w-[92vw] rounded-xl overflow-hidden shadow-2xl border border-white/10"
        style="background: rgba(15, 11, 14, 0.92); backdrop-filter: blur(14px);">

        <!-- macOS title bar -->
        <div class="flex items-center gap-2 px-4 py-3 border-b border-white/5"
          style="background: rgba(0,0,0,0.25);">
          <span class="w-3 h-3 rounded-full bg-[#FF5F56]"></span>
          <span class="w-3 h-3 rounded-full bg-[#FFBD2E]"></span>
          <span class="w-3 h-3 rounded-full bg-[#27C93F]"></span>
          <span class="ml-3 text-[11px] text-white/40 tracking-wider font-mono">kimi — terminal</span>
          <span class="ml-auto text-[11px] text-white/30 tracking-wider font-mono">{{ appVersion }}</span>
        </div>

        <!-- Terminal body -->
        <div class="px-6 py-5 font-mono text-[14px] leading-[1.7] min-h-[420px]">
          <div v-for="(line, i) in linesShown" :key="i" :class="lineClass(line)">
            <span v-if="i === linesShown.length - 1 && !lastDone">
              <TypewriterText :text="line.text" :speed="line.speed || 14" @done="onLineDone" />
            </span>
            <span v-else>{{ line.text }}</span>
          </div>
          <!-- Blinking cursor at the end while sequence still running -->
          <span v-if="!finished" class="cursor"></span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { useSettingsStore } from '../stores/settings.js'
import { usePlayerStore } from '../stores/player.js'
import { useCalendarStore } from '../stores/calendar.js'
import TypewriterText from './TypewriterText.vue'
import { appVersion } from '../composables/useAppVersion.js'

const props = defineProps({
  show: { type: Boolean, default: false }
})
const emit = defineEmits(['done'])

const { isDark } = useTheme()
const settings = useSettingsStore()
const player = usePlayerStore()
const calendar = useCalendarStore()

import { apiBase, ready as apiReady } from '../composables/useApiBase.js'

// Pull the port out of apiBase so the terminal banner stays truthful even
// when the Tauri sidecar binds a random port at startup. Reactive so the
// banner re-renders if the port arrives mid-render.
const serverPort = computed(() => {
  try {
    const u = new URL(apiBase.value)
    return u.port || (u.protocol === 'https:' ? '443' : '80')
  } catch { return '8080' }
})

// Mountainous dawn gradient — gives the "terminal floating on desktop" feel
// matching the reference video. Dark mode tints rose/purple, light mode is
// warmer pinks; either way the terminal stays the focal point.
const backgroundStyle = computed(() => ({
  background: isDark.value
    ? 'linear-gradient(135deg, #1a0d12 0%, #0a0809 40%, #1a1228 100%)'
    : 'linear-gradient(135deg, #2a1a22 0%, #0a0809 40%, #1a1228 100%)',
  transition: 'opacity 0.6s cubic-bezier(0.32, 0.72, 0, 1)'
}))

// ── Diagnostic data, gathered upfront ─────────────────────────────────────
const diagData = ref({
  weather: '…',
  temperatureC: null,
  sunrise: '',
  sunset: '',
})

async function fetchTodayContext() {
  try {
    await apiReady
    const city = settings.preferences.weatherCity || 'Tokyo'
    const r = await fetch(`${apiBase.value}/api/today-context?city=${encodeURIComponent(city)}`,
      { signal: AbortSignal.timeout(5000) })
    if (r.ok) diagData.value = await r.json()
  } catch (e) {
    console.warn('[boot] context fetch failed:', e.message)
  }
}

// Categorize calendar events by simple keyword match. Crude but matches the
// reference video's "3 会议 · 1 运动 · 1 冥想" style breakdown.
function categorizeEvents(events) {
  const cats = { meeting: 0, workout: 0, meditation: 0, focus: 0, other: 0 }
  const re = {
    meeting:    /(meeting|会议|sync|1:1|1-on-1|standup|call|interview|面试)/i,
    workout:    /(gym|run|workout|exercise|健身|跑步|yoga|瑜伽|fitness|training)/i,
    meditation: /(meditat|冥想|mindful|breath|reflect)/i,
    focus:      /(focus|deep work|writing|学习|study|读书)/i
  }
  for (const ev of events) {
    const t = ev.summary || ev.label || ''
    if      (re.meeting.test(t))    cats.meeting++
    else if (re.workout.test(t))    cats.workout++
    else if (re.meditation.test(t)) cats.meditation++
    else if (re.focus.test(t))      cats.focus++
    else                             cats.other++
  }
  return cats
}

const dateStr = computed(() => {
  const d = new Date()
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${days[d.getDay()]}`
})

const dayName = computed(() => {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  return days[new Date().getDay()]
})

const scheduleLine = computed(() => {
  const evs = calendar.events || []
  if (!evs.length) return 'Schedule: clear today'
  const c = categorizeEvents(evs)
  const parts = []
  if (c.meeting)    parts.push(`${c.meeting} meeting${c.meeting > 1 ? 's' : ''}`)
  if (c.workout)    parts.push(`${c.workout} workout`)
  if (c.meditation) parts.push(`${c.meditation} meditation`)
  if (c.focus)      parts.push(`${c.focus} focus`)
  if (c.other)      parts.push(`${c.other} other`)
  return `Schedule: ${evs.length} event${evs.length > 1 ? 's' : ''} · ${parts.join(' · ')}`
})

const tasteLine = computed(() => {
  const tags = []
  if (settings.taste.genres?.length) tags.push(...settings.taste.genres.slice(0, 2))
  if (settings.taste.vibes?.length)  tags.push(...settings.taste.vibes.slice(0, 1))
  const tail = tags.length ? `  (${tags.join(', ')})` : ''
  return `Favorites: ${player.favorites.length} tracks${tail}`
})

// Tonight's curated set — printed near the bottom of the diagnostic so the
// user sees the AI DJ's actual picks before the overlay opens. Truncates
// strings to keep each row in one terminal line.
const PICKS_PREVIEW_COUNT = 3
function clip(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
const picksHeader = computed(() => {
  const n = player.queue.length
  return n
    ? `🎶  Tonight's set   [${n} track${n === 1 ? '' : 's'} queued]`
    : `🎶  Tonight's set   [tuning…]`
})
const picksRows = computed(() => {
  return player.queue.slice(0, PICKS_PREVIEW_COUNT).map((t, i) => {
    const num = String(i + 1).padStart(2, '0')
    const artist = clip(t.artist || 'Unknown', 22)
    const title = clip(t.title || 'Untitled', 30)
    return `►   ${num}  ${artist} — ${title}`
  })
})
const picksMoreLine = computed(() => {
  const remaining = player.queue.length - PICKS_PREVIEW_COUNT
  return remaining > 0 ? `    ...   +${remaining} more` : null
})

const weatherLine = computed(() => {
  const d = diagData.value
  const temp = Number.isFinite(d.temperatureC) ? `${d.temperatureC}°C` : ''
  const sunset = d.sunset ? `  Sunset: ${d.sunset}` : ''
  return `Weather: ${d.weather}${temp ? ' ' + temp : ''}${sunset}`
})

const sunriseLine = computed(() => {
  const sr = diagData.value.sunrise
  return sr ? `Sunrise: ${sr}  (${dayName.value})` : `Today: ${dayName.value}`
})

// ── Sequence definition ──────────────────────────────────────────────────
// Each line: { text, kind, postDelay }. postDelay = ms wait BEFORE next
// line starts typing. spacer kind has no typewriter, just a small pause.
const lines = computed(() => [
  { kind: 'cmd',           text: '> kimi start',                                postDelay: 250 },
  { kind: 'spacer',        text: '',                                            postDelay: 150 },
  { kind: 'box-rose-bold', text: '┌─ Kimi Server',                              postDelay: 100 },
  { kind: 'box-dim',       text: `│  listening on :${serverPort.value}`,        postDelay: 120 },
  { kind: 'box-bullet',    text: '│  ● connected to SoundCloud / Edge TTS',     postDelay: 180 },
  { kind: 'box-bullet',    text: '│  ● Kimi DJ Taste loaded',                   postDelay: 180 },
  { kind: 'box-bullet',    text: '│  ● your iCal calendar',                     postDelay: 180 },
  { kind: 'box-dim',       text: '└─',                                          postDelay: 280 },
  { kind: 'spacer',        text: '',                                            postDelay: 200 },
  { kind: 'header',        text: `🎧  Kimi DJ   ${dateStr.value}`,              postDelay: 200 },
  { kind: 'subheader',     text: 'Composing today\'s radio for you...',         postDelay: 350 },
  { kind: 'spacer',        text: '',                                            postDelay: 100 },
  { kind: 'info',          text: `●  ${sunriseLine.value}`,                     postDelay: 220 },
  { kind: 'info',          text: `●  ${weatherLine.value}`,                     postDelay: 220 },
  { kind: 'info',          text: `●  ${scheduleLine.value}`,                    postDelay: 220 },
  { kind: 'info',          text: `●  ${tasteLine.value}`,                       postDelay: 220 },
  { kind: 'spacer',        text: '',                                            postDelay: 120 },
  { kind: 'subheader',     text: picksHeader.value,                             postDelay: 200 },
  ...picksRows.value.map(text => ({ kind: 'pick', text, postDelay: 160 })),
  ...(picksMoreLine.value ? [{ kind: 'pick-dim', text: picksMoreLine.value, postDelay: 220 }] : []),
  { kind: 'spacer',        text: '',                                            postDelay: 120 },
  { kind: 'progress',      text: '::  Tuning audio output...',                  postDelay: 700 }
])

// Reveal lines one at a time. Spacer lines auto-skip (no typewriter).
const cursor = ref(0)             // index of the line currently being typed/shown
const lastDone = ref(true)        // is the latest typewriter done? (true while spacer is "active")
const finished = ref(false)

const linesShown = computed(() => lines.value.slice(0, cursor.value + 1))

function lineClass(line) {
  switch (line.kind) {
    case 'cmd':           return 'text-primary-cream/90'
    case 'box-rose-bold': return 'text-primary-rose font-bold'
    case 'box-dim':       return 'text-primary-cream/40'
    case 'box-bullet':    return 'text-primary-cream/85'
    case 'header':        return 'text-primary-cream font-bold'
    case 'subheader':     return 'text-primary-cream/60 italic'
    case 'info':          return 'text-primary-cream/80'
    case 'pick':          return 'text-primary-cream/85'
    case 'pick-dim':      return 'text-primary-cream/40 italic'
    case 'progress':      return 'text-primary-rose/80'
    case 'spacer':        return 'h-2'  // small vertical gap
    default:              return 'text-primary-cream/80'
  }
}

let advanceTimer = null

function advance() {
  if (cursor.value >= lines.value.length - 1) {
    finished.value = true
    // Final beat after the last line, then emit done
    setTimeout(() => emit('done'), 600)
    return
  }
  cursor.value += 1
  const next = lines.value[cursor.value]
  if (next.kind === 'spacer') {
    // Spacers skip the typewriter and auto-advance after their delay
    lastDone.value = true
    advanceTimer = setTimeout(advance, next.postDelay || 150)
  } else {
    lastDone.value = false
  }
}

function onLineDone() {
  lastDone.value = true
  const cur = lines.value[cursor.value]
  if (advanceTimer) clearTimeout(advanceTimer)
  advanceTimer = setTimeout(advance, cur?.postDelay || 200)
}

// Start sequence when shown becomes true. Pre-fetches the today-context
// data so the diagnostic lines have real values when they render.
async function start() {
  if (advanceTimer) clearTimeout(advanceTimer)
  cursor.value = 0
  lastDone.value = false
  finished.value = false
  // Best-effort: refresh weather + calendar before rendering
  await Promise.allSettled([
    fetchTodayContext(),
    calendar.refresh()
  ])
  // First line (cmd) starts typing immediately. lastDone=false enables it.
}

watch(() => props.show, (v) => { if (v) start() }, { immediate: true })
onMounted(() => { if (props.show) start() })
</script>

<style scoped>
.boot-fade-enter-active { transition: opacity 0.6s cubic-bezier(0.32, 0.72, 0, 1); }
.boot-fade-leave-active { transition: opacity 0.5s cubic-bezier(0.32, 0.72, 0, 1); }
.boot-fade-enter-from, .boot-fade-leave-to { opacity: 0; }

.terminal {
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Cascadia Code', monospace;
}

.cursor {
  display: inline-block;
  width: 8px;
  height: 16px;
  background: #B0666D;
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 0.85s steps(2) infinite;
}
@keyframes blink {
  50% { opacity: 0; }
}
</style>
