<template>
  <div class="mini-status w-full transition-theme bg-primary-dark border-t border-white/5">
    <!-- LIVE / channel header -->
    <div class="flex items-center justify-between px-5 pt-3 pb-2">
      <div class="flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-primary-rose animate-live-pulse"></span>
        <span class="text-[10px] uppercase tracking-[0.3em] font-grotesk text-primary-rose">Live</span>
      </div>
      <span class="text-[10px] uppercase tracking-[0.3em] font-grotesk text-primary-rose/70">DRBL FM</span>
    </div>

    <!-- AI DJ TERMINAL row -->
    <button @click="toggleTerminal"
      class="w-full px-5 py-2.5 flex items-center justify-between transition-colors duration-200 ease-out-expo cursor-pointer hover:bg-white/[0.03]"
      :class="terminalOpen ? 'bg-white/[0.04]' : ''">
      <span class="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] font-grotesk text-primary-cream/80">
        <span class="text-primary-cream/40">›_</span>
        AI DJ Terminal
      </span>
      <span class="text-[10px] uppercase tracking-[0.25em] font-grotesk text-primary-cream/40">
        [ {{ terminalOpen ? 'Close' : 'Open' }} ]
      </span>
    </button>

    <!-- Inline chat. Apple-style spring transition: container max-height +
         opacity, inner content also lifts in with translateY + slight scale
         for that "soft inflate" feel. cubic-bezier(0.32, 0.72, 0, 1) is the
         iOS 15+ system curve — most natural on small drawers like this. -->
    <Transition name="terminal">
      <div v-if="terminalOpen" class="terminal-shell">
        <div class="terminal-inner px-5 pb-4 pt-2">
          <!-- Recent messages -->
          <div v-if="recentMessages.length" ref="messagesRef"
            class="space-y-2 max-h-[300px] overflow-y-auto pr-1 mb-3">
            <template v-for="msg in recentMessages" :key="msg._idx">
              <!-- Bubble -->
              <div class="flex" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
                <div class="max-w-[85%] flex flex-col" :class="msg.role === 'user' ? 'items-end' : 'items-start'">
                  <div class="px-3 py-2 rounded-2xl text-[12.5px] leading-relaxed transition-theme break-words"
                    :class="msg.role === 'user'
                      ? 'bg-primary-rose/20 text-primary-cream font-grotesk rounded-br-sm'
                      : 'bg-white/[0.06] text-primary-cream/90 font-artistic rounded-bl-sm'">
                    <span v-if="msg.role === 'assistant' && needsTypewriter(msg)">
                      <TypewriterText :text="displayContent(msg)" @done="markDone(msg)" />
                    </span>
                    <span v-else>{{ displayContent(msg) }}</span>
                  </div>
                  <!-- TTS Read button — assistant messages only. Click to read
                       the bubble aloud, click again to stop. Mirrors ArchivistChat. -->
                  <button v-if="msg.role === 'assistant' && displayContent(msg)?.trim()"
                    @click="toggleSpeak(msg)"
                    :title="isSpeakingThis(msg) ? 'Stop' : 'Read aloud'"
                    class="mt-1 ml-1 flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] font-grotesk px-2 py-0.5 rounded-full transition-all duration-200 ease-out-expo hover:scale-105 active:scale-95"
                    :class="isSpeakingThis(msg)
                      ? 'bg-primary-rose/20 text-primary-rose'
                      : 'text-primary-cream/40 hover:text-primary-rose hover:bg-primary-rose/10'">
                    <svg v-if="isSpeakingThis(msg)" width="9" height="9" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="3" y="3" width="4" height="10" rx="1"/>
                      <rect x="9" y="3" width="4" height="10" rx="1"/>
                    </svg>
                    <svg v-else width="9" height="9" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M5 3l9 5-9 5V3z"/>
                    </svg>
                    {{ isSpeakingThis(msg) ? 'Stop' : 'Read' }}
                  </button>
                </div>
              </div>

              <!-- Recommended tracks under assistant bubble -->
              <div v-if="msg.role === 'assistant' && msg.structured?.queue?.length"
                class="mt-1 ml-1 space-y-1.5">
                <p class="text-[9px] uppercase tracking-[0.25em] font-grotesk text-primary-rose/80 flex items-center gap-2">
                  <span>Added to playlist</span>
                  <span v-if="msg.addedCount" class="text-primary-cream/40 normal-case tracking-normal">
                    ({{ msg.addedCount }} {{ msg.addedCount === 1 ? 'track' : 'tracks' }})
                  </span>
                </p>
                <div v-for="track in msg.structured.queue" :key="track.id"
                  @click="playTrack(track)"
                  class="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all duration-200 ease-out-expo hover:scale-[1.01] active:scale-[0.99] bg-white/[0.04] hover:bg-white/[0.08] border border-white/5">
                  <div class="w-8 h-8 rounded-md overflow-hidden flex-shrink-0 bg-primary-rose/10">
                    <img :src="track.cover || `https://picsum.photos/seed/${encodeURIComponent(track.title)}/80/80`"
                      class="w-full h-full object-cover" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[11.5px] truncate font-grotesk text-primary-cream">{{ track.title }}</p>
                    <p class="text-[10px] truncate font-grotesk text-primary-cream/50">{{ track.artist }}</p>
                  </div>
                  <div class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-primary-rose/20 text-primary-rose">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M5 3l9 5-9 5V3z"/>
                    </svg>
                  </div>
                </div>
                <p v-if="msg.structured?.reason" class="text-[10px] italic font-artistic text-primary-cream/45 px-1 leading-relaxed">
                  {{ msg.structured.reason }}
                </p>
              </div>
            </template>

            <!-- Loading indicator (chat is fetching new reply) -->
            <div v-if="chat.isLoading" class="flex justify-start">
              <div class="max-w-[60%] px-3 py-2 rounded-2xl bg-white/[0.04] text-[11px] italic font-artistic text-primary-cream/50">
                spinning the decks…
              </div>
            </div>
          </div>
          <div v-else-if="chat.isLoading"
            class="text-[11px] italic font-artistic text-primary-cream/40 mb-3 px-1">
            spinning the decks…
          </div>
          <div v-else
            class="text-[10px] uppercase tracking-[0.25em] font-grotesk text-primary-cream/30 mb-3 px-1">
            ask anything →
          </div>

          <!-- Input -->
          <div class="flex items-center gap-2 px-3 py-2 rounded-full border transition-colors duration-200 ease-out-expo border-white/15 bg-white/[0.03] focus-within:border-primary-rose/50">
            <input v-model="input" @keyup.enter="send"
              :placeholder="speech.isListening.value ? 'Listening…' : 'say something…'"
              class="flex-1 bg-transparent text-[12.5px] outline-none text-primary-cream placeholder:text-primary-cream/30 font-grotesk" />

            <!-- Voice input. Only renders when the runtime supports
                 SpeechRecognition (Chromium-only — hidden in Tauri's macOS
                 WebKit, visible in dev via Chrome). -->
            <button v-if="speech.supported.value" @click="toggleVoiceInput"
              :title="speech.isListening.value ? 'Stop listening' : 'Voice input'"
              class="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ease-spring hover:scale-110 active:scale-95 flex-shrink-0"
              :class="speech.isListening.value
                ? 'bg-primary-rose text-white shadow-lg shadow-primary-rose/30 animate-mic-pulse'
                : 'bg-white/10 text-primary-cream/70 hover:bg-white/20'">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <rect x="6" y="1" width="4" height="9" rx="2"/>
                <path d="M3 7v1a5 5 0 0 0 10 0V7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </button>

            <button @click="send" :disabled="chat.isLoading || !input.trim()"
              class="w-7 h-7 rounded-full flex items-center justify-center bg-primary-rose text-white hover:bg-primary-rose/80 transition-all duration-200 ease-spring hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 flex-shrink-0">
              <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor">
                <path d="M2 7l10-5-5 5-5 5 5-5-10-5z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useChatStore } from '../stores/chat.js'
