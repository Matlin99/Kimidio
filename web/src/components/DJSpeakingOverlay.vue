<template>
  <Transition name="dj-fade">
    <div v-if="show" class="dj-root fixed inset-0 flex items-center justify-center p-4 overflow-hidden"
      :class="[isDark ? 'dj-root-dark' : 'dj-root-light', { 'dj-exiting': exiting, 'dj-inserting': inserting }]">

      <!-- Ambient glow -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute -top-1/4 left-1/4 w-[700px] h-[700px] rounded-full opacity-25 blur-3xl"
          :class="isDark ? 'bg-gradient-to-br from-rose-900/50 to-purple-900/30' : 'bg-gradient-to-br from-rose-200/60 to-pink-200/40'"></div>
        <div class="absolute -bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
          :class="isDark ? 'bg-gradient-to-tl from-rose-800/40 to-purple-900/20' : 'bg-gradient-to-tl from-blue-200/50 to-purple-200/30'"></div>
      </div>

      <div class="morph-wrap relative z-10">
        <!-- Cassette layer (hidden until exit) -->
        <div class="morph-box">

          <!-- DJ layer -->
          <div class="dj-layer">
            <!-- Speaking header -->
            <div class="dj-header">
              <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-2.5">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center bg-primary-rose/30 border border-primary-rose/50">
                    <svg width="14" height="14" viewBox="0 0 80 80" fill="none">
                      <rect x="10" y="25" width="60" height="40" rx="8" stroke="#B0666D" stroke-width="5" fill="none"/>
                      <circle cx="30" cy="45" r="8" stroke="#B0666D" stroke-width="4" fill="none"/>
                    </svg>
                  </div>
                  <div class="font-mono text-[22px] tracking-[0.06em] leading-none text-white">Kimi</div>
                </div>
                <div class="flex items-center gap-3">
                  <div class="font-mono text-[11px] text-white/60 tabular-nums">{{ elapsedLabel }}</div>
                  <!-- Use @pointerdown so we beat the window-level autoplay
                       gesture-unlock handler to the punch (it bubbles up on
                       the same pointerdown event and would otherwise restart
                       TTS just before our skip() runs). -->
                  <button @pointerdown.stop="skip" @click.stop="skip" v-if="!exiting"
                    class="text-[10px] uppercase tracking-[0.2em] font-grotesk text-white/50 hover:text-primary-rose transition-colors duration-200 ease-out-expo flex items-center gap-1">
                    Skip
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 2l5 4-5 4M9 2v8"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="flex items-center gap-1.5 ml-[38px] mb-3">
                <span class="w-1.5 h-1.5 rounded-full bg-primary-rose animate-dj-pulse"></span>
                <span class="text-[11px] font-grotesk text-primary-rose/90">
                  {{ tts.isSpeaking.value ? 'Speaking…' : 'Idle' }}
                </span>
              </div>

              <!-- Waveform -->
              <div class="flex items-end justify-center gap-[2px] h-[70px]">
                <span v-for="i in 48" :key="i"
                  class="dj-wave-bar w-[3px] rounded-full bg-white/80"
                  :style="{
                    '--delay': (i * 0.05) + 's',
                    '--base': (20 + Math.abs(Math.sin(i * 0.6)) * 40) + 'px',
                    '--peak': (45 + Math.abs(Math.cos(i * 0.35)) * 30) + 'px',
                  }"></span>
              </div>
            </div>

            <!-- Stacked transcript — entire block fades from dim to full
                 colour in one synchronous wash when beats arrive. Once
                 revealed, stays full colour for the rest of the speech. -->
            <div class="dj-transcript"
              :class="transcriptRevealed ? 'transcript-revealed' : 'transcript-pending'">
              <template v-if="beats.length">
                <p v-for="(beat, i) in beats" :key="i" class="beat-text">
                  <span v-for="(word, wi) in splitWords(beat)" :key="wi" class="beat-word">
                    {{ word }}
                  </span>
                </p>
              </template>
              <!-- Waiting state while monologue fetches — small pulse -->
              <div v-else class="flex items-center gap-1.5 mt-2">
                <span class="w-1.5 h-1.5 rounded-full bg-primary-rose/60 animate-dj-pulse"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-primary-rose/60 animate-dj-pulse" style="animation-delay: 150ms"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-primary-rose/60 animate-dj-pulse" style="animation-delay: 300ms"></span>
              </div>
            </div>
          </div>

          <!-- Cassette layer (unchanged) -->
          <div class="cassette-layer" aria-hidden="true">
            <div class="cassette-body">
              <div class="cassette-label">
                <span class="cassette-brand">KIMI · MIX</span>
                <span class="cassette-side">SIDE A</span>
              </div>
              <div class="cassette-window">
                <div class="cassette-reel reel-left"><div class="reel-spokes"></div></div>
                <div class="cassette-reel reel-right"><div class="reel-spokes"></div></div>
                <div class="cassette-tape"></div>
              </div>
              <div class="cassette-holes">
                <div class="hole"></div>
                <div class="hole"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { tts } from '../composables/useTTS.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  beats: { type: Array, default: () => [] }   // array of strings, 6 beats
})
const emit = defineEmits(['done', 'revealMain'])
const { isDark } = useTheme()

