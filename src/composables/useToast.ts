import { reactive } from 'vue'

export interface Toast {
  id: number
  message: string
  color: string
}

const toasts = reactive<Toast[]>([])
let nextId = 0

export function useToast() {
  function show(message: string, color = 'var(--accent)') {
    const id = nextId++
    toasts.push({ id, message, color })
    setTimeout(() => {
      const idx = toasts.findIndex((t) => t.id === id)
      if (idx !== -1) toasts.splice(idx, 1)
    }, 1800)
  }

  return { toasts, show }
}
