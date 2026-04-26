<template>
  <!-- Pet window root: borderless transparent OS window; the rounded
       chrome lives entirely in CSS here. Drag is handled by the
       onShellMouseDown listener — any non-interactive mousedown on the
       shell calls window.startDragging() (CSS app-region doesn't work
       in macOS WebKit, and data-tauri-drag-region doesn't bubble).
       Two visual modes inside pet, driven by player.viewMode:
         'hidden' — TopPanel only (slimmest)
         'mini'   — TopPanel + MiniStatusBar (LIVE + AI DJ Terminal)
       TopPanel's chevron cycles hidden → mini → full; full triggers the
       watch in stores/player.js to restore the main window. -->
  <div ref="shellRef" class="pet-shell" @mousedown="onShellMouseDown">
    <div ref="contentRef" class="pet-content">
      <TopPanel />
      <Transition name="mini-reveal">
        <MiniStatusBar v-if="player.viewMode === 'mini'" />
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import TopPanel from './components/TopPanel.vue'
import MiniStatusBar from './components/MiniStatusBar.vue'
import { usePlayerStore } from './stores/player.js'
import { startBroadcastSync } from './composables/useBroadcastSync.js'

const player = usePlayerStore()
const contentRef = ref(null)
const shellRef = ref(null)
let appWindow = null

// Window dragging — Tauri 2's CSS -webkit-app-region doesn't work in macOS
// WebKit, and data-tauri-drag-region only catches clicks on the exact
// element it's on (children with backgrounds block it). The reliable path:
// listen for mousedown on the shell and call window.startDragging() unless
// the click landed on something interactive.
function onShellMouseDown(e) {
  if (!appWindow) return
  if (e.button !== 0) return
  const interactive = e.target.closest('button, input, textarea, a, select, [data-no-drag]')
  if (interactive) return
  appWindow.startDragging().catch(() => {})
}

// Pet mirrors main's player.queue + currentIndex via BroadcastChannel so
// the cover, title, and play indicator reflect what's actually playing.
// Pet's audio is muted in the sync init so we don't get double playback.
startBroadcastSync('pet')

// Auto-fit the OS window to whatever the inner content actually renders.
// Width stays locked at 420; height tracks the .pet-content layout box.
//
// Resize cadence matters a lot for the perceived smoothness of the
// hide→mini and terminal-open transitions. The inner Vue transition
// animates max-height over 550ms, so the content height is changing every
// frame. We rAF-throttle the observer (one setSize per frame max) and
// skip the cooldown/pending dance entirely — macOS handles 60Hz setFrame
// fine, and any throttling-bigger-than-RAF turns the smooth inner curve
// into 5–7 visible step jumps.
let observer = null
let rafScheduled = false
let lastH = 0
let setSize = null

function applyHeight() {
  if (!setSize || !contentRef.value) return
  const measured = Math.ceil(contentRef.value.getBoundingClientRect().height)
  if (measured < 60 || measured === lastH) return
  lastH = measured
  setSize(420, measured).catch(() => {})
}

function scheduleApply() {
  if (rafScheduled) return
  rafScheduled = true
  requestAnimationFrame(() => {
    rafScheduled = false
    applyHeight()
  })
}

onMounted(async () => {
  if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return
  const [{ getCurrentWindow }, { LogicalSize }] = await Promise.all([
    import('@tauri-apps/api/window'),
    import('@tauri-apps/api/dpi')
  ])
  const me = getCurrentWindow()
  if (me.label !== 'pet') return
  appWindow = me
  setSize = (w, h) => me.setSize(new LogicalSize(w, h))
  observer = new ResizeObserver(scheduleApply)
  if (contentRef.value) observer.observe(contentRef.value)
  applyHeight()
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})
</script>

<style>
/* Reset body + html so the borderless window actually shows our rounded
   shell instead of a default white background. */
html, body, #app {
  background: transparent !important;
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100vh;
}
</style>

<style scoped>
.pet-shell {
  height: 100vh;
  background: rgba(10, 8, 9, 0.94);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
}

/* Inner wrapper holds the natural content height — ResizeObserver
   measures this and the OS window snaps to it. flex-shrink:0 + plain
   block layout (NOT a flex child of pet-shell) ensures the measured
   height is the real content height, not the parent-clipped height. */
.pet-content {
  width: 100%;
  display: block;
}

/* Drag is handled imperatively by onShellMouseDown → startDragging() in
   PetApp.vue. CSS -webkit-app-region doesn't work in Tauri's macOS WebKit,
   and data-tauri-drag-region doesn't propagate through child elements
   that paint their own backgrounds — so we own the mousedown directly. */

/* MiniStatusBar enters with a soft slide+fade so the OS window growth
   (driven by ResizeObserver) and the inner content reveal feel like one
   coherent motion instead of "window snap → content pop". cubic-bezier
   matches the Apple-style easing used elsewhere in the app. */
.mini-reveal-enter-active,
.mini-reveal-leave-active {
  transition: opacity 0.35s cubic-bezier(0.32, 0.72, 0, 1),
              transform 0.45s cubic-bezier(0.32, 0.72, 0, 1);
  transform-origin: top center;
}
.mini-reveal-enter-from,
.mini-reveal-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.985);
}
</style>
