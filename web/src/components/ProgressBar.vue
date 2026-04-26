<template>
  <div class="px-5 py-2.5 transition-theme"
    :class="isDark ? 'bg-primary-dark/50' : 'bg-white'">
    
    <div class="flex items-center gap-3">
      <!-- Current Time -->
      <span class="text-[9px] font-mono tabular-nums w-8 text-right transition-theme tracking-wider"
        :class="isDark ? 'text-primary-cream/70' : 'text-primary-dark/70'">
        {{ player.formattedCurrentTime }}
      </span>

      <!-- Progress Track. Pointer events drive both click-to-seek AND
           drag-to-scrub. Hit area widened with vertical padding so the
           target isn't a 3px hairline. -->
      <div ref="trackRef"
        class="flex-1 h-[14px] flex items-center cursor-pointer group select-none"
        @pointerdown="onPointerDown">
        <div class="w-full h-[3px] rounded-full relative"
          :class="isDark ? 'bg-white/10' : 'bg-primary-dark/10'">
          <!-- Filled. transition disabled while scrubbing so the bar tracks
               the pointer 1:1 instead of easing behind it. -->
          <div class="h-full rounded-full bg-gradient-to-r from-primary-rose to-primary-pink relative"
            :class="isDragging ? '' : 'transition-[width] duration-150 ease-out-expo'"
            :style="{ width: `${displayPercent}%` }">
            <div class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white glow-dot transition-transform duration-200 ease-spring group-hover:scale-150"
              :class="isDragging ? 'scale-150' : ''"></div>
          </div>
        </div>
      </div>

      <!-- Duration -->
      <span class="text-[9px] font-mono tabular-nums w-8 transition-theme tracking-wider"
        :class="isDark ? 'text-primary-cream/70' : 'text-primary-dark/70'">
        {{ player.formattedDuration }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { usePlayerStore } from '../stores/player.js'

const { isDark } = useTheme()
const player = usePlayerStore()

const trackRef = ref(null)
const isDragging = ref(false)
const dragPercent = ref(0)

// While dragging, render the bar at the pointer's position even before
// the audio element has actually seeked — feels instant. Otherwise mirror
// the player's own progress.
const displayPercent = computed(() =>
  isDragging.value ? dragPercent.value * 100 : player.progressPercent
)

function percentFromEvent(e) {
  const rect = trackRef.value?.getBoundingClientRect()
  if (!rect) return 0
  const x = e.clientX - rect.left
  return Math.max(0, Math.min(1, x / rect.width))
}

function commitSeek(percent) {
  // duration comes from audio.loadedmetadata. If 0 (track not loaded),
  // skip — setProgress would be a no-op anyway.
  const d = player.duration
  if (!d || d <= 0) return
  player.setProgress(percent * d)
}

function onPointerDown(e) {
  if (e.button !== 0) return
  isDragging.value = true
  const p = percentFromEvent(e)
  dragPercent.value = p
  trackRef.value?.setPointerCapture?.(e.pointerId)
  // Don't commit on down — single-click case is handled on pointerup
  // when isDragging is still true and movement was zero.
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp, { once: true })
}

function onPointerMove(e) {
  if (!isDragging.value) return
  // Visual only — DON'T touch audio.currentTime on every frame. Live
  // scrubbing on a streaming source (yt-dlp CDN URL) makes the browser
  // fire a range request per seek, which buffers/stalls for hundreds
  // of ms each. Net effect: dragging feels frozen. Just update the
  // displayed bar position; the actual seek fires once on pointerup.
  dragPercent.value = percentFromEvent(e)
}

function onPointerUp(e) {
  if (!isDragging.value) return
  const p = percentFromEvent(e)
  commitSeek(p)
  isDragging.value = false
  window.removeEventListener('pointermove', onPointerMove)
}
</script>
