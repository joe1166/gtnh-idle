import { ref } from 'vue'

const isOpen            = ref(false)
const highlightHitAreas = ref(false)

function toggle() { isOpen.value = !isOpen.value }

export function useDevConsole() {
  return { isOpen, highlightHitAreas, toggle }
}
