<template>
  <div>
    <!-- Header with refresh + favorites toggle -->
    <div class="flex items-center justify-between px-5 pt-2 pb-1 transition-theme"
      :class="isDark ? 'bg-primary-dark/30' : 'bg-white'">
      <span class="text-[9px] uppercase tracking-[0.25em] font-grotesk transition-theme"
        :class="isDark ? 'text-primary-cream/40' : 'text-primary-dark/40'">
        {{ viewMode === 'favorites' ? `Favorites (${player.favorites.length})` : 'Playlist' }}
      </span>
      <div class="flex items-center gap-1">
        <!-- Favorites toggle -->
        <button @click.stop="toggleView"
          :title="viewMode === 'favorites' ? 'Show playlist' : 'Show favorites'"
          class="flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] font-grotesk px-2 py-1 rounded-full transition-all duration-200 ease-out-expo hover:scale-105 active:scale-95 cursor-pointer"
          :class="[
            viewMode === 'favorites'
              ? 'text-primary-rose bg-primary-rose/15'
              : (isDark ? 'text-primary-rose/80 hover:bg-primary-rose/10' : 'text-primary-rose hover:bg-primary-rose/10')
          ]">
          <svg v-if="viewMode === 'favorites'" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21s-7.5-4.5-10-9.5C.5 7 3.5 3 7.5 3c2 0 3.5 1 4.5 2.5C13 4 14.5 3 16.5 3 20.5 3 23.5 7 22 11.5 19.5 16.5 12 21 12 21z"/>
          </svg>
          <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 21s-7.5-4.5-10-9.5C.5 7 3.5 3 7.5 3c2 0 3.5 1 4.5 2.5C13 4 14.5 3 16.5 3 20.5 3 23.5 7 22 11.5 19.5 16.5 12 21 12 21z"/>
          </svg>
          {{ viewMode === 'favorites' ? 'Liked' : 'Liked' }}
        </button>
        <!-- Refresh — only meaningful for the curated queue, not favorites -->
        <button v-if="viewMode === 'queue'" @click.stop="onRefresh" :disabled="refreshing"
          :title="refreshing ? 'Refreshing…' : 'Re-curate playlist'"
          class="flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] font-grotesk px-2 py-1 rounded-full transition-all duration-200 ease-out-expo hover:scale-105 active:scale-95"
          :class="[
            refreshing ? 'opacity-50 cursor-wait' : 'cursor-pointer',
            isDark ? 'text-primary-rose/80 hover:bg-primary-rose/10' : 'text-primary-rose hover:bg-primary-rose/10'
          ]">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
            :class="{ 'animate-spin': refreshing }">
            <path d="M14 2v4h-4"/>
            <path d="M2 14v-4h4"/>
            <path d="M13.5 6a6 6 0 0 0-10.5 2m11 0a6 6 0 0 1-10.5 2"/>
          </svg>
          Refresh
        </button>
      </div>
    </div>

    <div ref="listRef" class="transition-theme"
      :class="isDark ? 'bg-primary-dark/30' : 'bg-white'"
      style="max-height: 200px; overflow-y: auto;">

      <!-- Empty favorites hint -->
      <div v-if="viewMode === 'favorites' && player.favorites.length === 0"
        class="px-5 py-6 text-center">
        <p class="text-[11px] italic font-artistic transition-theme"
          :class="isDark ? 'text-primary-cream/40' : 'text-primary-dark/40'">
          No favorites yet. Tap the heart on any track to save it here.
        </p>
      </div>

      <div v-for="(track, index) in displayedTracks" :key="track.id"
        :ref="el => setRowRef(el, index)"
        @click="onRowClick(track, index)"
        class="flex items-center gap-3 px-5 py-2 cursor-pointer transition-[background-color,transform] duration-200 ease-out-expo group relative"
        :class="[
          isCurrent(track, index)
            ? (isDark ? 'bg-primary-rose/10' : 'bg-primary-rose/5')
            : 'hover:bg-[var(--track-hover)] active:scale-[0.99]'
        ]">

        <!-- Active Indicator Bar -->
        <div class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full transition-[opacity,transform] duration-300 ease-out-expo"
          :class="isCurrent(track, index) ? 'bg-primary-rose opacity-100 scale-y-100' : 'bg-primary-rose opacity-0 scale-y-0'"></div>

        <!-- Track Number -->
        <span class="text-[10px] w-4 text-center transition-theme tabular-nums font-grotesk"
          :class="[
            isCurrent(track, index)
              ? 'text-primary-rose font-semibold'
              : (isDark ? 'text-primary-cream/40' : 'text-primary-dark/40')
          ]">
          {{ index + 1 }}
        </span>

        <!-- Track Title -->
        <span class="text-[11px] flex-1 truncate transition-theme font-grotesk"
          :class="[
            isCurrent(track, index)
              ? (isDark ? 'text-primary-cream font-medium' : 'text-primary-dark font-medium')
              : (isDark ? 'text-primary-cream/70' : 'text-primary-dark/70')
          ]">
          {{ track.title }}
        </span>

        <!-- Artist -->
        <span class="text-[9px] uppercase tracking-[0.15em] transition-theme font-grotesk"
          :class="[
            isCurrent(track, index)
              ? 'text-primary-rose'
              : (isDark ? 'text-primary-cream/40' : 'text-primary-dark/40')
          ]">
          {{ track.artist }}
        </span>

        <!-- Favorite heart -->
        <button @click.stop="player.toggleFavorite(track)"
          :title="player.isFavorite(track) ? 'Unfavorite' : 'Favorite'"
          class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-all duration-200 ease-out-expo hover:scale-125 active:scale-95"
          :class="[
            player.isFavorite(track)
              ? 'text-primary-rose'
              : (isDark ? 'text-primary-cream/25 hover:text-primary-rose/70' : 'text-primary-dark/25 hover:text-primary-rose/70')
          ]">
          <svg v-if="player.isFavorite(track)" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21s-7.5-4.5-10-9.5C.5 7 3.5 3 7.5 3c2 0 3.5 1 4.5 2.5C13 4 14.5 3 16.5 3 20.5 3 23.5 7 22 11.5 19.5 16.5 12 21 12 21z"/>
          </svg>
          <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 21s-7.5-4.5-10-9.5C.5 7 3.5 3 7.5 3c2 0 3.5 1 4.5 2.5C13 4 14.5 3 16.5 3 20.5 3 23.5 7 22 11.5 19.5 16.5 12 21 12 21z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { usePlayerStore } from '../stores/player.js'
