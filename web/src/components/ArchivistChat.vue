<template>
  <Transition name="slide-up">
    <div v-if="chat.isOpen" class="fixed inset-0 z-40 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-400 ease-out-expo" @click="chat.closeChat"></div>
      
      <!-- Chat Panel -->
      <div class="relative w-[480px] max-h-[600px] rounded-card overflow-hidden flex flex-col shadow-2xl transition-transform duration-400 ease-out-expo"
        :class="isDark ? 'bg-primary-dark border border-white/10' : 'bg-white border border-primary-dark/10'">
        
        <!-- Header -->
        <div class="px-5 py-4 border-b flex items-center justify-between"
          :class="isDark ? 'border-white/10' : 'border-primary-dark/10'">
          <div class="flex items-center gap-2">
            <span class="text-caption font-mono" :class="isDark ? 'text-primary-cream/60' : 'text-primary-dark/60'">>_</span>
            <div>
              <p class="text-subtitle font-medium transition-theme" :class="isDark ? 'text-primary-cream' : 'text-primary-dark'">
                AI DJ
              </p>
              <!-- Live status: reflects what the SERVER is actually using,
                   not whatever localStorage says the user picked. Clicking
                   when MOCK opens Settings so the user can fix the missing
                   key in one tap. -->
              <button @click="onStatusClick" type="button"
                class="text-caption uppercase tracking-wider transition-colors duration-200 ease-out-expo"
                :class="activeProviderClass">
                {{ activeProvider.label }}
                <span class="ml-2 font-mono normal-case opacity-50 tracking-normal">{{ appVersion }}</span>
              </button>
            </div>
          </div>
          <button @click="chat.closeChat" class="w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200 ease-out-expo"
            :class="isDark ? 'hover:bg-white/10 text-primary-cream/60' : 'hover:bg-primary-dark/10 text-primary-dark/60'">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 2l10 10M12 2L2 12"/>
            </svg>
          </button>
        </div>
        
        <!-- Messages Area -->
        <div ref="messagesRef" class="flex-1 overflow-y-auto p-5 space-y-4 min-h-[300px]">
          <!-- Awaiting Query -->
          <div v-if="chat.messages.length === 0" class="text-center py-8">
            <div class="text-4xl mb-3 opacity-30" :class="isDark ? 'text-primary-cream' : 'text-primary-dark'">"</div>
            <p class="text-body uppercase tracking-wider transition-theme" :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">
              Say something to the DJ...
            </p>
            <p class="text-caption mt-2 transition-theme" :class="isDark ? 'text-primary-cream/30' : 'text-primary-dark/30'">
              Ask for recommendations, chat about music, or just say hi
            </p>
          </div>
          
          <!-- Messages -->
          <div v-for="(msg, i) in chat.messages" :key="i" class="flex animate-fade-in"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
            
            <!-- User Message -->
            <div v-if="msg.role === 'user'" class="max-w-[80%] px-4 py-3 rounded-2xl text-body leading-relaxed transition-theme"
              :class="isDark ? 'bg-white/10 text-primary-cream' : 'bg-primary-dark/10 text-primary-dark'">
              {{ msg.content }}
            </div>
            
            <!-- Assistant Message -->
            <div v-else class="max-w-[90%]">
              <!-- Error message -->
              <div v-if="msg.isError" class="px-4 py-3 rounded-2xl text-body leading-relaxed border border-red-500/20"
                :class="isDark ? 'bg-red-500/10 text-red-300' : 'bg-red-500/5 text-red-600'">
                {{ msg.content }}
              </div>
              
              <!-- Normal message -->
              <div v-else class="px-4 py-3 rounded-2xl text-body leading-relaxed transition-[background-color,color,border-color] duration-300 ease-out-expo relative"
                :class="isDark ? 'bg-primary-rose/10 text-primary-cream border border-primary-rose/20' : 'bg-primary-rose/5 text-primary-dark border border-primary-rose/10'">
                <!-- Typewriter effect for the latest assistant message ONLY
                     on its first render. Once it finishes, we mark the
                     message done so reopening the chat shows the full text
                     immediately rather than re-typing it character by char. -->
                <span v-if="needsTypewriter(msg, i)">
                  <TypewriterText :text="displayContent(msg)" @done="markTypewriterDone(msg)" />
                </span>
                <span v-else>{{ displayContent(msg) }}</span>
              </div>
              
              <!-- Structured Recommendation Cards -->
              <div v-if="msg.structured?.queue?.length" class="mt-2 space-y-2">
                <p class="text-[10px] uppercase tracking-[0.2em] transition-theme font-grotesk flex items-center gap-2"
                  :class="isDark ? 'text-primary-rose/70' : 'text-primary-rose'">
                  <span>Added to your playlist</span>
                  <span v-if="msg.addedCount" class="text-[9px] opacity-70 normal-case tracking-normal">
                    ({{ msg.addedCount }} {{ msg.addedCount === 1 ? 'track' : 'tracks' }})
                  </span>
                </p>
                <div v-for="(track, si) in msg.structured.queue" :key="track.id"
                  @click="playTrack(track)"
                  class="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-out-expo group hover:scale-[1.02] active:scale-[0.98]"
                  :class="isDark ? 'bg-white/5 hover:bg-white/10 border border-white/5' : 'bg-primary-dark/5 hover:bg-primary-dark/10 border border-primary-dark/5'">
                  <!-- Cover -->
                  <div class="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-primary-rose/10">
                    <img :src="track.cover || `https://picsum.photos/seed/${encodeURIComponent(track.title)}/80/80`"
                      class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <p class="text-[12px] font-medium truncate transition-theme font-grotesk"
                      :class="isDark ? 'text-primary-cream' : 'text-primary-dark'">
                      {{ track.title }}
                    </p>
                    <p class="text-[10px] truncate transition-theme font-grotesk"
                      :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">
                      {{ track.artist }}
                    </p>
                  </div>
                  <!-- Play Icon -->
                  <div class="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                    :class="isDark ? 'bg-primary-rose/20 group-hover:bg-primary-rose/30 text-primary-rose' : 'bg-primary-rose/10 group-hover:bg-primary-rose/20 text-primary-rose'">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M5 3l9 5-9 5V3z"/>
                    </svg>
                  </div>
                </div>
              </div>
              
              <!-- Reason text -->
              <div v-if="msg.structured?.reason" class="mt-1.5 px-1">
                <p class="text-[10px] italic leading-relaxed transition-theme font-artistic"
                  :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">
                  {{ msg.structured.reason }}
                </p>
              </div>

              <!-- Manual TTS playback. No autoplay — listener clicks if they
                   want to hear the DJ read this reply aloud. Toggles between
                   play/stop based on whether THIS message is currently being
                   spoken. -->
              <button v-if="!msg.isError && displayContent(msg)?.trim()"
                @click="toggleSpeak(msg)"
                :title="isSpeakingThis(msg) ? 'Stop' : 'Read aloud'"
                class="mt-1.5 flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] font-grotesk px-2 py-1 rounded-full transition-all duration-200 ease-out-expo hover:scale-105 active:scale-95"
                :class="isSpeakingThis(msg)
                  ? 'bg-primary-rose/20 text-primary-rose'
                  : (isDark ? 'text-primary-cream/40 hover:text-primary-rose hover:bg-primary-rose/10' : 'text-primary-dark/40 hover:text-primary-rose hover:bg-primary-rose/10')">
                <svg v-if="isSpeakingThis(msg)" width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="3" width="4" height="10" rx="1"/>
                  <rect x="9" y="3" width="4" height="10" rx="1"/>
                </svg>
                <svg v-else width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5 3l9 5-9 5V3z"/>
                </svg>
                {{ isSpeakingThis(msg) ? 'Stop' : 'Read' }}
              </button>
            </div>
          </div>
          
          <!-- Loading State -->
          <div v-if="chat.isLoading" class="flex justify-start animate-fade-in">
            <div class="px-4 py-3 rounded-2xl text-body"
              :class="isDark ? 'bg-primary-rose/10 text-primary-cream/60 border border-primary-rose/20' : 'bg-primary-rose/5 text-primary-dark/60 border border-primary-rose/10'">
              <span class="inline-flex items-center gap-2">
                <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Spinning the decks...
              </span>
            </div>
          </div>
        </div>
        
        <!-- Input Area -->
        <div class="p-4 border-t" :class="isDark ? 'border-white/10' : 'border-primary-dark/10'">
          <div class="flex items-center gap-2 px-4 py-2.5 rounded-full border transition-colors duration-200 ease-out-expo"
            :class="isDark ? 'border-white/20 bg-white/5 focus-within:border-primary-rose/50' : 'border-primary-dark/20 bg-primary-dark/5 focus-within:border-primary-rose/50'">
            <input v-model="chat.inputMessage" @keyup.enter="sendMessage"
              :placeholder="speech.isListening.value ? 'Listening…' : 'Say something to the DJ...'"
              class="flex-1 bg-transparent text-body outline-none transition-theme placeholder:opacity-40"
              :class="isDark ? 'text-primary-cream placeholder:text-primary-cream' : 'text-primary-dark placeholder:text-primary-dark'" />

            <!-- Voice input (Web Speech API) — Chrome / Edge only -->
            <button v-if="speech.supported.value" @click="toggleVoiceInput"
              :title="speech.isListening.value ? 'Stop listening' : 'Voice input'"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ease-spring hover:scale-110 active:scale-95 flex-shrink-0"
              :class="speech.isListening.value
                ? 'bg-primary-rose text-white shadow-lg shadow-primary-rose/30 animate-mic-pulse'
                : (isDark ? 'bg-white/10 text-primary-cream/70 hover:bg-white/20' : 'bg-primary-dark/10 text-primary-dark/70 hover:bg-primary-dark/20')">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <rect x="6" y="1" width="4" height="9" rx="2"/>
                <path d="M3 7v1a5 5 0 0 0 10 0V7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </button>

            <button @click="sendMessage"
              class="w-8 h-8 rounded-full flex items-center justify-center bg-primary-rose text-white hover:bg-primary-rose/80 transition-all duration-200 ease-spring hover:scale-110 active:scale-95 flex-shrink-0"
              :disabled="chat.isLoading">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M2 7l10-5-5 5-5 5 5-5-10-5z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { useChatStore } from '../stores/chat.js'
