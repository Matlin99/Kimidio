import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useTimeBlock } from '../composables/useTimeBlock.js'
import { useSettingsStore } from './settings.js'
import { usePlayerStore } from './player.js'

import { apiBase, ready as apiReady } from '../composables/useApiBase.js'
const STORAGE_KEY = 'kimi-schedule-v1'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const useScheduleStore = defineStore('schedule', () => {
  const { blocks, currentBlockId } = useTimeBlock()

  const isOpen = ref(false)
  const tracksByBlock = ref({})        // { blockId: tracks[] }
  const introsByBlock = ref({})        // { blockId: 'short DJ intro' } — populated by full-day batch
  const curatingBlock = ref(null)      // id of the block being curated right now
  const expandedBlock = ref(null)      // id of the card the user has opened in the panel
  const errorByBlock  = ref({})        // { blockId: errMsg }  for retry UX
  const eventsByBlock = ref({})        // { blockId: [{...}] }
  const activeBlockId = ref(null)      // which block's set is currently loaded into the player
  const dayNarrative  = ref('')        // 2-sentence arc summary from the full-day batch
  const isCuratingDay = ref(false)

  // Hydrate from sessionStorage. Cache is keyed by date — reload after
  // midnight wipes everything so the morning user gets fresh picks.
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.date === todayKey() && parsed.blocks) {
        tracksByBlock.value = parsed.blocks
        if (parsed.activeBlockId) activeBlockId.value = parsed.activeBlockId
      } else {
        sessionStorage.removeItem(STORAGE_KEY)
      }
    }
  } catch { /* sessionStorage may be unavailable in private mode */ }

  function persist() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        date: todayKey(),
        blocks: tracksByBlock.value,
        activeBlockId: activeBlockId.value
      }))
    } catch { /* swallow */ }
  }

  async function curateBlock(blockId) {
    if (curatingBlock.value === blockId) return
    if (tracksByBlock.value[blockId]?.length) return    // already cached today
    const block = blocks.find(b => b.id === blockId)
    if (!block) return
    curatingBlock.value = blockId
    // Clear any previous error so the retry path doesn't show stale message
    if (errorByBlock.value[blockId]) {
      const next = { ...errorByBlock.value }
      delete next[blockId]
      errorByBlock.value = next
    }
    try {
      const settings = useSettingsStore()
      await apiReady
      const res = await fetch(`${apiBase.value}/api/playlist/curate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: 6,
          provider: settings.llmProvider,
          taste: settings.taste,
          // Override the server-side time-of-day so the LLM picks for the
          // requested block, not whatever the wall clock currently is.
          blockHint: { hour: block.startHour, timeOfDay: block.id, label: block.label, mood: block.mood }
        })
      })
      if (!res.ok) {
        errorByBlock.value = { ...errorByBlock.value, [blockId]: `HTTP ${res.status}` }
        return
      }
      const data = await res.json()
      if (data.queue?.length) {
        tracksByBlock.value = { ...tracksByBlock.value, [blockId]: data.queue }
        persist()
      } else {
        errorByBlock.value = { ...errorByBlock.value, [blockId]: 'no tracks returned' }
      }
    } catch (e) {
      console.warn('[schedule] curate failed:', e.message)
      errorByBlock.value = { ...errorByBlock.value, [blockId]: e.message || 'fetch failed' }
    } finally {
      curatingBlock.value = null
    }
  }

  // Mirror an externally-curated set into the schedule cache (e.g. the
  // initial /api/playlist/curate result on app entry — it's already a
  // current-block curation, no point re-fetching from the panel). Also
  // marks the block as the active one (the queue currently mirrors it).
  function setBlockTracks(blockId, tracks) {
    if (!blockId || !tracks?.length) return
    tracksByBlock.value = { ...tracksByBlock.value, [blockId]: tracks }
    activeBlockId.value = blockId
    persist()
  }

  // Load this block's curated set into the player and remember it as the
  // active set. Returns true if a switch happened.
  function switchToBlock(blockId) {
    const tracks = tracksByBlock.value[blockId]
    if (!tracks?.length) return false
    const player = usePlayerStore()
    player.replaceQueue(tracks, 0)
    activeBlockId.value = blockId
    persist()
    return true
  }

  function open()   { isOpen.value = true }
  function close()  { isOpen.value = false; expandedBlock.value = null }
  function toggle() { isOpen.value ? close() : open() }

  // Click a card → expand it, lazy-curate if untouched. Re-clicking the
  // already-expanded card collapses it (no re-curate).
  function expand(blockId) {
    if (expandedBlock.value === blockId) {
      expandedBlock.value = null
      return
    }
    expandedBlock.value = blockId
    curateBlock(blockId)
  }

  // Manual retry from the panel after a curate failure. Clears the cached
  // (empty) state so curateBlock proceeds.
  function retryBlock(blockId) {
    const next = { ...errorByBlock.value }
    delete next[blockId]
    errorByBlock.value = next
    // Don't clear tracksByBlock entry if it has tracks; only block-level
    // error retries are for failed curates that left no tracks.
    return curateBlock(blockId)
  }

  // Full-day batch curate. One LLM call returns 7 blocks with an arc. Used
  // by the BootDiagnostic flow so the schedule panel lights up "ready" for
  // every block at once. Silently no-ops on failure (caller falls back to
  // existing lazy-per-block curation).
  async function curateFullDay({ provider, taste, calendarUrls, perBlock = 6 } = {}) {
    if (isCuratingDay.value) return
    // Skip if today's batch already populated most blocks. Threshold = 4 of
    // 7 because partial caches (e.g. user clicked 2-3 blocks lazily before
    // BEGIN) shouldn't lock us out of running a full-day refresh; but if
    // we've got 4+ ready, the batch would just overwrite — wasted tokens.
    const filled = blocks.filter(b => tracksByBlock.value[b.id]?.length).length
    if (filled >= 4) {
      console.log(`[schedule] curate-day skipped — ${filled}/7 blocks already cached today`)
      return
    }
    isCuratingDay.value = true
    try {
      await apiReady
      const res = await fetch(`${apiBase.value}/api/playlist/curate-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, taste, calendarUrls, perBlock })
      })
      if (!res.ok) {
        console.warn('[schedule] curate-day non-OK:', res.status)
        return
      }
      const data = await res.json()
      if (!data?.blocks) return
      const nextTracks = { ...tracksByBlock.value }
      const nextIntros = { ...introsByBlock.value }
      for (const bid of Object.keys(data.blocks)) {
        const b = data.blocks[bid]
        if (b?.queue?.length) nextTracks[bid] = b.queue
        if (b?.say)           nextIntros[bid] = b.say
      }
      tracksByBlock.value = nextTracks
      introsByBlock.value = nextIntros
      if (data.narrative) dayNarrative.value = data.narrative
      persist()
    } catch (e) {
      console.warn('[schedule] curate-day failed:', e.message)
    } finally {
      isCuratingDay.value = false
    }
  }

  return {
    isOpen, tracksByBlock, introsByBlock, curatingBlock, expandedBlock,
    errorByBlock, eventsByBlock, activeBlockId,
    dayNarrative, isCuratingDay,
    blocks, currentBlockId,
    open, close, toggle, expand,
    curateBlock, setBlockTracks, switchToBlock, retryBlock, curateFullDay
  }
})