const exiting = ref(false)
const inserting = ref(false)
const elapsedMs = ref(0)
const currentBeatIdx = ref(-1)
const currentWordIdx = ref(-1)
const beatStamps = ref([])   // display string per beat, e.g. "0:03"
const transcriptRevealed = ref(false)   // flips true ~200ms after beats render
                                         // so the dim→full colour wash is visible
let revealTimer = null
watch(() => props.beats.length, (n) => {
  if (n > 0 && !transcriptRevealed.value) {
    if (revealTimer) clearTimeout(revealTimer)
    revealTimer = setTimeout(() => { transcriptRevealed.value = true }, 200)
  }
}, { immediate: true })

function splitWords(text) {
  return (text || '').split(/\s+/).filter(Boolean)
}

// Flat list of every word across all beats, with back-reference to which
// beat / index-within-beat it belongs to. Used for single-audio progress
// tracking: we synthesize the whole monologue as ONE MP3 so speech flows
// without pauses between beats, then map audio time → word → beat.
const flatWords = computed(() => {
  const result = []
  props.beats.forEach((beat, beatIdx) => {
    splitWords(beat).forEach((word, wi) => {
      result.push({ word, beatIdx, wi })
    })
  })
  return result
})

// Single text sent to TTS. Beats joined with a period + space when the
// source line doesn't already end with sentence-final punctuation, so
// Edge TTS inserts natural micro-pauses between them without stopping.
const fullMonologue = computed(() =>
  props.beats.map(b => {
    const t = (b || '').trim()
    if (!t) return ''
    return /[.!?…]$/.test(t) ? t : t + '.'
  }).filter(Boolean).join(' ')
)


function formatTime(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}
const elapsedLabel = computed(() => formatTime(elapsedMs.value))

let rafId = null
let startedAt = 0
let cancelled = false

// English speech pace for Edge TTS (Ava Multilingual Neural voice) —
// measured empirically: 257 chars produced a 19.7s mp3 = ~13 chars/sec.
// Using slightly slower (12.8) so highlight trails just behind the voice
// rather than racing ahead — easier to read.
const CHARS_PER_SECOND = 12.8

