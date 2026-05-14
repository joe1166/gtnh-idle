import { ref } from 'vue'
import { runCommand } from './debugCommands'

const isOpen            = ref(false)
const highlightHitAreas = ref(false)
const mineReveal        = ref(false)

function toggle() { isOpen.value = !isOpen.value }

export function useDevConsole() {
  return {
    isOpen,
    highlightHitAreas,
    mineReveal,
    toggle,
    runCommand,
  }
}
