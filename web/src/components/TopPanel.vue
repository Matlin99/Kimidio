<template>
  <div class="relative px-5 pt-4 pb-3 transition-theme"
    :class="isDark ? 'bg-primary-dark' : 'bg-primary-dark'">
    
    <div class="grid grid-cols-[80px_1fr_80px] items-end">
      <!-- Left: Album Cover + Profile Button -->
      <div class="flex flex-col items-center gap-2 justify-self-center">
        <div class="w-20 h-20 rounded-lg overflow-hidden shadow-lg cursor-pointer group relative"
          @click="settings.toggleProfile">
          <Transition name="cover-swap" mode="out-in">
            <img 
              v-if="currentTrack"
              :key="currentTrack.id"
              :src="currentTrack.cover || `https://picsum.photos/seed/${currentTrack.id}/160/160`" 
              :alt="currentTrack.title"
              class="w-full h-full object-cover transition-transform duration-300 ease-out-expo group-hover:scale-110"
            />
          </Transition>
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 ease-out-expo flex items-center justify-center">
            <svg class="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out-expo" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
        </div>
      </div>
      
      <!-- Center: Clock & Title -->
      <div class="flex-1 flex flex-col items-center px-4">
        <!-- INSTALL Label -->
        <p class="text-[9px] font-medium tracking-[0.4em] uppercase text-primary-rose mb-1 font-grotesk">
          Install
        </p>
        
        <!-- Dot Matrix Clock -->
        <div class="font-mono text-[36px] font-bold text-white leading-none tracking-wider"
          style="font-family: 'VT323', monospace;">
          <span>{{ timeParts.h }}</span><span class="colon-breathe">:</span><span>{{ timeParts.m }}</span>
        </div>
        
        <!-- INTERLUDE + Waveform -->
        <div class="flex items-end gap-2 mt-1">
          <span class="text-[9px] font-medium tracking-[0.3em] uppercase text-primary-rose font-grotesk">
            Interlude
          </span>
          <!-- Dynamic Waveform Bars -->
          <div class="flex items-end gap-[2px] h-4">
            <div v-for="i in 16" :key="i" 
              class="w-[2px] rounded-full bg-gradient-to-t from-primary-rose to-primary-pink transition-[height,opacity] duration-100 ease-out"
              :style="getWaveBarStyle(i)"></div>
          </div>
        </div>
      </div>
      
      <!-- Right: Settings / Expand Button -->
      <div class="flex flex-col gap-2 justify-self-center">
        <!-- Settings Button -->
        <button @click="settings.toggleSettings"
          class="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200 ease-out-expo"
          :class="isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-white/10 hover:bg-white/20'">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" class="text-white/70">
            <rect x="2" y="3" width="5" height="3" rx="1" fill="currentColor"/>
            <rect x="9" y="3" width="5" height="3" rx="1" fill="currentColor" opacity="0.5"/>
            <rect x="2" y="10" width="5" height="3" rx="1" fill="currentColor" opacity="0.5"/>
            <rect x="9" y="10" width="5" height="3" rx="1" fill="currentColor"/>
          </svg>
        </button>
        
        <!-- Expand button (only when collapsed). Cycles forward through
             three view modes: hidden → mini → full → hidden. The label tip
             tells the user where the next click takes them. -->
        <button v-if="player.viewMode !== 'full'" @click="player.cycleViewModeUp"
          :title="player.viewMode === 'hidden' ? 'Expand to mini status' : 'Expand to full app'"
          class="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ease-spring hover:scale-110 animate-pulse-dot"
          :class="isDark ? 'bg-primary-rose/20 hover:bg-primary-rose/30 text-primary-rose' : 'bg-primary-rose/10 hover:bg-primary-rose/20 text-primary-rose'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
      </div>
    </div>
    
    <!-- Bottom Row: Date & Theme Toggle -->
    <div class="grid grid-cols-[80px_1fr_80px] items-center mt-3">
      <!-- DK Button (Dark) -->
      <button @click="setTheme(true)"
        class="text-[9px] tracking-[0.3em] uppercase transition-colors duration-200 ease-out-expo px-2 py-1 rounded font-grotesk justify-self-start"
        :class="isDark ? 'text-primary-rose font-semibold' : 'text-white/50 hover:text-white/70'">
        DK
      </button>
      
      <!-- Date + Time-of-day block badge -->
      <div class="flex items-center gap-2 justify-self-center">
        <p class="text-[9px] tracking-[0.15em] uppercase text-white/70 font-grotesk">
          {{ currentDate }}
        </p>
        <button @click="schedule.toggle"
          class="text-[8px] uppercase tracking-[0.25em] font-grotesk px-1.5 py-0.5 rounded-full bg-primary-rose/20 text-primary-rose border border-primary-rose/30 transition-all duration-200 ease-out-expo hover:bg-primary-rose/30 hover:border-primary-rose/50 hover:scale-105 cursor-pointer"
          :class="{ 'animate-block-shift': blockJustChanged }"
          :title="blockJustChanged ? `${timeBlock} just started — tap to preview` : `Open today's schedule`">
          {{ timeBlock }}
        </button>
      </div>
      
      <!-- LT Button (Light) -->
      <button @click="setTheme(false)"
        class="text-[9px] tracking-[0.3em] uppercase transition-colors duration-200 ease-out-expo px-2 py-1 rounded font-grotesk justify-self-end"
        :class="!isDark ? 'text-primary-rose font-semibold' : 'text-white/50 hover:text-white/70'">
        LT
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { useTimeBlock } from '../composables/useTimeBlock.js'
import { usePlayerStore } from '../stores/player.js'
import { useSettingsStore } from '../stores/settings.js'
import { useScheduleStore } from '../stores/schedule.js'

