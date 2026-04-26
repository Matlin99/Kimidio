import { ref, onMounted, onUnmounted } from 'vue'
import { wsBase, ready } from './useApiBase.js'

export function useWebSocket() {
  const ws = ref(null)
  const isConnected = ref(false)
  const messages = ref([])

  const connect = async () => {
    if (ws.value?.readyState === WebSocket.OPEN) return
    // Wait for the sidecar (or fallback) to be ready before opening the
    // socket. In Tauri the port resolves async via the get_server_port
    // command; in pure-web mode this resolves synchronously.
    await ready

    ws.value = new WebSocket(`${wsBase.value}/stream`)

    ws.value.onopen = () => {
      isConnected.value = true
      console.log('WebSocket connected')
    }

    ws.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        messages.value.push(data)
        console.log('WS message:', data)
      } catch (e) {
        console.error('WS parse error:', e)
      }
    }

    ws.value.onclose = () => {
      isConnected.value = false
      console.log('WebSocket disconnected')
      // Auto reconnect
      setTimeout(connect, 3000)
    }

    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  const send = (data) => {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(data))
    }
  }

  onMounted(connect)
  onUnmounted(() => {
    ws.value?.close()
  })

  return {
    ws,
    isConnected,
    messages,
    connect,
    send,
  }
}
