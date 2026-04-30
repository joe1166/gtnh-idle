<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-box">
        <!-- Header -->
        <div class="modal-header">
          <span class="header-icon">🌙</span>
          <span class="header-title">{{ t('offline.title') }}</span>
        </div>

        <div class="offline-time">
          {{ t('offline.time_prefix') }}<strong>{{ fmtTime(report.offlineSeconds) }}</strong>
          <span v-if="report.simulatedSeconds < report.offlineSeconds" class="sim-cap-hint">
            {{ simCapHint }}
          </span>
        </div>

        <!-- 模拟进度条（模拟中显示） -->
        <div v-if="gameStore.isSimulatingOffline" class="sim-progress-section">
          <div class="sim-label">{{ t('offline.sim_progress_label') }}</div>
          <div class="sim-bar-wrap">
            <div
              class="sim-bar-fill"
              :style="{ width: gameStore.offlineSimProgress + '%' }"
            ></div>
          </div>
          <span class="sim-pct">{{ Math.round(gameStore.offlineSimProgress) }}%</span>
        </div>

        <!-- 生产汇报 -->
        <div v-if="!gameStore.isSimulatingOffline && hasProduction" class="produced-section">
          <div class="section-title">{{ t('offline.produced_label') }}</div>
          <div class="produced-list">
            <div
              v-for="(amount, resourceId) in report.gained"
              :key="resourceId"
              class="produced-row"
            >
              <span class="produced-plus">+</span>
              <span class="produced-name">{{ getResourceName(resourceId as string) }}</span>
              <span class="produced-amount">× {{ fmt(amount) }}</span>
            </div>
          </div>
        </div>

        <!-- 事件列表 -->
        <div v-if="!gameStore.isSimulatingOffline && report.events && report.events.length > 0" class="events-section">
          <div
            v-for="(event, idx) in report.events"
            :key="idx"
            class="event-row"
          >
            <span class="event-icon">⚠</span>
            <span class="event-text">{{ event }}</span>
          </div>
        </div>

        <!-- 关闭按钮 -->
        <div class="modal-footer">
          <button
            class="close-btn"
            :disabled="gameStore.isSimulatingOffline"
            @click="emit('close')"
          >
            {{ gameStore.isSimulatingOffline ? t('offline.btn_simulating') : t('offline.btn_close') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../../stores/gameStore'
import { db } from '../../data/db'
import { fmt, fmtTime } from '../../utils/format'
import { t } from '../../data/i18n'
import type { OfflineReport } from '../../composables/useOfflineProgress'

export type { OfflineReport }

const props = defineProps<{
  show: boolean
  report: OfflineReport
}>()

const emit = defineEmits<{
  close: []
}>()

const gameStore = useGameStore()

const hasProduction = computed(() =>
  props.report.gained &&
  Object.values(props.report.gained).some((v) => v > 0)
)

const simCapHint = computed(() =>
  t('offline.sim_cap').replace('{time}', fmtTime(props.report.simulatedSeconds))
)

function getResourceName(resourceId: string): string {
  return db.name('resources', resourceId)
}
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
  padding: 24px 28px;
  min-width: 360px;
  max-width: 480px;
  width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  color: var(--text-primary);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.header-icon {
  font-size: 22px;
}

.header-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--accent-green);
}

.offline-time {
  font-size: 13px;
  color: #aaa;
  margin-bottom: 16px;
}

.offline-time strong {
  color: var(--accent-yellow);
}

.sim-cap-hint {
  color: #888;
  font-size: 12px;
  margin-left: 4px;
}

/* Simulation progress */
.sim-progress-section {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  background: #222;
  border: 1px solid var(--border-color);
  padding: 10px 12px;
}

.sim-label {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}

.sim-bar-wrap {
  flex: 1 1 auto;
  height: 8px;
  background: #333;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.sim-bar-fill {
  height: 100%;
  background: var(--accent-green);
  transition: width 0.3s linear;
}

.sim-pct {
  font-size: 11px;
  color: var(--accent-green);
  white-space: nowrap;
  min-width: 36px;
  text-align: right;
}

/* Produced section */
.produced-section {
  margin-bottom: 14px;
}

.section-title {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}

.produced-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.produced-row {
  display: grid;
  grid-template-columns: 16px 1fr auto;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.produced-plus {
  color: var(--accent-green);
  font-weight: bold;
}

.produced-name {
  color: var(--text-primary);
}

.produced-amount {
  color: var(--accent-yellow);
  font-size: 12px;
  white-space: nowrap;
}

/* Events section */
.events-section {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 5px 8px;
  background: rgba(244, 67, 54, 0.08);
  border: 1px solid rgba(244, 67, 54, 0.25);
}

.event-icon {
  color: var(--accent-yellow);
  flex-shrink: 0;
}

.event-text {
  color: #ccc;
}

/* Footer */
.modal-footer {
  margin-top: 18px;
  text-align: center;
}

.close-btn {
  background: var(--accent-green);
  border: none;
  color: #111;
  padding: 8px 28px;
  font-family: inherit;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.15s;
}

.close-btn:hover:not(:disabled) {
  background: #5dcf61;
}

.close-btn:disabled {
  background: #333;
  color: #555;
  cursor: not-allowed;
}
</style>
