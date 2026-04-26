import { ref } from 'vue'

// Web Speech API wrapper. Chrome / Edge implement this natively (no key
// needed). Safari and Firefox don't, so we expose `supported` for UI gating.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition
const supported = ref(!!SR)
const isListening = ref(false)
const transcript = ref('')
const error = ref(null)

let recognizer = null

function ensureRecognizer(opts = {}) {
  if (recognizer || !SR) return recognizer
  recognizer = new SR()
  recognizer.continuous = false       // one utterance per start()
  recognizer.interimResults = true    // show partial as you speak
  recognizer.lang = opts.lang || 'zh-CN'  // bilingual user, Chinese primary

  recognizer.onresult = (e) => {
    let text = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      text += e.results[i][0].transcript
    }
    transcript.value = text.trim()
  }
  recognizer.onerror = (e) => {
    error.value = e.error
    isListening.value = false
  }
  recognizer.onend = () => {
    isListening.value = false
  }
  return recognizer
}

function start(opts) {
  if (!SR) return false
  ensureRecognizer(opts)
  if (isListening.value) return false
  transcript.value = ''
  error.value = null
  try {
    recognizer.lang = (opts && opts.lang) || recognizer.lang
    recognizer.start()
    isListening.value = true
    return true
  } catch (e) {
    error.value = e.message
    return false
  }
}

function stop() {
  if (!recognizer || !isListening.value) return
  try { recognizer.stop() } catch {}
}

export function useSpeechRecognition() {
  return { supported, isListening, transcript, error, start, stop }
}
