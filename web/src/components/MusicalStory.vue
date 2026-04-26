<template>
  <div class="px-5 py-3 transition-theme"
    :class="isDark ? 'bg-primary-dark/20 border-t border-white/5' : 'bg-white border-t border-primary-dark/5'">

    <!-- Header -->
    <div class="flex items-center justify-between mb-1.5">
      <div class="flex items-center gap-2">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" class="text-neutral-400">
          <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="text-[9px] uppercase tracking-[0.3em] font-medium transition-theme font-grotesk"
          :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">
          Musical Story
        </span>
      </div>
      <div class="flex items-center gap-3">
        <!-- Ask DJ about this track — opens chat with prefilled question -->
        <button @click="askDJ" v-if="player.currentTrack?.title"
          class="text-[9px] uppercase tracking-[0.2em] transition-colors duration-200 ease-out-expo hover:text-primary-rose font-grotesk flex items-center gap-1"
          :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M2 5v3a2 2 0 0 0 2 2h2l2 2v-2h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/>
          </svg>
          Ask DJ
        </button>
        <button @click="isExpanded = !isExpanded"
          class="text-[9px] uppercase tracking-[0.2em] transition-colors duration-200 ease-out-expo hover:text-primary-rose font-grotesk"
          :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">
          {{ isExpanded ? 'Show Less' : 'Read More' }}
        </button>
      </div>
    </div>

    <!-- Expanded content -->
    <div class="grid transition-[grid-template-rows] duration-500 ease-out-expo"
      :style="{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }">
      <div class="min-h-0 overflow-hidden">
        <p class="text-[11px] italic leading-relaxed transition-theme font-artistic"
          :class="isDark ? 'text-primary-cream/80' : 'text-primary-dark/80'">
          <span class="font-semibold not-italic font-grotesk" :class="isDark ? 'text-primary-cream' : 'text-primary-dark'">
            {{ player.currentTrack?.title || 'Unknown' }}.
          </span>
          {{ loading ? 'Loading liner notes…' : (trackStory || placeholderTrack) }}
        </p>

        <div class="mt-2 pt-2 border-t transition-theme"
          :class="isDark ? 'border-white/5' : 'border-primary-dark/5'">
          <p class="text-[9px] uppercase tracking-[0.25em] mb-1.5 transition-theme font-grotesk"
            :class="isDark ? 'text-primary-cream/40' : 'text-primary-dark/40'">
            About {{ player.currentTrack?.artist || 'Artist' }}
          </p>
          <p class="text-[11px] leading-relaxed transition-theme font-artistic"
            :class="isDark ? 'text-primary-cream/70' : 'text-primary-dark/70'">
            {{ loading ? '…' : (artistBio || placeholderArtist) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Collapsed preview -->
    <p v-if="!isExpanded" class="text-[11px] italic leading-relaxed transition-theme font-artistic mt-1 line-clamp-2"
      :class="isDark ? 'text-primary-cream/80' : 'text-primary-dark/80'">
      <span class="font-semibold not-italic font-grotesk" :class="isDark ? 'text-primary-cream' : 'text-primary-dark'">
        {{ player.currentTrack?.title || 'Unknown' }}.
      </span>
      {{ loading ? 'Loading…' : (trackStory || placeholderTrack) }}
    </p>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { usePlayerStore } from '../stores/player.js'
import { useChatStore } from '../stores/chat.js'

import { apiBase } from '../composables/useApiBase.js'
const { isDark } = useTheme()
const player = usePlayerStore()
const chat = useChatStore()
const isExpanded = ref(false)

// Per-track guard so repeated Ask DJ clicks on the same song don't
// re-send the question. First click sends + opens; subsequent clicks just
// reopen the chat with the existing thread visible.
const askedTracks = new Set()

function askDJ() {
  const t = player.currentTrack
  if (!t?.title) return
  const key = `${t.title}::${t.artist || ''}`.toLowerCase()
  chat.openChat()
  if (askedTracks.has(key)) return
  askedTracks.add(key)
  const artistPart = t.artist ? ` by ${t.artist}` : ''
  chat.sendMessage(`Tell me more about "${t.title}"${artistPart}.`)
}

const trackStory = ref('')
const artistBio = ref('')
const loading = ref(false)

// Placeholder while nothing fetched yet (covers initial state + fetch failure)
const placeholderTrack = computed(() =>
  player.currentTrack?.artist
    ? `A piece from ${player.currentTrack.artist}'s catalog.`
    : 'Liner notes unavailable.')
const placeholderArtist = computed(() =>
  player.currentTrack?.artist
    ? `${player.currentTrack.artist} — details unavailable.`
    : '')

// In-memory session cache so refetching on the same track is instant
const cache = new Map()

async function fetchStory(title, artist) {
  if (!title) {
    trackStory.value = ''
    artistBio.value = ''
    return
  }
  const key = `${title}::${artist || ''}`.toLowerCase()
  if (cache.has(key)) {
    const c = cache.get(key)
    trackStory.value = c.trackStory
    artistBio.value = c.artistBio
    return
  }
  loading.value = true
  trackStory.value = ''
  artistBio.value = ''
  try {
    const res = await fetch(`${apiBase.value}/api/track-story`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, artist })
    })
    if (!res.ok) return
    const data = await res.json()
    // Stale-response guard: if user switched tracks during the LLM round
    // trip, the now-current track has a different key. Don't paint the
    // previous track's story over it.
    const currentKey = `${player.currentTrack?.title || ''}::${player.currentTrack?.artist || ''}`.toLowerCase()
    if (currentKey !== key) {
      cache.set(key, data)  // still cache for later
      return
    }
    trackStory.value = data.trackStory || ''
    artistBio.value = data.artistBio || ''
    cache.set(key, data)
  } catch (e) {
    console.warn('[story] fetch failed:', e.message)
  } finally {
    loading.value = false
  }
}

watch(
  () => [player.currentTrack?.title, player.currentTrack?.artist],
  ([title, artist]) => fetchStory(title, artist),
  { immediate: true }
)
</script>
