<template>
  <Transition name="fade">
    <div v-if="settings.isSettingsOpen" class="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-400 ease-out-expo" @click="settings.toggleSettings"></div>
      <div class="relative w-[440px] max-h-[500px] rounded-card overflow-hidden flex flex-col shadow-2xl transition-transform duration-400 ease-out-expo"
        :class="isDark ? 'bg-primary-dark border border-white/10' : 'bg-white border border-primary-dark/10'">
        
        <div class="px-5 py-4 border-b flex items-center justify-between"
          :class="isDark ? 'border-white/10' : 'border-primary-dark/10'">
          <p class="text-subtitle font-medium transition-theme" :class="isDark ? 'text-primary-cream' : 'text-primary-dark'">
            Settings
            <span class="ml-2 text-caption font-mono align-middle opacity-50">{{ appVersion }}</span>
          </p>
          <button @click="settings.toggleSettings" class="w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200 ease-out-expo"
            :class="isDark ? 'hover:bg-white/10 text-primary-cream/60' : 'hover:bg-primary-dark/10 text-primary-dark/60'">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 2l10 10M12 2L2 12"/>
            </svg>
          </button>
        </div>
        
        <div class="p-5 space-y-5 overflow-y-auto">
          <!-- LLM Provider Selection -->
          <div>
            <p class="text-label uppercase tracking-wider mb-3 transition-theme" :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">
              AI Brain
            </p>
            <div class="flex gap-2">
              <button v-for="p in settings.availableProviders" :key="p.name"
                @click="settings.llmProvider = p.name"
                class="flex-1 py-2 px-3 rounded-lg text-[11px] font-medium uppercase tracking-wider border transition-all duration-200 ease-out-expo font-grotesk"
                :class="settings.llmProvider === p.name
                  ? (isDark ? 'bg-primary-rose/20 border-primary-rose/40 text-primary-rose' : 'bg-primary-rose/10 border-primary-rose/30 text-primary-rose')
                  : p.configured
                    ? (isDark ? 'bg-white/5 border-white/10 text-primary-cream/60 hover:border-white/20' : 'bg-primary-dark/5 border-primary-dark/10 text-primary-dark/60 hover:border-primary-dark/20')
                    : (isDark ? 'bg-white/5 border-white/5 text-primary-cream/30 cursor-not-allowed' : 'bg-primary-dark/5 border-primary-dark/5 text-primary-dark/30 cursor-not-allowed')"
                :disabled="!p.configured">
                <div class="flex items-center justify-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full" :class="p.configured ? 'bg-green-500' : 'bg-neutral-400'"></span>
                  {{ p.name }}
                </div>
                <div class="text-[9px] mt-0.5 opacity-60 font-normal normal-case">
                  {{ p.configured ? p.defaultModel : 'Not configured' }}
                </div>
              </button>
            </div>
          </div>
          
          <!-- API Keys (BYOK) — only meaningful in Tauri builds. Typing
               into a field auto-saves to disk and respawns the sidecar
               1.5s after the last keystroke (debounced). No "Apply"
               button to forget. Per-row dot reflects live connection. -->
          <div v-if="isTauri">
            <div class="flex items-center justify-between mb-2">
              <p class="text-label uppercase tracking-wider transition-theme" :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">
                API Keys
              </p>
              <span class="text-[10px] uppercase tracking-[0.2em] font-grotesk transition-colors duration-200"
                :class="byokStatusClass">
                {{ byokStatusText }}
              </span>
            </div>
            <!-- Top banner: explains state in plain language -->
            <div v-if="!hasAnyKey"
              class="mb-2 px-3 py-2 rounded-lg text-caption border transition-theme"
              :class="isDark ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300/90' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700'">
              ⚠ No keys yet. AI DJ runs in MOCK mode (canned replies). Paste a key below — server auto-restarts in 1.5s.
            </div>
            <p v-else class="text-caption mb-2 transition-theme" :class="isDark ? 'text-primary-cream/40' : 'text-primary-dark/40'">
              Stored locally only. Auto-saved as you type; sidecar respawns 1.5s after the last keystroke.
            </p>
            <div class="space-y-2.5">
              <div v-for="k in byokKeys" :key="k.id">
                <label class="text-caption mb-1 flex items-center justify-between transition-theme" :class="isDark ? 'text-primary-cream/60' : 'text-primary-dark/60'">
                  <span class="flex items-center gap-1.5">
                    <!-- Connection dot: green = configured + healthy on server,
                         yellow = saved + restarting, gray = empty -->
                    <span class="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                      :class="rowDotClass(k)"></span>
                    {{ k.label }}
                  </span>
                  <span v-if="k.hint" class="text-[9px] opacity-60 normal-case tracking-normal">{{ k.hint }}</span>
                </label>
                <input :value="byokValues[k.id]"
                  @input="updateKey(k.id, $event.target.value)"
                  :type="revealed[k.id] ? 'text' : 'password'"
                  :placeholder="k.placeholder || 'sk-…'"
                  class="w-full px-3 py-2 rounded-lg text-[11px] font-mono outline-none transition-theme"
                  :class="isDark ? 'bg-white/5 text-primary-cream border border-white/10 focus:border-primary-rose/50' : 'bg-primary-dark/5 text-primary-dark border border-primary-dark/10 focus:border-primary-rose/50'" />
                <!-- Optional extras (e.g. MiniMax model + base URL) — render
                     indented + plain text. Auto-save + auto-respawn just
                     like the API key input. -->
                <div v-if="k.extras" class="mt-1.5 pl-3 space-y-1.5 border-l-2"
                  :class="isDark ? 'border-white/5' : 'border-primary-dark/5'">
                  <div v-for="x in k.extras" :key="x.id">
                    <label class="text-[9px] uppercase tracking-wider opacity-60 block mb-0.5"
                      :class="isDark ? 'text-primary-cream' : 'text-primary-dark'">
                      {{ x.label }}
                    </label>
                    <input :value="byokValues[x.id]"
                      @input="updateKey(x.id, $event.target.value)"
                      type="text"
                      :placeholder="x.placeholder"
                      class="w-full px-2.5 py-1.5 rounded text-[10px] font-mono outline-none transition-theme"
                      :class="isDark ? 'bg-white/5 text-primary-cream/80 border border-white/10 focus:border-primary-rose/50' : 'bg-primary-dark/5 text-primary-dark/80 border border-primary-dark/10 focus:border-primary-rose/50'" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Preferences -->
          <div>
            <p class="text-label uppercase tracking-wider mb-3 transition-theme" :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">
              Preferences
            </p>
            <div class="space-y-3">
              <div v-for="pref in prefFields" :key="pref.id">
                <label class="text-caption mb-1 block transition-theme" :class="isDark ? 'text-primary-cream/60' : 'text-primary-dark/60'">
                  {{ pref.label }}
                </label>
                <input v-model="settings.preferences[pref.id]" type="text"
                  class="w-full px-3 py-2 rounded-lg text-body outline-none transition-theme"
                  :class="isDark ? 'bg-white/5 text-primary-cream border border-white/10 focus:border-primary-rose/50' : 'bg-primary-dark/5 text-primary-dark border border-primary-dark/10 focus:border-primary-rose/50'" />
              </div>

              <!-- DJ Voice (TTS) toggle -->
              <label class="flex items-center justify-between gap-3 cursor-pointer select-none pt-1">
                <span class="text-caption transition-theme" :class="isDark ? 'text-primary-cream/60' : 'text-primary-dark/60'">
                  DJ Voice
                </span>
                <button type="button"
                  @click="settings.preferences.ttsEnabled = !settings.preferences.ttsEnabled"
                  class="relative w-10 h-5 rounded-full transition-colors duration-200 ease-out-expo flex-shrink-0"
                  :class="settings.preferences.ttsEnabled
                    ? 'bg-primary-rose'
                    : (isDark ? 'bg-white/10' : 'bg-primary-dark/15')">
                  <span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ease-spring"
                    :style="{ transform: settings.preferences.ttsEnabled ? 'translateX(20px)' : 'translateX(0)' }"></span>
                </button>
              </label>
            </div>
          </div>

          <!-- Calendar URLs -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="text-label uppercase tracking-wider transition-theme" :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">
                Calendar
              </p>
              <button @click="addCalendarUrl"
                class="text-[10px] uppercase tracking-[0.2em] font-grotesk px-2 py-1 rounded-full transition-colors duration-200 ease-out-expo"
                :class="isDark ? 'text-primary-rose/80 hover:bg-primary-rose/10' : 'text-primary-rose hover:bg-primary-rose/10'">
                + Add URL
              </button>
            </div>
            <p class="text-caption mb-2 transition-theme" :class="isDark ? 'text-primary-cream/40' : 'text-primary-dark/40'">
              Public iCal feeds (Apple webcal://, Google secret address). Used to inform DJ picks per time block — only busy/free totals are sent to the LLM, never event titles.
            </p>
            <div class="space-y-2">
              <div v-for="(url, i) in (settings.preferences.calendarUrls || [])" :key="i"
                class="flex items-center gap-2">
                <input :value="url"
                  @input="updateCalendarUrl(i, $event.target.value)"
                  placeholder="webcal://… or https://…"
                  class="flex-1 px-3 py-2 rounded-lg text-body outline-none transition-theme text-[11px] font-mono"
                  :class="isDark ? 'bg-white/5 text-primary-cream border border-white/10 focus:border-primary-rose/50' : 'bg-primary-dark/5 text-primary-dark border border-primary-dark/10 focus:border-primary-rose/50'" />
                <button @click="removeCalendarUrl(i)"
                  title="Remove this calendar"
                  class="w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-200 ease-out-expo flex-shrink-0"
                  :class="isDark ? 'hover:bg-red-500/20 text-primary-cream/60 hover:text-red-300' : 'hover:bg-red-500/10 text-primary-dark/60 hover:text-red-500'">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 2l10 10M12 2L2 12"/></svg>
                </button>
              </div>
              <div v-if="!(settings.preferences.calendarUrls || []).length" class="text-caption italic transition-theme"
                :class="isDark ? 'text-primary-cream/30' : 'text-primary-dark/30'">
                No calendars connected.
              </div>
            </div>
            <button @click="refreshCalendar"
              :disabled="calendar.isFetching"
              class="mt-3 text-[10px] uppercase tracking-[0.2em] font-grotesk px-3 py-1.5 rounded-full transition-colors duration-200 ease-out-expo disabled:opacity-40"
              :class="isDark ? 'text-primary-rose/80 hover:bg-primary-rose/10 border border-primary-rose/30' : 'text-primary-rose hover:bg-primary-rose/10 border border-primary-rose/30'">
              {{ calendar.isFetching ? 'Refreshing…' : `↻ Refresh now (${calendar.events.length} today)` }}
            </button>
          </div>

          <!-- Taste / Onboarding -->
          <div>
            <p class="text-label uppercase tracking-wider mb-3 transition-theme" :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">
              Your Vibe
            </p>
            <div class="text-caption mb-3 transition-theme" :class="isDark ? 'text-primary-cream/60' : 'text-primary-dark/60'">
              <template v-if="hasTaste">
                <div v-if="settings.taste.genres.length" class="mb-1">
                  <span class="opacity-50">Genres: </span>{{ settings.taste.genres.join(', ') }}
                </div>
                <div v-if="settings.taste.vibes.length" class="mb-1">
                  <span class="opacity-50">Vibes: </span>{{ settings.taste.vibes.join(', ') }}
                </div>
                <div v-if="settings.taste.artists" class="mb-1">
                  <span class="opacity-50">Artists: </span>{{ settings.taste.artists }}
                </div>
              </template>
              <span v-else class="opacity-50">No taste set — AI DJ picks freely.</span>
            </div>
            <button @click="redoOnboarding"
              class="w-full py-2 rounded-lg border text-[11px] font-grotesk uppercase tracking-wider transition-all duration-200 ease-out-expo hover:scale-[1.01] active:scale-95"
              :class="isDark ? 'border-white/15 text-primary-cream/70 hover:border-primary-rose/40 hover:text-primary-rose' : 'border-primary-dark/15 text-primary-dark/70 hover:border-primary-rose/40 hover:text-primary-rose'">
              Re-pick Vibe
            </button>
          </div>
        </div>
        
        <div class="p-4 border-t" :class="isDark ? 'border-white/10' : 'border-primary-dark/10'">
          <button @click="saveSettings"
            class="w-full py-2.5 rounded-lg bg-primary-rose text-white text-body font-medium hover:bg-primary-rose/80 transition-all duration-200 ease-out-expo hover:scale-[1.02] active:scale-[0.98]">
            Done
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { onMounted, computed, ref, reactive, watch } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { useSettingsStore } from '../stores/settings.js'
import { useCalendarStore } from '../stores/calendar.js'
import { appVersion } from '../composables/useAppVersion.js'

const { isDark } = useTheme()
const settings = useSettingsStore()
const calendar = useCalendarStore()

// ── BYOK (Bring Your Own Key) ───────────────────────────────────────────
// Only meaningful in Tauri builds; the keys are persisted via
// tauri-plugin-store and forwarded to the sidecar on respawn.
const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
const byokKeys = [
  { id: 'KIMI_API_KEY',     label: 'Kimi (Moonshot)',  hint: 'platform.moonshot.cn' },
  { id: 'OPENAI_API_KEY',   label: 'OpenAI',            hint: 'platform.openai.com' },
  { id: 'CLAUDE_API_KEY',   label: 'Anthropic Claude',  hint: 'console.anthropic.com' },
  // Gemini gets a generous free tier on AI Studio (1500 req/day) and
  // tends to handle music nuance / anachronism better than MiniMax.
  // Default model gemini-2.5-flash; override to -pro / -flash-lite below.
  {
    id: 'GEMINI_API_KEY',   label: 'Google Gemini',     hint: 'aistudio.google.com',
    extras: [
      { id: 'GEMINI_MODEL', label: 'Model (optional)',  placeholder: 'gemini-2.5-flash (default)' }
    ]
  },
  // MiniMax has multiple regional endpoints (api.minimax.chat for China,
  // api.minimax.io / api.minimaxi.com international) and a fast-moving
  // model lineup (M2, M2.7, abab6.5s-chat). Lock-step defaults break
  // when a user's account only has access to one of those — let them
  // override here without rebuilding.
  {
    id: 'MINIMAX_API_KEY',  label: 'MiniMax',           hint: 'minimax.chat',
    extras: [
      { id: 'MINIMAX_MODEL',    label: 'Model (optional)',    placeholder: 'MiniMax-M2 (default)' },
      { id: 'MINIMAX_BASE_URL', label: 'Base URL (optional)', placeholder: 'https://api.minimax.chat/v1 (default)' }
    ]
  },
  { id: 'OPENWEATHER_KEY',  label: 'OpenWeather',       hint: 'openweathermap.org' }
]
// Flat list of all key ids (primary + extras) — used by loadBYOK to
// pre-populate inputs. Prefer this over the nested structure for any
// "load every value" loop.
const allKeyIds = byokKeys.flatMap(k => [k.id, ...(k.extras?.map(x => x.id) || [])])
const byokValues = reactive({})
const revealed = reactive({})  // not exposed in UI yet; future toggle for show/hide
const applying = ref(false)
const lastApplyOk = ref(null)   // null=untouched, true=ok, false=failed
// Debounce timer for save+apply. Single shared timer — typing in any field
// resets it so we don't spam apply for multi-field edits.
let applyTimer = null
const APPLY_DEBOUNCE_MS = 1500

// Map BYOK input id → server-side provider name (for matching against the
// /api/providers status response).
const PROVIDER_FOR_KEY = {
  KIMI_API_KEY: 'kimi',
  OPENAI_API_KEY: 'openai',
  CLAUDE_API_KEY: 'claude',
  MINIMAX_API_KEY: 'minimax',
  GEMINI_API_KEY: 'gemini',
  // OPENWEATHER_KEY isn't an LLM, no provider entry — handled separately.
}

// Only count primary key fields, not extras (a stray MINIMAX_MODEL with
// no API key shouldn't fool the warning banner into hiding itself).
const hasAnyKey = computed(() =>
  byokKeys.some(k => {
    const v = byokValues[k.id]
    return typeof v === 'string' && v.trim().length > 0
  })
)

const liveProvider = computed(() => {
  const p = (settings.availableProviders || []).find(
    p => p.configured && !p.isMock && p.name === settings.llmProvider
  )
  if (p) return p.name
  const any = (settings.availableProviders || []).find(p => p.configured && !p.isMock)
  return any?.name || null
})

const byokStatusText = computed(() => {
  if (applying.value) return 'Restarting…'
  if (lastApplyOk.value === false) return '⚠ Restart failed'
  if (liveProvider.value) return `✓ ${liveProvider.value.toUpperCase()} live`
  if (hasAnyKey.value) return '… Saved, waiting for restart'
  return 'No keys'
})

const byokStatusClass = computed(() => {
  if (applying.value) return isDark.value ? 'text-yellow-300' : 'text-yellow-600'
  if (lastApplyOk.value === false) return 'text-red-400'
  if (liveProvider.value) return 'text-green-400'
  if (hasAnyKey.value) return 'text-yellow-400'
  return isDark.value ? 'text-primary-cream/40' : 'text-primary-dark/40'
})

function rowDotClass(k) {
  const v = byokValues[k.id]
  const filled = typeof v === 'string' && v.trim().length > 0
  if (!filled) return 'bg-neutral-500/40'
  // OpenWeather isn't an LLM — green if filled (no health endpoint).
  if (!PROVIDER_FOR_KEY[k.id]) return 'bg-green-500'
  const provName = PROVIDER_FOR_KEY[k.id]
  const live = (settings.availableProviders || []).find(
    p => p.name === provName && p.configured && !p.isMock
  )
  if (live) return 'bg-green-500'
  if (applying.value) return 'bg-yellow-400 animate-pulse'
  return 'bg-yellow-400'
}

async function loadBYOK() {
  if (!isTauri) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    for (const id of allKeyIds) {
      byokValues[id] = await invoke('get_api_key', { provider: id })
    }
  } catch (e) {
    console.warn('[BYOK] load failed:', e?.message)
  }
}

