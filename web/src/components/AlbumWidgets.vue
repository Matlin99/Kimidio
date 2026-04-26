<template>
  <div 
    ref="carouselRef"
    class="relative w-[180px] select-none overflow-hidden"
    style="height: 420px;"
    @wheel.prevent="onWheel"
    @mousedown="onDragStart"
    @mousemove="onDragMove"
    @mouseup="onDragEnd"
    @mouseleave="onDragEnd"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onDragEnd"
  >
    <!-- Track covers -->
    <div 
      v-for="(track, i) in player.queue" 
      :key="track.id"
      class="absolute left-1/2 transition-all ease-out-expo"
      :class="[
        i === player.currentIndex ? 'z-20' : 'z-10',
        Math.abs(slotForIndex(i)) > 2 ? 'pointer-events-none' : 'pointer-events-auto',
        isDragging ? 'duration-0' : 'duration-700'
      ]"
      :style="getTrackStyle(i)"
    >
      <div 
        class="w-full h-full rounded-widget overflow-hidden relative shadow-2xl group cursor-grab active:cursor-grabbing"
        :class="i === player.currentIndex ? '' : 'shadow-lg'"
        @mousedown.prevent
        @click="onCoverClick(i)"
      >
        <img 
          :src="track.cover || `https://picsum.photos/seed/${track.id}/${imgSize(i)}/${imgSize(i)}`" 
          :alt="track.title" 
          class="w-full h-full object-cover"
          :class="isDragging ? '' : 'transition-transform duration-500 ease-out-expo group-hover:scale-110'"
          draggable="false"
        />
        <div 
          class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
          :class="isDragging ? '' : 'transition-opacity duration-500'"
          :style="{ opacity: i === player.currentIndex ? 1 : 0.5 }"
        ></div>
        
        <!-- Playing indicator -->
        <div v-if="i === player.currentIndex && player.isPlaying" 
          class="absolute top-3 right-3 flex gap-0.5 items-end h-5">
          <div v-for="bar in 3" :key="bar" 
            class="w-[3px] rounded-full bg-primary-rose"
            :style="{
              height: `${8 + bar * 4}px`,
              animation: 'waveBar 0.8s ease-in-out infinite alternate',
              animationDelay: `${bar * 0.12}s`,
              animationPlayState: 'running'
            }"
          ></div>
        </div>
        
        <!-- Track info -->
        <div class="absolute bottom-3 left-3 right-3">
          <p 
            class="font-medium leading-tight truncate text-white"
            :class="i === player.currentIndex ? 'text-body' : 'text-[11px]'"
          >
            {{ track.title.split('(')[0].trim() }}
          </p>
          <p class="text-caption text-white/70 mt-0.5 truncate">{{ track.artist }}</p>
        </div>
      </div>
    </div>
    
    <!-- Center focus ring -->
    <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
      <div class="w-[168px] h-[168px] rounded-widget border border-primary-rose/5"></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'

const player = usePlayerStore()

// === Layout Config ===
const CENTER_Y = 210
const SLOT_HEIGHT = 180
const CENTER_SIZE = 160
const SIDE_SIZE = 120

const slotForIndex = (trackIndex) => {
  const len = player.queue.length
  let dist = trackIndex - player.currentIndex
  if (dist > len / 2) dist -= len
  if (dist < -len / 2) dist += len
  return dist
}

const imgSize = (trackIndex) => {
  return Math.abs(slotForIndex(trackIndex)) === 0 ? CENTER_SIZE : SIDE_SIZE
}

// === Drag State ===
const isDragging = ref(false)
const dragStartY = ref(0)
const dragOffset = ref(0)
const hasDragged = ref(false)

const getTrackStyle = (trackIndex) => {
  const slot = slotForIndex(trackIndex)
  const size = imgSize(trackIndex)
  
  const baseTop = CENTER_Y + slot * SLOT_HEIGHT - size / 2
  const top = baseTop + dragOffset.value
  
  const distFromCenter = Math.abs(slot + dragOffset.value / SLOT_HEIGHT)
  const scale = distFromCenter < 0.5 ? 1 
    : distFromCenter < 1.5 ? 0.88 
    : distFromCenter < 2.5 ? 0.72 
    : 0.55
  
  const opacity = distFromCenter < 0.5 ? 1 
    : distFromCenter < 1.5 ? 0.55 
    : distFromCenter < 2.5 ? 0.22 
    : 0
  
  return {
    width: `${size}px`,
    height: `${size}px`,
    top: `${top}px`,
    transform: `translateX(-50%) scale(${scale})`,
    opacity,
  }
}

// Click vs drag distinction
const onCoverClick = (index) => {
  if (hasDragged.value) return // ignore click if we just dragged
  player.selectTrack(index)
}

// === Wheel (more sensitive) ===
let wheelTimer = null
const onWheel = (e) => {
  if (isDragging.value) return
  e.preventDefault()
  clearTimeout(wheelTimer)
  wheelTimer = setTimeout(() => {
    if (e.deltaY > 0) player.nextTrack()
    else if (e.deltaY < 0) player.prevTrack()
  }, 30)
}

// === Drag ===
const onDragStart = (e) => {
  isDragging.value = true
  hasDragged.value = false
  dragStartY.value = e.clientY
  dragOffset.value = 0
}

const onTouchStart = (e) => {
  isDragging.value = true
  hasDragged.value = false
  dragStartY.value = e.touches[0].clientY
  dragOffset.value = 0
}

const onDragMove = (e) => {
  if (!isDragging.value) return
  const newOffset = e.clientY - dragStartY.value
  if (Math.abs(newOffset) > 5) hasDragged.value = true
  dragOffset.value = newOffset
}

const onTouchMove = (e) => {
  if (!isDragging.value) return
  const newOffset = e.touches[0].clientY - dragStartY.value
  if (Math.abs(newOffset) > 5) hasDragged.value = true
  dragOffset.value = newOffset
}

const onDragEnd = () => {
  if (!isDragging.value) return
  isDragging.value = false
  
  const slotsDragged = Math.round(-dragOffset.value / SLOT_HEIGHT)
  
  if (Math.abs(slotsDragged) > 0) {
    const len = player.queue.length
    let newIndex = player.currentIndex + slotsDragged
    newIndex = ((newIndex % len) + len) % len
    player.selectTrack(newIndex)
  }
  
  dragOffset.value = 0
  
  // Reset hasDragged after click window passes
  setTimeout(() => { hasDragged.value = false }, 100)
}
</script>
