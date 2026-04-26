<template>
  <div class="px-5 py-3.5 grid grid-cols-[1fr_auto_1fr] items-center transition-theme"
    :class="isDark ? 'bg-primary-dark/50' : 'bg-white'">
    
    <!-- Left: Track Info -->
    <div class="min-w-0 justify-self-start w-full pr-2">
      <div class="text-[14px] font-medium leading-tight transition-theme font-grotesk"
        :class="isDark ? 'text-white' : 'text-primary-dark'">
        <MarqueeText :text="currentTrack?.title?.split('(')[0].trim() || 'No Track'" />
      </div>
      <div class="text-[9px] uppercase tracking-[0.3em] mt-0.5 font-grotesk font-medium transition-theme"
        :class="isDark ? 'text-white/50' : 'text-primary-dark/50'">
        <MarqueeText :text="currentTrack?.artist || 'Unknown'" />
      </div>
    </div>
    
    <!-- Center: Controls -->
    <div class="flex items-center gap-2.5 justify-self-center">
      
      <!-- Transport Pill -->
      <div class="flex items-center gap-1 rounded-full border px-1.5 py-1"
        :class="isDark ? 'border-white/15' : 'border-primary-dark/15'">
        <button @click="player.prevTrack" 
          class="w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-200 ease-out-expo"
          :class="isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-primary-dark/5 text-primary-dark'">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13 2L5 8l8 6V2zM3 2h2v12H3V2z"/>
          </svg>
        </button>
        
        <button @click="player.nextTrack"
          class="w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-200 ease-out-expo"
          :class="isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-primary-dark/5 text-primary-dark'">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 2l8 6-8 6V2zM13 2h-2v12h2V2z"/>
          </svg>
        </button>
      </div>
      
      <!-- Main Play Button (colored circle) -->
      <button @click="togglePlay"
        class="w-[38px] h-[38px] rounded-full flex items-center justify-center transition-all duration-200 ease-spring hover:scale-110 active:scale-95"
        :class="player.isPlaying 
          ? 'bg-primary-rose text-white shadow-lg shadow-primary-rose/25' 
          : (isDark ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' : 'bg-primary-dark/8 text-primary-dark border border-primary-dark/15 hover:bg-primary-dark/12')">
        <Transition name="icon-flip" mode="out-in">
          <svg v-if="!player.isPlaying" key="play" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="ml-0.5">
            <path d="M5 3l9 5-9 5V3z"/>
          </svg>
          <svg v-else key="pause" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="4" y="2" width="2.5" height="10" rx="1"/>
            <rect x="7.5" y="2" width="2.5" height="10" rx="1"/>
          </svg>
        </Transition>
      </button>
      
      <!-- Shuffle + Repeat -->
      <div class="flex items-center gap-1 rounded-full border px-1.5 py-1"
        :class="isDark ? 'border-white/15' : 'border-primary-dark/15'">
        <button @click="player.toggleShuffle" title="Shuffle"
          class="w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-200 ease-out-expo"
          :class="player.isShuffle
            ? 'text-primary-rose bg-primary-rose/15'
            : (isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-primary-dark/5 text-primary-dark/60')">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="13,2 15,2 15,4"/>
            <path d="M1 12c3 0 5-7 8-7h6"/>
            <polyline points="13,14 15,14 15,12"/>
            <path d="M1 4c1.5 0 3 1.5 4 3m4 5c1 1.5 2.5 3 4 3"/>
          </svg>
        </button>
        <button @click="player.cycleRepeat"
          :title="player.repeatMode === 'one' ? 'Repeat one' : player.repeatMode === 'all' ? 'Repeat all' : 'Repeat off'"
          class="w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-200 ease-out-expo relative"
          :class="player.repeatMode !== 'off'
            ? 'text-primary-rose bg-primary-rose/15'
            : (isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-primary-dark/5 text-primary-dark/60')">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="13,1 15,3 13,5"/>
            <path d="M2 8V7a2 2 0 0 1 2-2h11"/>
            <polyline points="3,15 1,13 3,11"/>
            <path d="M14 8v1a2 2 0 0 1-2 2H1"/>
          </svg>
          <span v-if="player.repeatMode === 'one'" class="absolute text-[7px] font-bold leading-none top-[7px] right-[6px]">1</span>
        </button>
      </div>

      <!-- Hide Button -->
      <button @click="player.toggleHide"
        class="px-2 py-1.5 rounded-full border text-[9px] font-semibold uppercase tracking-[0.2em] transition-all duration-200 ease-out-expo font-grotesk hover:scale-105 active:scale-95"
        :class="isDark ? 'border-white/15 text-white/60 hover:border-white/30 hover:text-white/80' : 'border-primary-dark/15 text-primary-dark/50 hover:border-primary-dark/30 hover:text-primary-dark/70'">
        {{ player.isHidden ? 'SHOW' : 'HIDE' }}
      </button>
    </div>
    
    <!-- Volume (1-100, draggable) -->
    <div class="flex items-center gap-1.5 justify-self-end">
      <span class="text-[10px] font-medium tabular-nums font-grotesk transition-theme w-10 text-right"
        :class="isDark ? 'text-white/70' : 'text-primary-dark/70'">
        VL{{ Math.round(player.volume * 100) }}
      </span>
      <div 
        ref="volRef"
        class="w-[72px] h-[3px] rounded-full relative cursor-pointer group"
        :class="isDark ? 'bg-white/10' : 'bg-primary-dark/10'"
        @mousedown="startVolDrag"
        @mousemove="onVolDrag"
        @mouseup="endVolDrag"
        @mouseleave="endVolDrag"
      >
        <div class="h-full rounded-full bg-gradient-to-r from-primary-rose to-primary-pink"
          :style="{ width: `${player.volume * 100}%` }"></div>
        <div 
          class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md transition-transform duration-150 ease-out-expo group-hover:scale-125"
          :style="{ left: `calc(${player.volume * 100}% - 6px)` }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { watch, ref, computed } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { usePlayerStore } from '../stores/player.js'
import MarqueeText from './MarqueeText.vue'

const { isDark } = useTheme()
const player = usePlayerStore()

const currentTrack = computed(() => player.currentTrack)
const volRef = ref(null)
const isVolDragging = ref(false)

const togglePlay = () => {
  player.togglePlay()
}

// Volume drag
const updateVolumeFromX = (clientX) => {
  if (!volRef.value) return
  const rect = volRef.value.getBoundingClientRect()
  const x = clientX - rect.left
  const percent = Math.max(0, Math.min(1, x / rect.width))
  player.setVolume(percent)
}

const startVolDrag = (e) => {
  isVolDragging.value = true
  updateVolumeFromX(e.clientX)
}

const onVolDrag = (e) => {
  if (!isVolDragging.value) return
  updateVolumeFromX(e.clientX)
}

const endVolDrag = () => {
  isVolDragging.value = false
}


</script>

<style scoped>
.icon-flip-enter-active,
.icon-flip-leave-active {
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.icon-flip-enter-from {
  opacity: 0;
  transform: scale(0.5) rotate(-30deg);
}
.icon-flip-leave-to {
  opacity: 0;
  transform: scale(0.5) rotate(30deg);
}
</style>
