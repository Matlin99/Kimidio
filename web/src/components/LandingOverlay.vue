<template>
  <Transition name="landing">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4"
      :class="isDark ? 'bg-[#0a0809]' : 'bg-[#F4EEF0]'">

      <!-- Soft glow background -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute -top-1/4 -left-1/4 w-[800px] h-[800px] rounded-full opacity-30 blur-3xl"
          :class="isDark ? 'bg-gradient-to-br from-rose-900/40 to-purple-900/30' : 'bg-gradient-to-br from-rose-200/60 to-pink-200/40'"></div>
        <div class="absolute -bottom-1/4 -right-1/4 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
          :class="isDark ? 'bg-gradient-to-tl from-blue-900/30 to-purple-900/20' : 'bg-gradient-to-tl from-blue-200/50 to-purple-200/30'"></div>
      </div>

      <div class="relative z-10 flex flex-col items-center gap-8 max-w-xl text-center">

        <!-- Brand -->
        <div class="flex flex-col items-center gap-3">
          <div class="animate-loading-pulse">
            <svg width="68" height="68" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="10" y="25" width="60" height="40" rx="8" stroke="#B0666D" stroke-width="3" fill="none"/>
              <line x1="15" y1="20" x2="65" y2="20" stroke="#B0666D" stroke-width="2" stroke-linecap="round"/>
              <circle cx="30" cy="45" r="8" stroke="#B0666D" stroke-width="2" fill="none"/>
              <rect x="48" y="38" width="16" height="14" rx="2" fill="#B0666D" opacity="0.6"/>
              <line x1="50" y1="10" x2="55" y2="20" stroke="#B0666D" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="font-mono text-[10px] tracking-[0.4em] uppercase"
            :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">Kimi Radio</div>
        </div>

        <!-- LLM greeting — Playfair Display italic for editorial / radio feel -->
        <p class="text-[28px] md:text-[34px] leading-[1.25] font-artistic italic px-4 tracking-tight"
          :class="isDark ? 'text-white/95' : 'text-primary-dark/95'">
          {{ greeting }}
        </p>

        <!-- Date / context line -->
        <div class="font-mono text-[10px] tracking-[0.3em] uppercase"
          :class="isDark ? 'text-primary-cream/40' : 'text-primary-dark/40'">
          {{ dateLine }}
        </div>

        <!-- Begin button -->
        <button type="button" @click="$emit('begin')"
          class="mt-4 px-10 py-3.5 rounded-full bg-primary-rose text-white text-[11px] font-grotesk font-semibold uppercase tracking-[0.35em] transition-all duration-200 ease-spring hover:scale-[1.04] active:scale-95 shadow-lg shadow-primary-rose/25">
          Begin
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme.js'

defineProps({
  show: { type: Boolean, default: false },
  greeting: { type: String, default: '' }
})
defineEmits(['begin'])

const { isDark } = useTheme()

const dateLine = computed(() => {
  const now = new Date()
  const day = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const month = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const d = now.getDate()
  return `${day} · ${month} ${d}`
})
</script>

<style scoped>
.landing-enter-active,
.landing-leave-active {
  transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.landing-enter-from,
.landing-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

.greeting-enter-active,
.greeting-leave-active {
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.greeting-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.greeting-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