import { useSettingsStore } from '../stores/settings.js'
import { useScheduleStore } from '../stores/schedule.js'

const { isDark } = useTheme()
const player = usePlayerStore()
const settings = useSettingsStore()
const schedule = useScheduleStore()

// 'queue' = the curated playlist; 'favorites' = saved hearts.
// Switching is purely a view toggle — favorites isn't loaded into the
// player until the user clicks a row (then we splice it into the queue).
const viewMode = ref('queue')
const displayedTracks = computed(() =>
  viewMode.value === 'favorites' ? player.favorites : player.queue
)

function toggleView() {
  viewMode.value = viewMode.value === 'favorites' ? 'queue' : 'favorites'
}

// Highlight current track. In queue view, match by index; in favorites
// view, match by id (the favorited track may or may not be in the queue).
function isCurrent(track, index) {
  if (viewMode.value === 'favorites') {
    return player.currentTrack?.id === track.id
  }
  return index === player.currentIndex
}

function onRowClick(track, index) {
  if (viewMode.value === 'favorites') {
    // If this track is already in the queue, jump to it. Otherwise insert
    // next-up and advance — keeps the curated set intact while letting the
    // user dip into their favorites without rebuilding the queue.
    const existingIdx = player.queue.findIndex(t => t.id === track.id)
    if (existingIdx >= 0) {
      player.selectTrack(existingIdx)
    } else {
      player.insertNext(track)
      player.selectTrack(player.currentIndex + 1)
    }
    return
  }
  player.selectTrack(index)
}

const refreshing = ref(false)
async function onRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    const result = await player.curatePlaylist({
      provider: settings.llmProvider,
      taste: settings.taste
    })
    // After a successful refresh, the new queue is for the *current* time
    // block — update the schedule cache so the panel stays in sync (active
    // dot moves back to the now block, "X ready" count refreshes).
    if (result) {
      schedule.setBlockTracks(schedule.currentBlockId, [...player.queue])
    }
  } finally {
    refreshing.value = false
  }
}

const listRef = ref(null)
const rowRefs = ref([])

const setRowRef = (el, index) => {
  if (el) rowRefs.value[index] = el
}

const scrollCurrentIntoView = (smooth = true) => {
  const row = rowRefs.value[player.currentIndex]
  const container = listRef.value
  if (!row || !container) return

  const rowTop = row.offsetTop
  const rowBottom = rowTop + row.offsetHeight
  const viewTop = container.scrollTop
  const viewBottom = viewTop + container.clientHeight

  if (rowTop < viewTop || rowBottom > viewBottom) {
    const target = rowTop - (container.clientHeight - row.offsetHeight) / 2
    container.scrollTo({
      top: Math.max(0, target),
      behavior: smooth ? 'smooth' : 'auto'
    })
  }
}

watch(() => player.currentIndex, async () => {
  await nextTick()
  scrollCurrentIntoView(true)
})

watch(() => player.queue.length, async () => {
  await nextTick()
  scrollCurrentIntoView(false)
})

onMounted(async () => {
  await nextTick()
  scrollCurrentIntoView(false)
})
</script>
