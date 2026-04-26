import { ref, computed } from 'vue'

// Single source of truth for time-of-day blocks. Used by the TopPanel badge,
// the schedule panel, and the curate context override. If you change the
// labels or boundaries, update server/context.js to match.
const BLOCKS = [
  { id: 'late-night',    label: 'Late night',    startHour: 23, endHour: 5,  mood: 'quiet, low' },
  { id: 'early-morning', label: 'Early morning', startHour: 5,  endHour: 9,  mood: 'gentle wake' },
  { id: 'morning',       label: 'Morning focus', startHour: 9,  endHour: 12, mood: 'focus, momentum' },
  { id: 'midday',        label: 'Lunch',         startHour: 12, endHour: 14, mood: 'easy reset' },
  { id: 'afternoon',     label: 'Afternoon',     startHour: 14, endHour: 17, mood: 'steady rhythm' },
  { id: 'early-evening', label: 'Wind down',     startHour: 17, endHour: 20, mood: 'soft transition' },
  { id: 'evening',       label: 'Evening',       startHour: 20, endHour: 23, mood: 'tonight feel' }
]

export function blockForHour(h) {
  if (h < 5)  return 'late-night'
  if (h < 9)  return 'early-morning'
  if (h < 12) return 'morning'
  if (h < 14) return 'midday'
  if (h < 17) return 'afternoon'
  if (h < 20) return 'early-evening'
  if (h < 23) return 'evening'
  return 'late-night'
}

// Module-level shared clock — one interval for every consumer. Started lazily
// on first use, never stopped (cheap, lives for the session).
const now = ref(new Date())
let started = false
function startTickingOnce() {
  if (started) return
  started = true
  setInterval(() => { now.value = new Date() }, 30_000)
}

const currentBlockId = computed(() => blockForHour(now.value.getHours()))
const currentBlock   = computed(() => BLOCKS.find(b => b.id === currentBlockId.value))

export function useTimeBlock() {
  startTickingOnce()
  return { now, blocks: BLOCKS, currentBlockId, currentBlock, blockForHour }
}
