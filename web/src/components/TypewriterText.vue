<template>
  <span>{{ displayedText }}</span>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  text: { type: String, required: true },
  speed: { type: Number, default: 12 }
})
const emit = defineEmits(['done'])

const displayedText = ref('')
let interval = null

const startTyping = () => {
  displayedText.value = ''
  let i = 0
  if (interval) clearInterval(interval)
  interval = setInterval(() => {
    if (i < props.text.length) {
      displayedText.value += props.text.charAt(i)
      i++
    } else {
      clearInterval(interval)
      emit('done')
    }
  }, props.speed)
}

watch(() => props.text, startTyping, { immediate: true })

onMounted(startTyping)
</script>