// Per-keystroke handler: write to disk immediately (cheap), schedule
// debounced sidecar respawn so we don't kill+respawn for every character.
async function updateKey(id, value) {
  byokValues[id] = value
  if (!isTauri) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('save_api_key', { provider: id, value })
  } catch (e) {
    console.warn('[BYOK] save failed:', e?.message)
    return
  }
  if (applyTimer) clearTimeout(applyTimer)
  applyTimer = setTimeout(applyKeys, APPLY_DEBOUNCE_MS)
}

async function applyKeys() {
  if (!isTauri || applying.value) return
  applying.value = true
  lastApplyOk.value = null
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('apply_api_keys')
    // Sidecar takes ~1.5-3s to come back up + emit KIMI_PORT. Poll
    // /api/providers a few times until we see the new key reflected.
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 700))
      try {
        await settings.fetchProviders()
        if (liveProvider.value) {
          lastApplyOk.value = true
          break
        }
      } catch {}
    }
    if (lastApplyOk.value === null) {
      // Got through polling without seeing a live provider — could mean
      // the user typed a bad key. Mark as failed so the badge turns red.
      lastApplyOk.value = false
    }
  } catch (e) {
    console.warn('[BYOK] apply failed:', e?.message)
    lastApplyOk.value = false
  } finally {
    applying.value = false
  }
}