function tick() {
  elapsedMs.value = performance.now() - startedAt
  // Map audio progress → flat-word index → beat + word-in-beat. Under
  // streaming TTS, audio.duration is Infinity until the stream finishes, so
  // prefer a char-rate estimate (text length / pace). Falls back to the
  // actual duration once it's known and finite (for cached fully-loaded mp3).
  if (tts.isSpeaking.value && flatWords.value.length) {
    const audio = tts.audio
    const t = audio.currentTime || 0
    const totalChars = flatWords.value.reduce((s, w) => s + w.word.length + 1, 0)
    const d = audio.duration
    const effectiveDuration = (d && isFinite(d) && d > 0) ? d : (totalChars / CHARS_PER_SECOND)
    const pos = (t / effectiveDuration) * totalChars
    let acc = 0
    for (let k = 0; k < flatWords.value.length; k++) {
      acc += flatWords.value[k].word.length + 1
      if (pos <= acc) {
        const { beatIdx, wi } = flatWords.value[k]
        if (currentBeatIdx.value !== beatIdx) {
          currentBeatIdx.value = beatIdx
          if (!beatStamps.value[beatIdx]) {
            beatStamps.value[beatIdx] = formatTime(elapsedMs.value)
          }
        }
        currentWordIdx.value = wi
        break
      }
    }
  }
  rafId = requestAnimationFrame(tick)
}

async function playAllBeats() {
  // Single continuous TTS call — one MP3, one network fetch, no gaps
  // between beats. The tick() loop handles which beat/word lights up.
  if (beatStamps.value[0] === null) beatStamps.value[0] = '0:00'
  currentBeatIdx.value = 0
  currentWordIdx.value = 0
  await tts.speak(fullMonologue.value, { force: true })
  if (cancelled) return

  // Mark the final word of the final beat as "current" for the linger.
  const lastIdx = props.beats.length - 1
  currentBeatIdx.value = lastIdx
  currentWordIdx.value = splitWords(props.beats[lastIdx]).length - 1
}

let started = false
let outroStarted = false

// Trigger the cassette eject sequence. Idempotent — guarded by outroStarted
// so begin()'s natural flow and skip() can race without double-firing.
function runOutro() {
  if (outroStarted) return
  outroStarted = true
  exiting.value = true
  setTimeout(() => emit('revealMain'), 2600)
  setTimeout(() => { inserting.value = true }, 3900)
  setTimeout(() => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    emit('done')
  }, 5000)
}

// User pressed Skip — kill TTS, jump straight to the cassette animation.
function skip() {
  if (outroStarted) return
  tts.stop()
  runOutro()
}

async function begin() {
  if (started) return
  started = true
  cancelled = false   // reset here, since the initial !show callback may have set it
  outroStarted = false
  exiting.value = false
  inserting.value = false
  currentBeatIdx.value = -1
  currentWordIdx.value = -1
  elapsedMs.value = 0
  beatStamps.value = new Array(props.beats.length).fill(null)
  startedAt = performance.now()
  if (rafId) cancelAnimationFrame(rafId)
  tick()

  await playAllBeats()
  if (cancelled || outroStarted) return

  await new Promise((r) => setTimeout(r, 2200))
  if (cancelled || outroStarted) return

  runOutro()
}

