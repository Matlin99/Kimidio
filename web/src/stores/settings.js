import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { apiBase, ready as apiReady } from '../composables/useApiBase.js'

const TASTE_KEY = 'kimi-taste-v1'
const DEFAULT_TASTE = { genres: [], vibes: [], artists: '', onboarded: false }
const PREFS_KEY = 'kimi-prefs-v1'
const PROVIDER_KEY = 'kimi-provider-v1'
const DEFAULT_PREFS = {
  weatherCity: 'Tokyo',
  ncmApiUrl: 'http://localhost:3000',
  autoPlay: true,
  ttsEnabled: true,
  // Public iCal subscription URLs. Pre-seeded with the user's Apple
  // Calendar feed so the schedule panel + LLM curate context have data
  // out of the box. Edit/clear via SettingsOverlay.
  calendarUrls: [
    'webcal://p169-caldav.icloud.com/published/2/MTIxNTQ2NTczNzQxMjE1NB1PNLubmyCncghYmA2ksqqOwXDpjTNGZOxN-dYfh_yW'
  ]
}

function loadTaste() {
  try {
    const raw = localStorage.getItem(TASTE_KEY)
    if (!raw) return { ...DEFAULT_TASTE }
    return { ...DEFAULT_TASTE, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_TASTE }
  }
}
function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}
function loadProvider() {
  try {
    return localStorage.getItem(PROVIDER_KEY) || 'minimax'
  } catch { return 'minimax' }
}

export const useSettingsStore = defineStore('settings', () => {
  const isSettingsOpen = ref(false)
  const isProfileOpen = ref(false)

  // LLM provider choice — persists across sessions (defaults to minimax for
  // reasoning-heavy chat; fetchProviders() auto-switches if unavailable).
  const llmProvider = ref(loadProvider())
  watch(llmProvider, (v) => {
    try { localStorage.setItem(PROVIDER_KEY, v) } catch {}
  })
  const availableProviders = ref([])

  const preferences = ref(loadPrefs())
  watch(preferences, (v) => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(v)) } catch {}
  }, { deep: true })

  // User taste profile — gathered via WelcomeOverlay on first visit,
  // persisted to localStorage, and sent to /api/playlist/curate so the
  // AI DJ can personalize picks.
  const taste = ref(loadTaste())
  watch(taste, (v) => {
    try { localStorage.setItem(TASTE_KEY, JSON.stringify(v)) } catch {}
  }, { deep: true })

  const setTaste = (patch) => {
    taste.value = { ...taste.value, ...patch, onboarded: true }
  }
  const resetOnboarding = () => {
    taste.value = { ...DEFAULT_TASTE }
  }

  const toggleSettings = () => { isSettingsOpen.value = !isSettingsOpen.value }
  const toggleProfile = () => { isProfileOpen.value = !isProfileOpen.value }

  const fetchProviders = async () => {
    try {
      await apiReady
      const res = await fetch(`${apiBase.value}/api/providers`)
      const data = await res.json()
      availableProviders.value = data.providers || []
      // Auto-select first real available provider, or fallback to mock
      const configured = availableProviders.value.filter(p => p.configured && !p.isMock)
      if (configured.length > 0 && !configured.find(p => p.name === llmProvider.value)) {
        llmProvider.value = configured[0].name
      }
    } catch (e) {
      console.error('Failed to fetch providers:', e)
    }
  }

  return {
    isSettingsOpen, isProfileOpen,
    llmProvider, availableProviders,
    preferences,
    taste, setTaste, resetOnboarding,
    toggleSettings, toggleProfile,
    fetchProviders
  }
})
