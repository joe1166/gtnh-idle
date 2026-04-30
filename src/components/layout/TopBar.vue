<template>
  <header class="top-bar">
    <div class="top-bar__left">
      <span class="game-title">GTNH IDLE</span>
    </div>

    <div class="top-bar__center">
      <div class="power-info">
        <span class="power-icon">⚡</span>
        <span class="eu-gen">+{{ fmt(powerStore.totalGenPerSec) }}</span>
        <span class="eu-sep">/</span>
        <span class="eu-con">-{{ fmt(powerStore.totalConsumePerSec) }}</span>
        <span class="eu-unit">EU/s</span>
      </div>

      <div class="battery-info">
        <span class="battery-icon">🔋</span>
        <div class="battery-bar-wrap">
          <div
            class="battery-bar-fill"
            :class="batteryColorClass"
            :style="{ width: powerStore.batteryPercent + '%' }"
          ></div>
        </div>
        <span class="battery-text" :class="batteryColorClass">
          {{ fmt(powerStore.batteryCurrentEU) }} / {{ fmt(powerStore.batteryCapacityEU) }} EU
          ({{ Math.round(powerStore.batteryPercent) }}%)
        </span>
      </div>
    </div>

    <div class="top-bar__right">
      <span class="chapter-name">{{ progressionStore.currentChapter?.locKey ? t(progressionStore.currentChapter.locKey) : '—' }}</span>
      <button class="dev-btn" @click="toggleDevConsole" title="开发者后台">
        &#9881;
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePowerStore } from '../../stores/powerStore'
import { useProgressionStore } from '../../stores/progressionStore'
import { useDevConsole } from '../../composables/useDevConsole'
import { t } from '../../data/i18n'
import { fmt } from '../../utils/format'

const powerStore = usePowerStore()
const progressionStore = useProgressionStore()
const { toggle } = useDevConsole()
function toggleDevConsole() { toggle() }

const batteryColorClass = computed(() => {
  const pct = powerStore.batteryPercent
  if (pct >= 60) return 'color-green'
  if (pct >= 25) return 'color-yellow'
  return 'color-red'
})
</script>

<style scoped>
.top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 100;
  font-family: 'Consolas', 'Courier New', monospace;
}

.top-bar__left {
  flex: 0 0 auto;
}

.game-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--accent-green);
  letter-spacing: 2px;
}

.top-bar__center {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.power-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-primary);
}

.power-icon {
  font-size: 15px;
}

.eu-gen {
  color: var(--accent-green);
  font-weight: bold;
}

.eu-sep {
  color: var(--border-color);
}

.eu-con {
  color: var(--accent-red);
  font-weight: bold;
}

.eu-unit {
  color: #888;
  margin-left: 2px;
}

.battery-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.battery-icon {
  font-size: 14px;
}

.battery-bar-wrap {
  width: 80px;
  height: 8px;
  background: #333;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.battery-bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.battery-text {
  font-size: 11px;
  white-space: nowrap;
}

.color-green { background-color: var(--accent-green); color: var(--accent-green); }
.color-yellow { background-color: var(--accent-yellow); color: var(--accent-yellow); }
.color-red { background-color: var(--accent-red); color: var(--accent-red); }

.battery-text.color-green { background-color: transparent; }
.battery-text.color-yellow { background-color: transparent; }
.battery-text.color-red { background-color: transparent; }

.top-bar__right {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.chapter-name {
  font-size: 12px;
  color: #aaa;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dev-btn {
  background: none;
  border: 1px solid #333;
  color: #555;
  width: 26px;
  height: 26px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.dev-btn:hover {
  color: #4a9eff;
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.08);
}
.dev-btn:active {
  background: rgba(74, 158, 255, 0.15);
}

.save-btn {
  background: #333;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 4px 10px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.15s;
}

.save-btn:hover {
  background: #444;
  border-color: var(--accent-green);
}

.save-btn:active {
  background: #555;
}
</style>
