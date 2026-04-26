<template>
  <Transition name="welcome">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4"
      :class="isDark ? 'bg-[#0a0809]' : 'bg-[#F4EEF0]'">

      <!-- Soft glow background -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute -top-1/4 -left-1/4 w-[700px] h-[700px] rounded-full opacity-30 blur-3xl"
          :class="isDark ? 'bg-gradient-to-br from-rose-900/40 to-purple-900/30' : 'bg-gradient-to-br from-rose-200/60 to-pink-200/40'"></div>
        <div class="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
          :class="isDark ? 'bg-gradient-to-tl from-blue-900/30 to-purple-900/20' : 'bg-gradient-to-tl from-blue-200/50 to-purple-200/30'"></div>
      </div>

      <div class="relative z-10 w-full max-w-md rounded-2xl p-6 transition-theme"
        :class="isDark ? 'bg-primary-dark/60 border border-white/10' : 'bg-white/70 border border-primary-dark/10'"
        style="backdrop-filter: blur(24px);">

        <!-- Brand -->
        <div class="flex flex-col items-center gap-2 mb-5">
          <svg width="44" height="44" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="25" width="60" height="40" rx="8" stroke="#B0666D" stroke-width="3" fill="none"/>
            <line x1="15" y1="20" x2="65" y2="20" stroke="#B0666D" stroke-width="2" stroke-linecap="round"/>
            <circle cx="30" cy="45" r="8" stroke="#B0666D" stroke-width="2" fill="none"/>
            <rect x="48" y="38" width="16" height="14" rx="2" fill="#B0666D" opacity="0.6"/>
            <line x1="50" y1="10" x2="55" y2="20" stroke="#B0666D" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <div class="font-mono text-[10px] tracking-[0.35em] uppercase"
            :class="isDark ? 'text-primary-cream/60' : 'text-primary-dark/60'">Kimi Radio</div>
          <div class="text-[15px] font-medium font-grotesk text-center"
            :class="isDark ? 'text-white' : 'text-primary-dark'">
            Tell me what you're in the mood for
          </div>
        </div>

        <!-- Genre -->
        <div class="mb-4">
          <label class="block text-[9px] font-grotesk font-semibold uppercase tracking-[0.3em] mb-2"
            :class="isDark ? 'text-white/50' : 'text-primary-dark/50'">Genre</label>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="g in GENRES" :key="g"
              type="button"
              @click="toggle('genres', g)"
              class="px-2.5 py-1 rounded-full text-[11px] font-grotesk border transition-all duration-150 ease-out-expo hover:scale-105 active:scale-95"
              :class="selected.genres.includes(g)
                ? 'bg-primary-rose text-white border-primary-rose shadow-md shadow-primary-rose/25'
                : (isDark ? 'border-white/15 text-white/70 hover:border-white/30' : 'border-primary-dark/15 text-primary-dark/70 hover:border-primary-dark/30')">
              {{ g }}
            </button>
          </div>
        </div>

        <!-- Vibe -->
        <div class="mb-4">
          <label class="block text-[9px] font-grotesk font-semibold uppercase tracking-[0.3em] mb-2"
            :class="isDark ? 'text-white/50' : 'text-primary-dark/50'">Vibe</label>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="v in VIBES" :key="v"
              type="button"
              @click="toggle('vibes', v)"
              class="px-2.5 py-1 rounded-full text-[11px] font-grotesk border transition-all duration-150 ease-out-expo hover:scale-105 active:scale-95"
              :class="selected.vibes.includes(v)
                ? 'bg-primary-rose text-white border-primary-rose shadow-md shadow-primary-rose/25'
                : (isDark ? 'border-white/15 text-white/70 hover:border-white/30' : 'border-primary-dark/15 text-primary-dark/70 hover:border-primary-dark/30')">
              {{ v }}
            </button>
          </div>
        </div>

        <!-- Favorite artist -->
        <div class="mb-5">
          <label class="block text-[9px] font-grotesk font-semibold uppercase tracking-[0.3em] mb-2"
            :class="isDark ? 'text-white/50' : 'text-primary-dark/50'">Favorite Artists (optional)</label>
          <input v-model="selected.artists" type="text"
            placeholder="e.g. Nujabes, Thundercat"
            class="w-full px-3 py-2 rounded-lg text-[12px] font-grotesk outline-none transition-theme"
            :class="isDark
              ? 'bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-primary-rose/50'
              : 'bg-primary-dark/5 border border-primary-dark/10 text-primary-dark placeholder-primary-dark/30 focus:border-primary-rose/50'"/>
        </div>

        <!-- Actions -->
        <button type="button" @click="start"
          class="w-full py-3 rounded-full bg-primary-rose text-white text-[11px] font-grotesk font-semibold uppercase tracking-[0.3em] transition-all duration-200 ease-spring hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary-rose/25">
          Start Listening
        </button>
        <button type="button" @click="skip"
          class="w-full mt-2 py-2 text-[10px] font-grotesk uppercase tracking-[0.25em] transition-colors"
          :class="isDark ? 'text-white/40 hover:text-white/70' : 'text-primary-dark/40 hover:text-primary-dark/70'">
          Skip — surprise me →
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useTheme } from '../composables/useTheme.js'

defineProps({
  show: { type: Boolean, default: false }
})
const emit = defineEmits(['start'])
const { isDark } = useTheme()

const GENRES = ['Jazz', 'Lo-fi', 'Hip-Hop', 'R&B', 'Indie', 'Electronic', 'Ambient', 'Soul', 'Classical', 'Funk']
const VIBES = ['Chill', 'Focus', 'Nostalgic', 'Energetic', 'Late Night', 'Romantic']

const selected = reactive({
  genres: [],
  vibes: [],
  artists: ''
})

function toggle(field, value) {
  const arr = selected[field]
  const i = arr.indexOf(value)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(value)
}

function start() {
  emit('start', {
    genres: [...selected.genres],
    vibes: [...selected.vibes],
    artists: selected.artists.trim()
  })
}
function skip() {
  emit('start', { genres: [], vibes: [], artists: '' })
}
</script>

<style scoped>
.welcome-enter-active,
.welcome-leave-active {
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.welcome-enter-from,
.welcome-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
</style>