import { usePlayerStore } from '../stores/player.js'
import { tts } from '../composables/useTTS.js'
import { useSpeechRecognition } from '../composables/useSpeechRecognition.js'
import { dispatchPetCmd } from '../composables/useBroadcastSync.js'
import TypewriterText from './TypewriterText.vue'

// Detect pet runtime via window label (Tauri sets this) — pet's own audio
// is muted, so user-triggered playback must be forwarded to main.
const isPetWindow = typeof window !== 'undefined' &&
  (window.location.hash === '#/pet' ||
   window.location.search.includes('pet'))

const chat = useChatStore()
const player = usePlayerStore()

const terminalOpen = ref(false)
const input = ref('')
const messagesRef = ref(null)

function toggleTerminal() {
  terminalOpen.value = !terminalOpen.value
}

// Voice input — Web Speech API. Tauri's macOS WebKit doesn't ship
// SpeechRecognition; the supported flag will be false there and the mic
// button hides. Chrome/Edge in plain web mode it works.
const speech = useSpeechRecognition()
function toggleVoiceInput() {
  if (speech.isListening.value) speech.stop()
  else speech.start({ lang: 'zh-CN' })
}
watch(speech.transcript, (t) => {
  if (speech.isListening.value && t) input.value = t
})

// Per-message TTS playback. Same semantics as ArchivistChat's "Read"
// button — click to speak, click again to stop, only one message
// speaking at a time (tts.speak with force).
function isSpeakingThis(msg) {
  return tts.isSpeaking.value && tts.currentText.value === displayContent(msg)
}
function toggleSpeak(msg) {
  if (isSpeakingThis(msg)) { tts.stop(); return }
  const text = displayContent(msg)
  if (!text?.trim()) return
  tts.speak(text, { force: true })
}