const { isDark, setTheme } = useTheme()
const { currentBlock } = useTimeBlock()
const player = usePlayerStore()
const settings = useSettingsStore()
const schedule = useScheduleStore()

const now = ref(new Date())
let timeInterval = null

const currentTime = computed(() => {
  const h = now.value.getHours().toString().padStart(2, '0')
  const m = now.value.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
})

const timeParts = computed(() => {
  const h = now.value.getHours().toString().padStart(2, '0')
  const m = now.value.getMinutes().toString().padStart(2, '0')
  return { h, m }
})

const currentDate = computed(() => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const d = now.value
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`
})

// Time-of-day block — sourced from useTimeBlock so the badge label always
// matches the schedule panel and server-side curate context.
const timeBlock = computed(() => currentBlock.value?.label?.toLowerCase() || '')

// Soft transition cue: when the wall-clock block changes (e.g. afternoon →
// wind down at 17:00), pulse the badge for ~3s so the user notices without
// being interrupted. First load is skipped — only real transitions cue.
const blockJustChanged = ref(false)
let firstBlockSeen = false
let blockShiftTimer = null
watch(() => currentBlock.value?.id, () => {
  if (!firstBlockSeen) { firstBlockSeen = true; return }
  blockJustChanged.value = true
  if (blockShiftTimer) clearTimeout(blockShiftTimer)
  blockShiftTimer = setTimeout(() => { blockJustChanged.value = false }, 3000)
})

const currentTrack = computed(() => player.currentTrack)

// ── Real-time rhythm waveform ──
const WAVE_BAR_COUNT = 16
const baseHeights = [35, 55, 25, 70, 45, 85, 30, 60, 40, 75, 20, 65, 50, 80, 35, 55]
const waveHeights = ref([...baseHeights])
let rafId = null
let startTime = 0

const updateWaves = (timestamp) => {
  if (!startTime) startTime = timestamp
  const elapsed = (timestamp - startTime) / 1000

  for (let i = 0; i < WAVE_BAR_COUNT; i++) {
    if (player.isPlaying) {
      const base = baseHeights[i]
      // 多層正弦波疊加模擬節奏感
      const beat = Math.sin(elapsed * 6.5 + i * 0.4) * 0.25 + 1
      const ripple = Math.sin(elapsed * 10 + i * 0.7) * 0.12
      const slow = Math.sin(elapsed * 2.5 + i * 0.25) * 0.18
      const micro = Math.sin(elapsed * 16 + i * 1.1) * 0.08
      const h = base * (beat + ripple + slow + micro)
      waveHeights.value[i] = Math.max(8, Math.min(100, h))
    } else {
      // 暫停時緩慢回到基礎高度
      const target = baseHeights[i]
      waveHeights.value[i] += (target - waveHeights.value[i]) * 0.06
    }
  }
  rafId = requestAnimationFrame(updateWaves)
}

const getWaveBarStyle = (i) => {
  const h = waveHeights.value[i - 1]
  const opacity = 0.4 + (h / 100) * 0.6
  return {
    height: `${h}%`,
    opacity: opacity.toFixed(2),
  }
}

onMounted(() => {
  timeInterval = setInterval(() => {
    now.value = new Date()
  }, 1000)
  rafId = requestAnimationFrame(updateWaves)
})

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval)
  if (rafId) cancelAnimationFrame(rafId)
})

// Reset wave phase on track change
watch(() => player.currentIndex, () => {
  startTime = performance.now()
})
</script>

<style scoped>
.cover-swap-enter-active,
.cover-swap-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.cover-swap-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.cover-swap-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

@keyframes colon-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.15; }
}
.colon-breathe {
  animation: colon-breathe 1s ease-in-out infinite;
}

/* Block-shift cue — three-phase glow when the wall-clock crosses into a new
   time block. Soft enough not to interrupt, firm enough to register. */
@keyframes block-shift {
  0%   { box-shadow: 0 0 0 0   rgba(176, 102, 109, 0.55); transform: scale(1); }
  35%  { box-shadow: 0 0 0 10px rgba(176, 102, 109, 0);   transform: scale(1.08); }
  60%  { box-shadow: 0 0 0 0   rgba(176, 102, 109, 0.35); transform: scale(1); }
  100% { box-shadow: 0 0 0 0   rgba(176, 102, 109, 0);    transform: scale(1); }
}
.animate-block-shift {
  animation: block-shift 1.6s cubic-bezier(0.33, 1, 0.68, 1) 1.6s 1;
}
</style>
