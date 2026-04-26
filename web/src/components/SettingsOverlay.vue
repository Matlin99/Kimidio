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
          
          <!-- API Keys (BYOK) — only meaningful in Tauri builds. The
               keys are stored encrypted on disk via tauri-plugin-store
               and injected into the sidecar's env on next (re)spawn. -->
          <div v-if="isTauri">
            <div class="flex items-center justify-between mb-2">
              <p class="text-label uppercase tracking-wider transition-theme" :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">
                API Keys
              </p>
              <button @click="applyKeys" :disabled="applying"
                class="text-[10px] uppercase tracking-[0.2em] font-grotesk px-2 py-1 rounded-full transition-colors duration-200 ease-out-expo disabled:opacity-40"
                :class="isDark ? 'text-primary-rose/80 hover:bg-primary-rose/10' : 'text-primary-rose hover:bg-primary-rose/10'">
                {{ applying ? 'Restarting…' : '↻ Apply' }}
              </button>
            </div>
            <p class="text-caption mb-2 transition-theme" :class="isDark ? 'text-primary-cream/40' : 'text-primary-dark/40'">
              Bring your own keys. Stored locally and only sent to the provider you pick. After editing, click Apply to restart the AI sidecar.
            </p>
            <div class="space-y-2.5">
              <div v-for="k in byokKeys" :key="k.id">
                <label class="text-caption mb-1 flex items-center justify-between transition-theme" :class="isDark ? 'text-primary-cream/60' : 'text-primary-dark/60'">
                  <span>{{ k.label }}</span>
                  <span v-if="k.hint" class="text-[9px] opacity-60 normal-case tracking-normal">{{ k.hint }}</span>
                </label>
                <input :value="byokValues[k.id]"
                  @input="updateKey(k.id, $event.target.value)"
                  :type="revealed[k.id] ? 'text' : 'password'"
                  :placeholder="k.placeholder || 'sk-…'"
                  class="w-full px-3 py-2 rounded-lg text-[11px] font-mono outline-none transition-theme"
                  :class="isDark ? 'bg-white/5 text-primary-cream border border-white/10 focus:border-primary-rose/50' : 'bg-primary-dark/5 text-primary-dark border border-primary-dark/10 focus:border-primary-rose/50'" />
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
            Save Settings
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { onMounted, computed, ref, reactive } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { useSettingsStore } from '../stores/settings.js'
import { useCalendarStore } from '../stores/calendar.js'

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
  { id: 'MINIMAX_API_KEY',  label: 'MiniMax',           hint: 'minimax.chat' },
  { id: 'OPENWEATHER_KEY',  label: 'OpenWeather',       hint: 'openweathermap.org' }
]
const byokValues = reactive({})
const revealed = reactive({})  // not exposed in UI yet; future toggle for show/hide
const applying = ref(false)

async function loadBYOK() {
  if (!isTauri) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    for (const k of byokKeys) {
      byokValues[k.id] = await invoke('get_api_key', { provider: k.id })
    }
  } catch (e) {
    console.warn('[BYOK] load failed:', e?.message)
  }
}

async function updateKey(id, value) {
  byokValues[id] = value
  if (!isTauri) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('save_api_key', { provider: id, value })
  } catch (e) {
    console.warn('[BYOK] save failed:', e?.message)
  }
}

async function applyKeys() {
  if (!isTauri || applying.value) return
  applying.value = true
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('apply_api_keys')
    // Sidecar respawns; refresh providers + settings from the new server
    setTimeout(() => settings.fetchProviders(), 1500)
  } catch (e) {
    console.warn('[BYOK] apply failed:', e?.message)
  } finally {
    setTimeout(() => { applying.value = false }, 1500)
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
