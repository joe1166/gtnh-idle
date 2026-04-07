<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast-item"
        :style="{ borderColor: toast.color, color: toast.color }"
      >
        {{ toast.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast'
const { toasts } = useToast()
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}

.toast-item {
  background: #1e2a1e;
  border: 1px solid;
  padding: 6px 18px;
  font-family: 'Consolas', monospace;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5);
}

/* TransitionGroup animations */
.toast-enter-active {
  transition: all 0.2s ease-out;
}
.toast-leave-active {
  transition: all 0.4s ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-12px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
