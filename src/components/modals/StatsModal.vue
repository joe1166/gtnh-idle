<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-box">
        <div class="modal-header">
          <span class="header-title">{{ t('stats.title') }}</span>
          <button class="close-x" @click="emit('close')">✕</button>
        </div>

        <div class="stats-grid">
          <div class="stat-row">
            <span class="stat-label">{{ t('stats.online_time') }}</span>
            <span class="stat-value accent-green">{{ fmtSec(onlineSec) }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">{{ t('stats.offline_time') }}</span>
            <span class="stat-value accent-yellow">{{ fmtSec(gameStore.totalOfflineSec) }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">{{ t('stats.total_time') }}</span>
            <span class="stat-value">{{ fmtSec(gameStore.totalPlaytimeSec) }}</span>
          </div>
          <div class="divider"></div>
          <div class="stat-row">
            <span class="stat-label">{{ t('stats.ticks') }}</span>
            <span class="stat-value">{{ gameStore.tickCount.toLocaleString() }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">{{ t('stats.started_at') }}</span>
            <span class="stat-value">{{ startedAtLabel }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">{{ t('stats.last_save') }}</span>
            <span class="stat-value">{{ lastSaveLabel }}</span>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-close" @click="emit('close')">{{ t('tech.detail.close') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../../stores/gameStore'
import { t } from '../../data/i18n'
import { fmtTime } from '../../utils/format'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()

const gameStore = useGameStore()

const onlineSec = computed(() =>
  Math.max(0, gameStore.totalPlaytimeSec - gameStore.totalOfflineSec)
)

function fmtSec(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

const startedAtLabel = computed(() => {
  const d = new Date(gameStore.gameStartedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
})

const lastSaveLabel = computed(() => {
  const sec = gameStore.secondsSinceLastSave
  if (sec < 5) return t('save.just_now')
  return `${fmtTime(sec)}${t('save.time_ago_suffix')}`
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  font-family: 'Consolas', 'Courier New', monospace;
}

.modal-box {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  padding: 20px 24px;
  min-width: 320px;
  max-width: 420px;
  width: 90vw;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title {
  font-size: 16px;
  font-weight: bold;
}

.close-x {
  background: none;
  border: none;
  color: #666;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  transition: color 0.15s;
}

.close-x:hover { color: var(--text-primary); }

.stats-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 0;
  border-bottom: 1px solid #1e1e1e;
  font-size: 12px;
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-label {
  color: #888;
}

.stat-value {
  color: var(--text-primary);
  font-family: 'Consolas', 'Courier New', monospace;
  letter-spacing: 0.5px;
}

.accent-green { color: var(--accent-green); }
.accent-yellow { color: var(--accent-yellow); }

.divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #2a2a2a;
  padding-top: 12px;
}

.btn-close {
  background: none;
  border: 1px solid var(--border-color);
  color: #888;
  padding: 6px 16px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.btn-close:hover {
  color: var(--text-primary);
  border-color: #666;
}
</style>
