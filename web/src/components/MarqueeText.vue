<template>
  <div ref="wrapRef" class="marquee-wrap overflow-hidden relative">
    <div
      v-if="overflowing"
      ref="trackRef"
      class="marquee-track"
      :style="{ animationDuration: duration + 's' }"
    >
      <span class="marquee-item">{{ text }}</span>
      <span class="marquee-item" aria-hidden="true">{{ text }}</span>
    </div>
    <div v-else ref="staticRef" class="truncate">{{ text }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
  // px per second — lower = slower scroll
  speed: { type: Number, default: 40 },
  // minimum seconds per loop (prevents insane fast for short overflows)
  minDuration: { type: Number, default: 6 }
})

const wrapRef = ref(null)
const staticRef = ref(null)
const trackRef = ref(null)
const overflowing = ref(false)
const duration = ref(10)

let ro = null

async function measure() {
  await nextTick()
  const wrap = wrapRef.value
  if (!wrap) return
  // Create an invisible probe to measure intrinsic text width
  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;white-space:nowrap;visibility:hidden;'
  // Copy computed font so measurement matches
  const cs = window.getComputedStyle(wrap.firstElementChild || wrap)
  probe.style.font = cs.font
  probe.style.letterSpacing = cs.letterSpacing
  probe.textContent = props.text
  document.body.appendChild(probe)
  const textW = probe.offsetWidth
  document.body.removeChild(probe)

  const wrapW = wrap.clientWidth
  const shouldScroll = textW > wrapW + 2
  overflowing.value = shouldScroll
  if (shouldScroll) {
    // Duration based on total distance (text width + gap)
    const distance = textW + 48 // matches padding-right on .marquee-item
    duration.value = Math.max(props.minDuration, distance / props.speed)
  }
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && wrapRef.value) {
    ro = new ResizeObserver(() => measure())
    ro.observe(wrapRef.value)
  }
})

onBeforeUnmount(() => {
  if (ro) ro.disconnect()
})

watch(() => props.text, () => measure())
</script>

<style scoped>
.marquee-wrap {
  width: 100%;
  min-width: 0;
}
.marquee-track {
  display: inline-flex;
  white-space: nowrap;
  animation-name: marquee-scroll;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform;
}
.marquee-item {
  display: inline-block;
  padding-right: 48px;
}
@keyframes marquee-scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@media (prefers-reduced-motion: reduce) {
  .marquee-track {
    animation: none;
  }
}
</style>
