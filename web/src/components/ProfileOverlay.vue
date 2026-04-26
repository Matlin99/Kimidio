<template>
  <Transition name="fade">
    <div v-if="settings.isProfileOpen" class="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-400 ease-out-expo" @click="settings.toggleProfile"></div>
      <div class="relative w-[440px] max-h-[500px] rounded-card overflow-hidden flex flex-col shadow-2xl transition-transform duration-400 ease-out-expo"
        :class="isDark ? 'bg-primary-dark border border-white/10' : 'bg-white border border-primary-dark/10'">
        
        <div class="px-5 py-4 border-b flex items-center justify-between"
          :class="isDark ? 'border-white/10' : 'border-primary-dark/10'">
          <p class="text-subtitle font-medium transition-theme" :class="isDark ? 'text-primary-cream' : 'text-primary-dark'">
            Profile & Taste
          </p>
          <button @click="settings.toggleProfile" class="w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200 ease-out-expo"
            :class="isDark ? 'hover:bg-white/10 text-primary-cream/60' : 'hover:bg-primary-dark/10 text-primary-dark/60'">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 2l10 10M12 2L2 12"/>
            </svg>
          </button>
        </div>
        
        <div class="p-5 space-y-4 overflow-y-auto">
          <div v-for="file in tasteFiles" :key="file.name">
            <label class="text-label uppercase tracking-wider mb-2 block transition-theme"
              :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">
              {{ file.label }}
            </label>
            <textarea v-model="file.content" rows="4"
              class="w-full px-3 py-2 rounded-lg text-body outline-none resize-none transition-theme"
              :class="isDark ? 'bg-white/5 text-primary-cream border border-white/10 focus:border-primary-rose/50' : 'bg-primary-dark/5 text-primary-dark border border-primary-dark/10 focus:border-primary-rose/50'"></textarea>
          </div>
        </div>
        
        <div class="p-4 border-t" :class="isDark ? 'border-white/10' : 'border-primary-dark/10'">
          <button @click="saveProfile"
            class="w-full py-2.5 rounded-lg bg-primary-rose text-white text-body font-medium hover:bg-primary-rose/80 transition-all duration-200 ease-out-expo hover:scale-[1.02] active:scale-[0.98]">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { useSettingsStore } from '../stores/settings.js'

const { isDark } = useTheme()
const settings = useSettingsStore()

const tasteFiles = ref([
  { name: 'taste.md', label: 'Music Taste', content: 'I love jazz-infused hip-hop, lo-fi beats, and soulful samples. Nujabes is my all-time favorite. I enjoy music that creates a cozy, introspective atmosphere.' },
  { name: 'routines.md', label: 'Daily Routines', content: 'Morning: Chill beats for focus\nAfternoon: Jazz hop for creativity\nEvening: Mellow tracks for winding down\nLate night: Ambient lo-fi for sleep' },
])

const saveProfile = () => {
  settings.toggleProfile()
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
