import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSettingsStore } from './settings.js'
import { usePlayerStore } from './player.js'
import { tts } from '../composables/useTTS.js'

import { apiBase, ready as apiReady } from '../composables/useApiBase.js'

export const useChatStore = defineStore('chat', () => {
  const isOpen = ref(false)
  const messages = ref([])
  const isLoading = ref(false)
  const inputMessage = ref('')
  const error = ref(null)

  const settings = useSettingsStore()
  const player = usePlayerStore()

  const openChat = () => { isOpen.value = true }
  const closeChat = () => { isOpen.value = false }
  const toggleChat = () => { isOpen.value = !isOpen.value }

  const history = computed(() => {
    return messages.value.map(m => ({ role: m.role, content: m.content }))
  })

  const sendMessage = async (text) => {
    if (!text.trim()) return
    error.value = null

    // Add user message locally
    messages.value.push({ role: 'user', content: text })
    inputMessage.value = ''
    isLoading.value = true

    // Gate on apiReady — see player.js curatePlaylist comment for why.
    await apiReady
    const url = `${apiBase.value}/api/chat`
    console.log(`[chat] POST ${url}`)
    try {
      // 60s timeout — chat round-trip can take 25-40s for "recommend N
      // tracks" requests (slow reasoning model + 4-6 SC/YT searches +
      // first-track yt-dlp prefetch). 30s wasn't enough and produced
      // "Fetch is aborted" errors right after a real LLM reply was on
      // its way back. Need a generous ceiling that still trips on a
      // genuinely dead sidecar.
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: history.value.slice(0, -1), // exclude the message we just added
          provider: settings.llmProvider
        }),
        signal: AbortSignal.timeout(60000)
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      const msg = {
        role: 'assistant',
        content: data.content,
        structured: data.structured || null
      }

      // Auto-append resolved tracks to the user's playlist — the DJ said it
      // would "play" them, so make that actually happen. De-dup against
      // existing queue by track id to avoid stacking the same song.
      const newTracks = data.structured?.queue || []
      if (newTracks.length) {
        const existing = new Set(player.queue.map(t => t.id))
        const added = []
        for (const t of newTracks) {
          if (!t || !t.id || existing.has(t.id)) continue
          player.addToQueue(t)
          existing.add(t.id)
          added.push(t)
        }
        msg.addedCount = added.length
      }

      messages.value.push(msg)

      // TTS in chat responses is intentionally disabled — DJ voice only plays
      // during the opening monologue, not per chat reply.
    } catch (e) {
      console.error('Chat error:', e)
      error.value = e.message
      messages.value.push({
        role: 'assistant',
        content: `Sorry, I'm having trouble connecting right now. ${e.message}`,
        isError: true
      })
    } finally {
      isLoading.value = false
    }
  }

  const addAssistantMessage = (content, structured = null) => {
    messages.value.push({ role: 'assistant', content, structured })
  }

  const clearMessages = () => {
    messages.value = []
  }

  // Replace the entire messages array (used by useBroadcastSync to apply
  // a peer window's snapshot). Goes through this action — not direct
  // splice/assignment from outside — to ensure Vue picks up the change
  // reliably across Pinia's auto-unwrap layer.
  const setMessages = (arr) => {
    messages.value = (Array.isArray(arr) ? arr : []).map(m => ({ ...m }))
  }

  return {
    isOpen, messages, isLoading, inputMessage, error,
    openChat, closeChat, toggleChat, sendMessage,
    addAssistantMessage, clearMessages, setMessages, history
  }
})
