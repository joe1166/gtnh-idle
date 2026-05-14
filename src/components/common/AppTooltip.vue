<template>
  <div
    v-if="visible && lines.length > 0"
    class="app-tooltip"
    :style="{ left: `${x}px`, top: `${y}px` }"
  >
    <div
      v-for="(line, i) in lines"
      :key="`${i}-${line}`"
      :class="{ 'app-tooltip-meta': i > 0 }"
    >
      {{ line }}
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  visible: boolean
  x: number
  y: number
  lines: string[]
}>(), {
  visible: false,
  x: 0,
  y: 0,
  lines: () => [],
})
</script>

<style scoped>
.app-tooltip {
  position: absolute;
  z-index: 2000;
  background: rgba(10, 10, 10, 0.92);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  padding: 6px 10px;
  color: #ddd;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.app-tooltip-meta {
  color: #999;
  font-size: 11px;
  margin-top: 3px;
}
</style>
