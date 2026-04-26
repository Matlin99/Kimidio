// Single source of truth for the backend URL. Everything that does
// `fetch('${API_BASE}/api/...')` or opens a WebSocket reads from here.
//
// Three runtime contexts:
//
//   1. Pure web dev mode (npm run dev, browser at localhost:5173).
//      The server runs separately on 8080. We hardcode that fallback
//      and let the Vite proxy / direct fetches go to 8080.
//
//   2. Tauri dev mode (npm run tauri:dev).
//      Frontend still served from Vite (5173 HMR), but the Express
//      sidecar is spawned by Rust on a random port. We invoke the
//      Tauri command `get_server_port` to learn it, plus listen for
//      the `server-ready` event so the switch is push-based, not poll.
//
//   3. Tauri production (.dmg / .exe).
//      Same as #2 but the frontend is loaded from tauri:// instead of
//      http://. Behavior is identical from the JS side.

import { ref, computed } from 'vue'

// Detect Tauri runtime. __TAURI_INTERNALS__ (Tauri 2) and __TAURI__
// (Tauri 1) are both set on `window` early in the bootstrap. Some HMR
// reloads can race the global injection though, so callers ALSO try the
// invoke path and fall back gracefully — this synchronous check is just
// an optimization to skip the Tauri import in pure web mode.
function isTauri() {
  if (typeof window === 'undefined') return false
  return !!(window.__TAURI_INTERNALS__ || window.__TAURI__ || window.isTauri)
}

// Default fallback: the dev mode path. Override with VITE_API_BASE for
// rare cases (e.g. pointing the web app at a hosted backend).
const FALLBACK = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

// Reactive — components that template-bind to apiBase will refresh once
// the Tauri sidecar reports its port. Most consumers just read .value at
// fetch time, which is also fine: we resolve it before BEGIN is clickable.
const apiBase = ref(FALLBACK)

const wsBase = computed(() => apiBase.value.replace(/^http/, 'ws'))

// Promise that resolves once we have the real port. Use this to gate any
// startup work that MUST hit the sidecar (e.g. fetching today-context for
// BootDiagnostic). Pure-web mode: resolves immediately with FALLBACK.
let readyResolve = null
const ready = new Promise((resolve) => { readyResolve = resolve })

// Cached invoke handle so refreshPort can run without re-importing.
let tauriInvoke = null

async function init() {
  // Always TRY the Tauri import + invoke. In pure web mode, invoke will
  // throw and we fall back to FALLBACK; no isTauri() gating needed. This
  // beats the synchronous global-check approach which is brittle to HMR
  // reload races where __TAURI_INTERNALS__ isn't ready yet.
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')
    tauriInvoke = invoke

    // Listen FIRST so we don't miss the event if it fires between checks.
    // Re-broadcasts on every sidecar respawn (BYOK key change, dev rebuild)
    // so apiBase always points at the LIVE port, not a dead one.
    listen('server-ready', (e) => {
      const port = Number(e.payload)
      if (port > 0) {
        const fresh = `http://localhost:${port}`
        if (apiBase.value !== fresh) {
          console.log(`[useApiBase] sidecar moved: ${apiBase.value} → ${fresh}`)
        }
        apiBase.value = fresh
        readyResolve(apiBase.value)
      }
    }).catch(() => { /* not in Tauri — listen() rejects */ })

    // Then poll-once: if the sidecar booted before our listener, get_server_port
    // already returns the value. If invoke throws, we're in pure web mode.
    const port = await invoke('get_server_port')
    if (port) {
      apiBase.value = `http://localhost:${port}`
      console.log(`[useApiBase] sidecar at http://localhost:${port}`)
      readyResolve(apiBase.value)
      return
    }
    // Tauri detected but sidecar not ready yet — wait for event.
  } catch (e) {
    console.warn('[useApiBase] not Tauri (or sidecar invoke failed), using fallback', FALLBACK)
    readyResolve(apiBase.value)
  }
}

// Wrapper around fetch that ALWAYS awaits the sidecar port resolution
// first. Use this for everything that hits /api/* — without the gate, an
// early boot fetch sends to FALLBACK (8080, dead) and silently fails,
// leaving the UI stuck. Path can start with `/api/...` (recommended) or
// be absolute; in the latter case apiBase is bypassed.
export async function apiFetch(path, init) {
  await ready
  const url = path.startsWith('http') ? path : `${apiBase.value}${path}`
  return fetch(url, init)
}

// Force a fresh port lookup — call before risky long-running fetches in
// case sidecar respawned and the event listener missed it (e.g. listener
// torn down during HMR before the rebuild finished).
export async function refreshPort() {
  if (!isTauri() || !tauriInvoke) return
  try {
    const port = await tauriInvoke('get_server_port')
    if (port) {
      const fresh = `http://localhost:${port}`
      if (apiBase.value !== fresh) {
        console.log(`[useApiBase] refreshPort: ${apiBase.value} → ${fresh}`)
        apiBase.value = fresh
      }
    }
  } catch { /* swallow */ }
}

// Kick off init at module load. Idempotent because we only ever resolve
// once and the listener is safe to attach pre-event.
init()

export function useApiBase() {
  return { apiBase, wsBase, ready }
}

// Convenience exports for non-component callers (composables, stores).
// Read .value at fetch time so they pick up the post-sidecar update.
export { apiBase, wsBase, ready }
