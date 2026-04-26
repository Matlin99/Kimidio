// App version exposed reactively. Reads from Tauri's getVersion() which
// pulls from src-tauri/tauri.conf.json so we never have a chance to skew
// between binary version and what the UI claims. In pure web mode we
// fall back to "dev" so misleading "v?" strings never ship.

import { ref } from 'vue'

const appVersion = ref('dev')
let resolved = false

async function init() {
  if (resolved) return
  resolved = true
  try {
    const { getVersion } = await import('@tauri-apps/api/app')
    const v = await getVersion()
    if (v) appVersion.value = `v${v}`
  } catch {
    // pure-web mode — keep "dev"
  }
}

init()

export { appVersion }
