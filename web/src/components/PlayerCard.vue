<template>
  <div class="player-card relative grid ios-grid-rows overflow-hidden"
    :class="isDark ? 'bg-primary-dark' : 'bg-primary-cream'"
    :style="{
      width: '420px',
      borderRadius: '20px',
      boxShadow: 'var(--shadow-card)',
      gridTemplateRows: gridRows
    }">

    <!-- Top Panel (always visible) -->
    <TopPanel />

    <!-- Mini status bar — only in 'mini' mode. Wrapped in a Vue Transition
         so the LIVE/Terminal block inflates with the same iOS-15 spring as
         the inline chat drawer below it. -->
    <Transition name="mini-status">
      <MiniStatusBar v-if="player.viewMode === 'mini'" />
    </Transition>

    <!-- Expandable Content (full mode only). Same iOS curve, plus a small
         translateY + scale so the chrome "breathes in" rather than just
         fading. transform-origin: top so the lift reads as the panel
         unfolding downward from below the TopPanel. -->
    <div class="min-h-0 overflow-hidden ios-fade-shift"
      :style="{
        opacity: player.viewMode === 'full' ? 1 : 0,
        transform: player.viewMode === 'full' ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.985)'
      }">

      <!-- Player Controls -->
      <PlayerControls />

      <!-- Progress Bar -->
      <ProgressBar />

      <!-- Chrome (playlist + stories + live) — full mode only. -->
      <div
        :style="{
          transition: 'opacity 1.2s cubic-bezier(0.33, 1, 0.68, 1), transform 1.5s cubic-bezier(0.33, 1, 0.68, 1)',
          opacity: chromeVisible ? 1 : 0,
          transform: chromeVisible ? 'translateY(0)' : 'translateY(24px)'
        }"
        :class="{ 'pointer-events-none': !chromeVisible }">
        <TrackList />
        <MusicalStory />
        <LiveSection />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { usePlayerStore } from '../stores/player.js'
import TopPanel from './TopPanel.vue'
import PlayerControls from './PlayerControls.vue'
import ProgressBar from './ProgressBar.vue'
import TrackList from './TrackList.vue'
import MusicalStory from './MusicalStory.vue'
import LiveSection from './LiveSection.vue'
import MiniStatusBar from './MiniStatusBar.vue'

defineProps({
  chromeVisible: { type: Boolean, default: true }
})

const { isDark } = useTheme()
const player = usePlayerStore()

// Track count varies by viewMode (MiniStatusBar is conditional). Match the
// row template so the third "1fr" track only exists when there's content
// to fill it — otherwise mini-mode would stretch the empty expandable row
// and create dead space.
const gridRows = computed(() => {
  if (player.viewMode === 'full') return 'auto 1fr'        // TopPanel + expandable
  if (player.viewMode === 'mini') return 'auto auto 0fr'   // TopPanel + MiniStatusBar + (collapsed expandable)
  return 'auto 0fr'                                        // hidden: TopPanel + collapsed expandable
})
</script>

<style scoped>
/* iOS 15+ system spring for the entire collapse/expand. Used by:
   - the grid track interpolation (hidden/mini/full row sizes)
   - the expandable chrome's opacity + translateY/scale shift
   - the MiniStatusBar Transition enter/leave */
.ios-grid-rows {
  transition: grid-template-rows 0.55s cubic-bezier(0.32, 0.72, 0, 1);
}
.ios-fade-shift {
  transition: opacity   0.4s cubic-bezier(0.32, 0.72, 0, 1),
              transform 0.55s cubic-bezier(0.32, 0.72, 0, 1);
  transform-origin: top center;
}

/* MiniStatusBar enter/leave — soft inflate from the top edge. max-height
   is capped at 600px to comfortably cover the terminal-open state without
   leaving slack when the bar is closed. */
.mini-status-enter-active,
.mini-status-leave-active {
  transition: max-height 0.55s cubic-bezier(0.32, 0.72, 0, 1),
              opacity    0.4s  cubic-bezier(0.32, 0.72, 0, 1),
              transform  0.55s cubic-bezier(0.32, 0.72, 0, 1);
  overflow: hidden;
  transform-origin: top center;
}
.mini-status-enter-from,
.mini-status-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-6px) scale(0.985);
}
.mini-status-enter-to,
.mini-status-leave-from {
  max-height: 600px;
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
