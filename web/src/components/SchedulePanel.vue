<template>
  <Transition name="schedule">
    <div v-if="schedule.isOpen" class="schedule-root fixed inset-0 z-40 flex justify-end">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="schedule.close"></div>

      <!-- Sliding panel -->
      <div class="schedule-panel relative w-[420px] max-w-[92vw] h-full overflow-y-auto shadow-2xl"
        :class="isDark ? 'bg-primary-dark border-l border-white/10' : 'bg-white border-l border-primary-dark/10'">

        <!-- Header -->
        <div class="sticky top-0 z-10 px-5 py-4 backdrop-blur-md flex items-center justify-between border-b transition-theme"
          :class="isDark ? 'bg-primary-dark/85 border-white/10' : 'bg-white/85 border-primary-dark/10'">
          <div class="min-w-0 mr-3">
            <p class="text-[9px] uppercase tracking-[0.3em] text-primary-rose font-grotesk">Today's Schedule</p>
            <p class="text-[14px] mt-1 font-grotesk transition-theme"
              :class="isDark ? 'text-primary-cream' : 'text-primary-dark'">
              {{ todayLabel }}
            </p>
            <p v-if="schedule.dayNarrative"
              class="text-[11px] mt-1.5 italic font-artistic leading-relaxed transition-theme"
              :class="isDark ? 'text-primary-cream/55' : 'text-primary-dark/55'">
              {{ schedule.dayNarrative }}
            </p>
          </div>
          <button @click="schedule.close"
            class="w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 ease-out-expo"
            :class="isDark ? 'hover:bg-white/10 text-primary-cream/70' : 'hover:bg-primary-dark/10 text-primary-dark/70'">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 2l10 10M12 2L2 12"/>
            </svg>
          </button>
        </div>

        <!-- Block cards -->
        <div class="p-4 space-y-2.5">
          <div v-for="block in schedule.blocks" :key="block.id"
            @click="schedule.expand(block.id)"
            class="rounded-xl p-4 cursor-pointer transition-all duration-300 ease-out-expo border"
            :class="cardClasses(block)">

            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <!-- Indicator stack: 'now' (filled pulse), 'playing' (ring), or both -->
                <div class="flex flex-col items-center justify-center gap-1 flex-shrink-0 w-3">
                  <span v-if="isNow(block)"
                    class="w-1.5 h-1.5 rounded-full bg-primary-rose animate-block-pulse"
                    :title="'Current time block'"></span>
                  <span v-if="isPlaying(block) && !isNow(block)"
                    class="w-2 h-2 rounded-full border-[1.5px] border-primary-rose"
                    :title="'Now playing this set'"></span>
                </div>
                <div class="min-w-0">
                  <p class="text-[9px] uppercase tracking-[0.25em] font-grotesk"
                    :class="isNow(block)
                      ? 'text-primary-rose'
                      : (isDark ? 'text-primary-cream/40' : 'text-primary-dark/40')">
                    {{ formatRange(block) }}
                    <span v-if="isPlaying(block)" class="ml-1 text-primary-rose normal-case tracking-normal">· playing</span>
                  </p>
                  <p class="text-[15px] mt-0.5 font-grotesk transition-theme"
                    :class="isDark ? 'text-primary-cream' : 'text-primary-dark'">
                    {{ block.label }}
                  </p>
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <p v-if="schedule.curatingBlock === block.id" class="text-[10px] text-primary-rose">
                  curating…
                </p>
                <p v-else-if="schedule.errorByBlock[block.id]" class="text-[10px] text-red-400/80">
                  failed
                </p>
                <p v-else-if="schedule.tracksByBlock[block.id]?.length" class="text-[10px] font-grotesk"
                  :class="isDark ? 'text-primary-cream/50' : 'text-primary-dark/50'">
                  {{ schedule.tracksByBlock[block.id].length }} ready
                </p>
                <p v-else class="text-[10px] italic font-grotesk"
                  :class="isDark ? 'text-primary-cream/30' : 'text-primary-dark/30'">
                  tap to preview
                </p>
              </div>
            </div>

            <!-- Calendar events placeholder — Phase C populates eventsByBlock.
                 Empty for now, but the slot is here so adding events later
                 doesn't require touching the panel layout. -->
            <div v-if="schedule.eventsByBlock[block.id]?.length"
              class="mt-2 flex flex-wrap gap-1.5">
              <span v-for="ev in schedule.eventsByBlock[block.id]" :key="ev.id"
                :title="formatEventTime(ev)"
                class="text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full font-grotesk inline-flex items-center gap-1.5"
                :class="isDark ? 'bg-white/5 text-primary-cream/70 border border-white/10' : 'bg-primary-dark/5 text-primary-dark/70 border border-primary-dark/10'">
                <span class="text-primary-rose/70 normal-case tracking-normal text-[9px] font-mono">
                  {{ formatEventStart(ev) }}
                </span>
                <span class="truncate max-w-[180px]">{{ ev.label || 'event' }}</span>
              </span>
            </div>

            <!-- Expanded preview -->
            <div v-if="schedule.expandedBlock === block.id"
              class="mt-3 pt-3 border-t space-y-1.5 transition-theme"
              :class="isDark ? 'border-white/5' : 'border-primary-dark/5'">

              <!-- DJ intro for this block (populated by full-day batch curate) -->
              <p v-if="schedule.introsByBlock[block.id]"
                class="text-[11px] italic font-artistic leading-relaxed pb-1 transition-theme"
                :class="isDark ? 'text-primary-rose/75' : 'text-primary-rose'">
                "{{ schedule.introsByBlock[block.id] }}"
              </p>

              <!-- Loading hint while no tracks yet -->
              <div v-if="schedule.curatingBlock === block.id && !schedule.tracksByBlock[block.id]?.length"
                class="text-[11px] italic py-2 font-artistic"
                :class="isDark ? 'text-primary-cream/40' : 'text-primary-dark/40'">
                Pulling tracks for {{ block.label.toLowerCase() }}…
              </div>

              <!-- Failure state with retry -->
              <div v-else-if="schedule.errorByBlock[block.id] && !schedule.tracksByBlock[block.id]?.length"
                class="py-2">
                <p class="text-[11px] italic font-artistic mb-2"
                  :class="isDark ? 'text-red-300/70' : 'text-red-500/70'">
                  Couldn't pull tracks — {{ schedule.errorByBlock[block.id] }}
                </p>
                <button @click.stop="schedule.retryBlock(block.id)"
                  class="text-[10px] uppercase tracking-[0.25em] font-grotesk px-3 py-1.5 rounded-lg transition-all duration-200 ease-spring hover:scale-[1.03]"
                  :class="isDark ? 'bg-primary-rose/20 hover:bg-primary-rose/30 text-primary-rose' : 'bg-primary-rose/10 hover:bg-primary-rose/20 text-primary-rose'">
                  ↻ Retry
                </button>
              </div>

              <!-- Track list -->
              <template v-else>
                <div v-for="(track, ti) in (schedule.tracksByBlock[block.id] || []).slice(0, 5)" :key="track.id"
                  class="flex items-center gap-2.5 py-1">
                  <span class="w-4 text-right font-mono text-[10px] opacity-40">{{ ti + 1 }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-[12px] truncate font-grotesk transition-theme"
                      :class="isDark ? 'text-primary-cream/85' : 'text-primary-dark/85'">
                      {{ track.title }}
                    </p>
                    <p class="text-[10px] truncate font-grotesk transition-theme"
                      :class="isDark ? 'text-primary-cream/40' : 'text-primary-dark/40'">
                      {{ track.artist }}
                    </p>
                  </div>
                </div>

                <button v-if="schedule.tracksByBlock[block.id]?.length"
                  @click.stop="onSwitch(block.id)"
                  :disabled="isPlaying(block)"
                  class="mt-2 w-full py-2 text-[10px] uppercase tracking-[0.25em] font-grotesk rounded-lg transition-all duration-200 ease-spring hover:scale-[1.02] active:scale-[0.99] disabled:opacity-40 disabled:cursor-default disabled:hover:scale-100"
                  :class="isDark ? 'bg-primary-rose/20 hover:bg-primary-rose/30 text-primary-rose' : 'bg-primary-rose/10 hover:bg-primary-rose/20 text-primary-rose'">
                  {{ isPlaying(block) ? '✓ Currently loaded' : 'Switch to this set →' }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { useScheduleStore } from '../stores/schedule.js'

const { isDark } = useTheme()
const schedule = useScheduleStore()

const todayLabel = computed(() => {
  const d = new Date()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return `${days[d.getDay()]} · ${months[d.getMonth()]} ${d.getDate()}`
})

function formatRange(block) {
  const fmt = (h) => `${String(h).padStart(2, '0')}:00`
  if (block.endHour > block.startHour) {
    return `${fmt(block.startHour)} – ${fmt(block.endHour)}`
  }
  return `${fmt(block.startHour)} – ${fmt(block.endHour)}+`
}

const isNow     = (block) => block.id === schedule.currentBlockId
const isPlaying = (block) => block.id === schedule.activeBlockId

// Card visual: emphasize the playing block (rose ring) over the now block
// (subtle highlight). When they're the same, only one set of styles applies.
function cardClasses(block) {
  if (isPlaying(block)) {
    return isDark
      ? 'border-primary-rose/60 bg-primary-rose/15 ring-1 ring-primary-rose/30'
      : 'border-primary-rose/50 bg-primary-rose/10 ring-1 ring-primary-rose/30'
  }
  if (isNow(block)) {
    return isDark
      ? 'border-primary-rose/30 bg-primary-rose/[0.06]'
      : 'border-primary-rose/25 bg-primary-rose/[0.04]'
  }
  return isDark
    ? 'border-white/5 bg-white/[0.02] hover:bg-white/5'
    : 'border-primary-dark/5 bg-primary-dark/[0.02] hover:bg-primary-dark/5'
}

function onSwitch(blockId) {
  if (schedule.switchToBlock(blockId)) {
    schedule.close()
  }
}

function formatEventStart(ev) {
  if (!ev.start) return ''
  const d = new Date(ev.start)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function formatEventTime(ev) {
  if (!ev.start) return ''
  const s = new Date(ev.start)
  const e = ev.end ? new Date(ev.end) : null
  const fmt = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return e ? `${fmt(s)} – ${fmt(e)}` : fmt(s)
}
</script>

<style scoped>
.schedule-enter-active,
.schedule-leave-active {
  transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.schedule-enter-from,
.schedule-leave-to {
  opacity: 0;
}

.schedule-enter-active .schedule-panel,
.schedule-leave-active .schedule-panel {
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.schedule-enter-from .schedule-panel,
.schedule-leave-to .schedule-panel {
  transform: translateX(100%);
}

@keyframes block-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(0.85); }
}
.animate-block-pulse {
  animation: block-pulse 1.6s ease-in-out infinite;
}
</style>
