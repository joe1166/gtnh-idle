<template>
  <Teleport to="body">
    <div v-if="isOpen" class="dev-console">
      <div class="dev-header">
        <span class="dev-title">&#9881; Dev Console</span>
        <button class="dev-close" @click="close()">&#x2715;</button>
      </div>

      <div class="dev-body">
        <label class="dev-row">
          <input type="checkbox" v-model="highlightHitAreas" />
          <span>高亮热区轮廓</span>
        </label>
        <label class="dev-row">
          <input type="checkbox" v-model="mineReveal" />
          <span>矿透</span>
        </label>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useDevConsole } from '../../composables/useDevConsole'

const { isOpen, highlightHitAreas, mineReveal } = useDevConsole()

// 关闭按钮：在 script 中真实使用 isOpen，IDE 就不会报 "unused"
function close() { isOpen.value = false }
</script>

<style scoped>
.dev-console {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 9999;
  background: rgba(8, 8, 8, 0.96);
  border: 1px solid #4a9eff;
  border-radius: 6px;
  width: 220px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  color: #ccc;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7), 0 0 0 1px var(--info-soft);
  overflow: hidden;
}

.dev-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  background: var(--info-subtle);
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  cursor: move;
  user-select: none;
}

.dev-title {
  color: #4a9eff;
  font-weight: bold;
  letter-spacing: 0.5px;
}

.dev-close {
  background: none;
  border: none;
  color: #555;
  cursor: pointer;
  font-size: 11px;
  padding: 0;
  line-height: 1;
}
.dev-close:hover { color: #ccc; }

.dev-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dev-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #ccc;
  user-select: none;
}
.dev-row input[type="checkbox"] {
  accent-color: #4a9eff;
  cursor: pointer;
  width: 13px;
  height: 13px;
}
.dev-row:hover span { color: #fff; }
</style>