// Last 4 messages (~2 exchanges). _idx is the original index so :key stays
// stable when the slice window shifts. Errors are filtered out (they go to
// the full chat overlay only).
const recentMessages = computed(() => {
  const all = chat.messages
    .map((m, i) => ({ ...m, _idx: i }))
    .filter(m => !m.isError)
  return all.slice(-4)
})

function displayContent(msg) {
  if (msg.structured?.say && msg.structured.say.trim()) return msg.structured.say
  const raw = msg.content || ''
  let cleaned = raw.replace(/```(?:json|[^\n`]*)?\n?[\s\S]*?```/g, '').trim()
  if (!cleaned) cleaned = raw.replace(/\{[\s\S]*?\}/, '').trim()
  return cleaned || raw
}

// Typewriter only on the latest assistant message, only on first reveal.
// Mirrors ArchivistChat's logic so reopening the terminal doesn't re-type.
function needsTypewriter(msg) {
  const last = recentMessages.value[recentMessages.value.length - 1]
  return msg._idx === last?._idx
    && !chat.isLoading
    && !msg.structured
    && !chat.messages[msg._idx]?.typewriterDone
}
function markDone(msg) {
  const real = chat.messages[msg._idx]
  if (real) real.typewriterDone = true
}

// Click a recommended track: in main, play directly; in pet, forward
// the command to main (pet's audio is muted, so a local play() would
// just silently do nothing).
function playTrack(track) {
  if (!track) return
  if (isPetWindow) {
    dispatchPetCmd('play-track', track)
    return
  }
  const idx = player.queue.findIndex(t => t.id === track.id)
  if (idx >= 0) {
    player.selectTrack(idx)
  } else {
    player.insertNext(track)
    player.selectTrack(player.currentIndex + 1)
  }
}

function send() {
  const text = input.value.trim()
  if (!text || chat.isLoading) return
  input.value = ''
  chat.sendMessage(text)
}

// Auto-scroll the message stack to the bottom on new messages or when the
// terminal opens, so the latest exchange is visible without manual scroll.
async function scrollToBottom() {
  await nextTick()
  if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
}
watch(() => chat.messages.length, scrollToBottom)
watch(terminalOpen, (open) => { if (open) scrollToBottom() })
</script>

<style scoped>
@keyframes live-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.4; transform: scale(0.7); }
}
.animate-live-pulse {
  animation: live-pulse 1.4s ease-in-out infinite;
}

@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(176, 102, 109, 0.45); }
  50%      { box-shadow: 0 0 0 6px rgba(176, 102, 109, 0); }
}
.animate-mic-pulse {
  animation: mic-pulse 1.2s ease-in-out infinite;
}

/* iOS 15+ system curve for soft drawer inflate. Outer shell handles
   max-height + opacity, inner content adds a subtle 6px lift + slight
   scale so it feels like the drawer is "breathing in" rather than just
   stretching mechanically. */
.terminal-shell {
  overflow: hidden;
}
.terminal-enter-active,
.terminal-leave-active {
  transition: max-height 0.55s cubic-bezier(0.32, 0.72, 0, 1),
              opacity    0.4s cubic-bezier(0.32, 0.72, 0, 1);
}
.terminal-enter-from,
.terminal-leave-to {
  max-height: 0;
  opacity: 0;
}
.terminal-enter-to,
.terminal-leave-from {
  max-height: 480px;
  opacity: 1;
}

.terminal-enter-active .terminal-inner,
.terminal-leave-active .terminal-inner {
  transition: transform 0.55s cubic-bezier(0.32, 0.72, 0, 1),
              opacity   0.4s cubic-bezier(0.32, 0.72, 0, 1);
  transform-origin: top center;
}
.terminal-enter-from .terminal-inner,
.terminal-leave-to .terminal-inner {
  transform: translateY(-6px) scale(0.985);
  opacity: 0;
}
</style>