import { useSettingsStore } from '../stores/settings.js'
import { usePlayerStore } from '../stores/player.js'
import { tts } from '../composables/useTTS.js'
import { useSpeechRecognition } from '../composables/useSpeechRecognition.js'
import { appVersion } from '../composables/useAppVersion.js'
import TypewriterText from './TypewriterText.vue'

const speech = useSpeechRecognition()
function toggleVoiceInput() {
  if (speech.isListening.value) {
    speech.stop()
  } else {
    speech.start({ lang: 'zh-CN' })
  }
}
// Live-mirror the recognizer's transcript into the chat input as you speak
watch(speech.transcript, (t) => {
  if (speech.isListening.value && t) chat.inputMessage = t
})

const { isDark } = useTheme()
const chat = useChatStore()
const settings = useSettingsStore()
const player = usePlayerStore()

const messagesRef = ref(null)

// Re-fetch provider status when chat opens so the badge reflects current
// sidecar reality (e.g. user just added a key in Settings).
watch(() => chat.isOpen, (open) => {
  if (open) settings.fetchProviders()
})

// Compute live provider state from /api/providers, NOT from localStorage.
// `settings.llmProvider` is just the user's preference; it lies if the
// preferred provider's key isn't actually configured on the server. This
// makes the badge reflect what the chat request is *really* going to hit.
const activeProvider = computed(() => {
  const list = settings.availableProviders || []
  const real = list.filter(p => p.configured && !p.isMock)
  if (real.length === 0) {
    return { kind: 'mock', label: '⚠ MOCK · TAP TO ADD KEY' }
  }
  const preferred = real.find(p => p.name === settings.llmProvider)
  if (preferred) {
    return { kind: 'live', label: `${preferred.name.toUpperCase()} · LIVE` }
  }
  // User picked a provider whose key isn't loaded; chat router falls back
  // to the first available real provider (try-order in router.js).
  const fb = real[0]
  return { kind: 'fallback', label: `${fb.name.toUpperCase()} · LIVE (fallback)` }
})

