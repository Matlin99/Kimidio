<template>
  <div class="px-5 py-3 transition-theme"
    :class="isDark ? 'bg-primary-dark/20 border-t border-white/5' : 'bg-white border-t border-primary-dark/5'">
    
    <!-- Live Indicator Row -->
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <span class="relative flex h-1.5 w-1.5">
          <span class="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
        </span>
        <span class="text-[9px] uppercase tracking-[0.3em] font-medium text-red-500 font-grotesk">
          Live
        </span>
      </div>
      <span class="text-[9px] uppercase tracking-[0.2em] transition-theme font-grotesk"
        :class="isDark ? 'text-primary-rose/80' : 'text-primary-rose'">
        DRBL FM
      </span>
    </div>
    
    <!-- AI DJ Terminal -->
    <div @click="chat.openChat"
      class="flex items-center justify-between py-1.5 px-2.5 rounded-lg cursor-pointer transition-all duration-200 ease-out-expo group hover:scale-[1.01] active:scale-[0.99]"
      :class="isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-primary-dark/5 hover:bg-primary-dark/10'">
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-mono transition-theme"
          :class="isDark ? 'text-primary-cream/60' : 'text-primary-dark/60'">
          &gt;_
        </span>
        <span class="text-[10px] uppercase tracking-[0.2em] font-medium transition-theme font-grotesk"
          :class="isDark ? 'text-primary-cream/80 group-hover:text-primary-cream' : 'text-primary-dark/80 group-hover:text-primary-dark'">
          AI DJ Terminal
        </span>
      </div>
      <span class="text-[9px] uppercase tracking-[0.15em] transition-theme group-hover:text-primary-rose font-grotesk"
        :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">
        [ Open ]
      </span>
    </div>
  </div>
</template>

<script setup>
import { useTheme } from '../composables/useTheme.js'
import { usePlayerStore } from '../stores/player.js'
import { useChatStore } from '../stores/chat.js'

const { isDark } = useTheme()
const player = usePlayerStore()
const chat = useChatStore()
</script>