function addCalendarUrl() {
  const list = [...(settings.preferences.calendarUrls || []), '']
  settings.preferences.calendarUrls = list
}
function updateCalendarUrl(i, value) {
  const list = [...(settings.preferences.calendarUrls || [])]
  list[i] = value
  settings.preferences.calendarUrls = list
}
function removeCalendarUrl(i) {
  const list = [...(settings.preferences.calendarUrls || [])]
  list.splice(i, 1)
  settings.preferences.calendarUrls = list
  // Refresh so the schedule panel drops events from the removed feed.
  calendar.refresh({ force: true })
}
function refreshCalendar() {
  calendar.refresh({ force: true })
}

onMounted(() => {
  settings.fetchProviders()
  loadBYOK()
})

// Refresh provider status + key inputs every time the overlay opens so
// the connection dot reflects current sidecar reality, not state from
// app launch.
watch(() => settings.isSettingsOpen, (open) => {
  if (open) {
    settings.fetchProviders()
    loadBYOK()
  }
})

const prefFields = [
  { id: 'weatherCity', label: 'Weather City' },
  { id: 'ncmApiUrl', label: 'Netease API URL' },
]

const hasTaste = computed(() =>
  settings.taste.genres.length > 0 ||
  settings.taste.vibes.length > 0 ||
  !!settings.taste.artists
)

const saveSettings = () => {
  settings.toggleSettings()
}

const redoOnboarding = () => {
  settings.resetOnboarding()
  settings.toggleSettings()
  // Simplest UX: reload so the WelcomeOverlay flow runs fresh
  location.reload()
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