const activeProviderClass = computed(() => {
  if (activeProvider.value.kind === 'mock') {
    return 'text-red-400 hover:text-red-300 cursor-pointer underline-offset-4 hover:underline'
  }
  if (activeProvider.value.kind === 'fallback') {
    return isDark.value ? 'text-yellow-400/80' : 'text-yellow-600/80'
  }
  return isDark.value ? 'text-green-400/80' : 'text-green-600/80'
})

function onStatusClick() {
  // Only acts when there's something to fix. Closing the chat first so the
  // user can see the Settings overlay below it.
  if (activeProvider.value.kind !== 'mock') return
  chat.closeChat()
  settings.isSettingsOpen = true
}

const sendMessage = () => {
  if (chat.isLoading) return
  chat.sendMessage(chat.inputMessage)
}

const playTrack = (track) => {
  if (!track) return
  // Track was auto-appended to the queue in chat.sendMessage. Find its
  // current index and jump to it rather than inserting a duplicate.
  const idx = player.queue.findIndex(t => t.id === track.id)
  if (idx >= 0) {
    player.selectTrack(idx)
  } else {
    player.insertNext(track)
    player.selectTrack(player.currentIndex + 1)
  }
  chat.closeChat()
}

// Typewriter only on first reveal of the latest assistant message — never
// for structured/error messages (those render as cards/red banners) and
// never after typewriterDone has been flipped on.
function needsTypewriter(msg, i) {
  return msg.role === 'assistant'
    && i === chat.messages.length - 1
    && !chat.isLoading
    && !msg.structured
    && !msg.typewriterDone
}

