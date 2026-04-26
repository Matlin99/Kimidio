import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSettingsStore } from './settings.js'
import { useScheduleStore } from './schedule.js'

import { apiBase, ready as apiReady } from '../composables/useApiBase.js'
const STORAGE_KEY = 'kimi-calendar-v1'
const REFRESH_MS = 30 * 60 * 1000   // 30 min — feeds usually update slower than that

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const useCalendarStore = defineStore('calendar', () => {
  const events = ref([])              // today's events, full detail
  const isFetching = ref(false)
  const lastFetchedAt = ref(0)
  const lastError = ref(null)

  // Hydrate from sessionStorage so a tab refresh doesn't re-hit Apple's
  // feed immediately. Same-day cache only.
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.date === todayKey()) {
        events.value = parsed.events || []
        lastFetchedAt.value = parsed.fetchedAt || 0
      } else {
        sessionStorage.removeItem(STORAGE_KEY)
      }
    }
  } catch { /* private mode */ }

  const hasEventsToday = computed(() => events.value.length > 0)

  // Convenience: events grouped by schedule block id, mirroring the same
  // shape the schedule store already uses for tracksByBlock. Lets the
  // panel iterate `schedule.eventsByBlock[block.id]` uniformly.
  const eventsByBlock = computed(() => {
    const out = {}
    for (const ev of events.value) {
      for (const bid of ev.blocks || []) {
        if (!out[bid]) out[bid] = []
        out[bid].push(ev)
      }
    }
    return out
  })

  function persist() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        date: todayKey(),
        events: events.value,
        fetchedAt: lastFetchedAt.value
      }))
    } catch { /* swallow */ }
  }

  async function refresh({ force = false } = {}) {
    const settings = useSettingsStore()
    const urls = (settings.preferences.calendarUrls || []).filter(Boolean)
    if (!urls.length) {
      events.value = []
      return
    }
    const now = Date.now()
    if (!force && now - lastFetchedAt.value < REFRESH_MS) return
    if (isFetching.value) return
    isFetching.value = true
    lastError.value = null
    try {
      await apiReady
      const res = await fetch(`${apiBase.value}/api/calendar/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      events.value = data.events || []
      lastFetchedAt.value = now
      persist()

      // Push the per-block grouping into the schedule store so the
      // SchedulePanel cards show event chips immediately. Pinia store
      // stays the source of truth for "what to render"; calendar store
      // owns the network/cache concerns.
      const schedule = useScheduleStore()
      schedule.eventsByBlock = eventsByBlockFor(events.value)
    } catch (e) {
      console.warn('[calendar] refresh failed:', e.message)
      lastError.value = e.message
    } finally {
      isFetching.value = false
    }
  }

  // Pure helper: same logic as the eventsByBlock computed but callable
  // for one-shot writes into the schedule store.
  function eventsByBlockFor(list) {
    const out = {}
    for (const ev of list) {
      for (const bid of ev.blocks || []) {
        if (!out[bid]) out[bid] = []
        out[bid].push({ id: ev.id, label: ev.summary, start: ev.start, end: ev.end })
      }
    }
    return out
  }

  // Auto-refresh on a long interval. Tab-level setInterval is fine for
  // 30-min cadence — no precision needed.
  let timer = null
  function startAutoRefresh() {
    if (timer) return
    timer = setInterval(() => refresh(), REFRESH_MS)
  }
  function stopAutoRefresh() {
    if (timer) { clearInterval(timer); timer = null }
  }

  return {
    events, isFetching, lastFetchedAt, lastError,
    hasEventsToday, eventsByBlock,
    refresh, startAutoRefresh, stopAutoRefresh
  }
})