// Overlay is shown immediately after curate; beats arrive shortly after.
// Trigger playback as soon as BOTH are ready so the glitch entrance can run
// in parallel with the LLM monologue fetch (saves ~1-2s perceived delay).
//
// outroStarted guard: if the user pressed Skip during the waiting state
// (before beats arrived), the cassette outro is already running. Beats may
// land mid-animation — without this guard, begin() would fire and reset
// outroStarted/exiting back to false, popping the DJ overlay back open.
watch(
  () => [props.show, props.beats.length],
  ([showing, hasBeats]) => {
    if (showing && hasBeats && !started && !outroStarted) begin()
    else if (!showing && started) {
      // Only cancel if we actually had an active run
      cancelled = true
      started = false
      tts.stop()
      if (rafId) { cancelAnimationFrame(rafId); rafId = null }
      // Reset transcript reveal so the next session fades in fresh
      transcriptRevealed.value = false
      if (revealTimer) { clearTimeout(revealTimer); revealTimer = null }
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  cancelled = true
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<style scoped>
/* ── Backdrop ─────────────────────────────────────────────────────── */
.dj-root { z-index: 50; }
.dj-inserting { z-index: 0; }

.dj-root-dark { background-color: rgb(10, 8, 9); }
.dj-root-light { background-color: rgb(244, 238, 240); }

.dj-fade-enter-active { transition: opacity 0.8s cubic-bezier(0.33, 1, 0.68, 1); }
.dj-fade-leave-active { transition: opacity 0.4s ease-out; }
.dj-fade-enter-from, .dj-fade-leave-to { opacity: 0; }

.dj-exiting.dj-root-dark {
  animation: dj-bg-dark-fade 5s cubic-bezier(0.33, 1, 0.68, 1) forwards;
}
.dj-exiting.dj-root-light {
  animation: dj-bg-light-fade 5s cubic-bezier(0.33, 1, 0.68, 1) forwards;
}
@keyframes dj-bg-dark-fade {
  0%, 52% { background-color: rgb(10, 8, 9); }
  78%     { background-color: rgba(10, 8, 9, 0); }
  100%    { background-color: rgba(10, 8, 9, 0); }
}
@keyframes dj-bg-light-fade {
  0%, 52% { background-color: rgb(244, 238, 240); }
  78%     { background-color: rgba(244, 238, 240, 0); }
  100%    { background-color: rgba(244, 238, 240, 0); }
}

/* ── Morph wrap ───────────────────────────────────────────────────── */
.morph-wrap {
  animation: dj-glitch-in 1.4s cubic-bezier(0.22, 1, 0.36, 1) both;
  transform-origin: 50% 50%;
}
@keyframes dj-glitch-in {
  0%   { opacity: 0; transform: scale(1.04); filter: blur(10px) saturate(1.3); }
  35%  { opacity: 0.55; transform: scale(1.025); filter: blur(5px) saturate(1.2); }
  65%  { opacity: 0.9; transform: scale(1.01); filter: blur(1.5px) saturate(1.05); }
  100% { opacity: 1; transform: scale(1); filter: none; }
}

.dj-exiting .morph-wrap {
  animation: dj-eject 5s cubic-bezier(0.33, 1, 0.68, 1) forwards;
}
@keyframes dj-eject {
  0%, 36% { transform: translateX(0)      rotate(0deg);   opacity: 1; }
  52%     { transform: translateX(0)      rotate(0deg);   opacity: 1; }
  64%     { transform: translateX(0)      rotate(-90deg); opacity: 1; }
  78%     { transform: translateX(-320px) rotate(-90deg); opacity: 1; }
  96%     { transform: translateX(0)      rotate(-90deg); opacity: 1; }
  100%    { transform: translateX(0)      rotate(-90deg); opacity: 0; }
}

/* ── Morph box ────────────────────────────────────────────────────── */
.morph-box {
  position: relative;
  width: 380px;
  height: 560px;   /* taller to fit 6 transcript rows */
  background: rgba(15, 11, 14, 0.65);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  transition:
    width 1.8s cubic-bezier(0.33, 1, 0.68, 1),
    height 1.8s cubic-bezier(0.33, 1, 0.68, 1),
    border-radius 1.8s cubic-bezier(0.33, 1, 0.68, 1),
    background-color 1.8s cubic-bezier(0.33, 1, 0.68, 1),
    box-shadow 1.8s cubic-bezier(0.33, 1, 0.68, 1);
}
.dj-exiting .morph-box {
  width: 220px;
  height: 138px;
  border-radius: 8px;
  background-color: #140a0c;
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    inset 0 -1px 0 rgba(0, 0, 0, 0.4);
}

/* ── DJ content ───────────────────────────────────────────────────── */
.dj-layer {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  opacity: 1;
  transition: opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1);
}
.dj-exiting .dj-layer { opacity: 0; }

.dj-header {
  background: rgba(15, 11, 14, 0.75);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding: 20px 20px 24px;
  overflow: hidden;
}

.dj-transcript {
  flex: 1;
  background: #FFFFFF;
  padding: 22px 22px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Two-phase reveal so the no-text → has-text gap reads smoothly:
   Phase 1 (0–500ms): the whole transcript fades from opacity 0 → 1,
                      with words rendering in dim colour. iOS curve.
   Phase 2 (200–1100ms): word colour eases from dim → full deep. The
                         color transition has a 0.2s delay so opacity
                         visibly settles first, avoiding the "too many
                         things changing" feel.
   transition-property is split per phase so we can give them different
   durations + delays without fighting each other. */
.dj-transcript {
  opacity: 0;
  transition: opacity 0.55s cubic-bezier(0.32, 0.72, 0, 1);
}
.dj-transcript.transcript-revealed {
  opacity: 1;
}

.beat-text {
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: 17px;
  line-height: 1.45;
  margin: 0;
}
.beat-word {
  display: inline-block;
  margin-right: 0.22em;
  color: rgba(15, 11, 14, 0.32);   /* dim baseline */
  transition: color 0.9s cubic-bezier(0.32, 0.72, 0, 1) 0.2s;
}
.transcript-revealed .beat-word {
  color: rgb(15, 11, 14);
}

/* ── Cassette (unchanged) ─────────────────────────────────────────── */
.cassette-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) 1.0s;
  pointer-events: none;
}
.dj-exiting .cassette-layer { opacity: 1; }

.cassette-body {
  position: relative;
  width: 220px;
  height: 138px;
}
.cassette-label {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  height: 34px;
  background: linear-gradient(180deg, #F4EEF0 0%, #E8D7DB 100%);
  border-radius: 3px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 10px;
  font-family: 'VT323', monospace;
  color: #0F0B0E;
  letter-spacing: 0.12em;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.08);
}
.cassette-brand { font-size: 14px; }
.cassette-side {
  font-size: 10px;
  color: #B0666D;
  letter-spacing: 0.25em;
}
.cassette-window {
  position: absolute;
  top: 54px;
  left: 18px;
  right: 18px;
  bottom: 24px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.7));
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}
.cassette-reel {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 50%, #3a1e22 0%, #1a0d10 70%);
  border: 1.5px solid rgba(176, 102, 109, 0.35);
  animation: cassette-spin 1.6s linear infinite;
}
.reel-spokes {
  position: absolute;
  inset: 6px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 50%, transparent 30%, #B0666D 30%, #B0666D 35%, transparent 35%),
    conic-gradient(from 0deg,
      #0a0809 0deg 20deg, #2a1518 20deg 40deg,
      #0a0809 40deg 80deg, #2a1518 80deg 100deg,
      #0a0809 100deg 140deg, #2a1518 140deg 160deg,
      #0a0809 160deg 200deg, #2a1518 200deg 220deg,
      #0a0809 220deg 260deg, #2a1518 260deg 280deg,
      #0a0809 280deg 320deg, #2a1518 320deg 340deg,
      #0a0809 340deg 360deg);
}
.cassette-tape {
  position: absolute;
  top: 50%;
  left: 20px;
  right: 20px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(176, 102, 109, 0.4) 20%, rgba(176, 102, 109, 0.4) 80%, transparent);
  transform: translateY(-0.5px);
}
.cassette-holes {
  position: absolute;
  bottom: 6px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 14px;
}
.hole {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #000;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05);
}
@keyframes cassette-spin { to { transform: rotate(360deg); } }

/* ── Waveform bars ────────────────────────────────────────────────── */
.dj-wave-bar {
  height: var(--base);
  animation: dj-wave 1.1s ease-in-out infinite;
  animation-delay: var(--delay);
}
@keyframes dj-wave {
  0%, 100% { height: var(--base); opacity: 0.65; }
  50% { height: var(--peak); opacity: 1; }
}
@keyframes dj-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}
.animate-dj-pulse { animation: dj-pulse 1.2s ease-in-out infinite; }
</style>