function markTypewriterDone(msg) {
  msg.typewriterDone = true
}

// Manual TTS playback per-message. Tracks the currently-spoken message id
// so the play/stop button correctly toggles state across re-renders.
function isSpeakingThis(msg) {
  return tts.isSpeaking.value && tts.currentText.value === displayContent(msg)
}
function toggleSpeak(msg) {
  if (isSpeakingThis(msg)) {
    tts.stop()
    return
  }
  const text = displayContent(msg)
  if (!text?.trim()) return
  tts.speak(text, { force: true })
}

// Clean the content for display. Some LLMs (esp. reasoning models) answer
// with a ```json {...}``` block followed by plain chat — we want to show
// only the chat part, not the JSON. If structured was parsed, prefer the
// `say` field; otherwise strip code fences from the raw content.
function displayContent(msg) {
  if (msg.isError) return msg.content
  if (msg.structured) {
    const say = msg.structured.say
    if (say && say.trim()) return say
  }
  const raw = msg.content || ''
  // Strip fenced code blocks (```json ... ```) and lone {...} JSON blocks
  let cleaned = raw.replace(/```(?:json|[^\n`]*)?\n?[\s\S]*?```/g, '').trim()
  if (!cleaned) {
    cleaned = raw.replace(/\{[\s\S]*?\}/, '').trim()
  }
  return cleaned || raw
}

// Auto-scroll to bottom — both on new message AND on each open, so reopening
// the chat lands on the latest reply rather than the oldest history.
async function scrollToBottom() {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}
watch(() => chat.messages.length, scrollToBottom)
watch(() => chat.isOpen, (open) => { if (open) scrollToBottom() })
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.97);
}

@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(176, 102, 109, 0.45); }
  50%      { box-shadow: 0 0 0 6px rgba(176, 102, 109, 0); }
}
.animate-mic-pulse {
  animation: mic-pulse 1.2s ease-in-out infinite;
}
</style>
