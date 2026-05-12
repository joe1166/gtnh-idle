<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay">
      <div class="modal-box">
        <div class="modal-title">⚠ {{ t('save.incompatible.title') }}</div>
        <p class="modal-desc">{{ t('save.incompatible.desc') }}</p>
        <button class="new-game-btn" @click="handleNewGame">
          {{ t('save.incompatible.new_game') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useNewGame } from '../../composables/useNewGame'
import { t } from '../../data/i18n'

defineProps<{ show: boolean }>()

const { startNewGame } = useNewGame()

function handleNewGame() {
  startNewGame()
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-box {
  background: var(--bg-panel);
  border: 1px solid var(--danger-border);
  padding: 32px 28px;
  max-width: 420px;
  width: 90%;
  font-family: 'Consolas', 'Courier New', monospace;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-title {
  font-size: 16px;
  font-weight: bold;
  color: var(--warn);
}

.modal-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.new-game-btn {
  align-self: flex-start;
  padding: 6px 16px;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid var(--accent);
  background: var(--accent-bg);
  color: var(--accent);
  transition: background 0.12s;
}
.new-game-btn:hover {
  background: var(--accent-bg-hover);
}
</style>
