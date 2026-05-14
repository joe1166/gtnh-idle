<template>
  <header class="top-bar">
    <div class="top-bar__left">
      <span class="game-title">GTNH IDLE</span>
    </div>

    <div class="top-bar__center">
      <!-- 蒸汽时代：显示蒸汽产耗 -->
      <template v-if="showSteam">
        <div class="resource-info">
          <span class="res-icon">♨</span>
          <span class="res-gen">+{{ fmt(steamStore.genPerSec) }}</span>
          <span class="res-sep">/</span>
          <span class="res-con">-{{ fmt(steamStore.consumePerSec) }}</span>
          <span class="res-unit">mb/s</span>
        </div>
        <div class="resource-bar-info">
          <div class="res-bar-wrap">
            <div class="res-bar-fill" :style="{ width: steamBarPct + '%' }"></div>
          </div>
          <span class="res-bar-text">
            {{ fmt(steamStore.consumePerSec) }} / {{ fmt(steamStore.genPerSec) }} mb/s
          </span>
        </div>
      </template>

      <!-- LV 及以上：显示电力 -->
      <template v-else-if="showPower">
        <div class="resource-info">
          <span class="res-icon">⚡</span>
          <span class="res-gen">+{{ fmt(powerStore.totalGenPerSec) }}</span>
          <span class="res-sep">/</span>
          <span class="res-con">-{{ fmt(powerStore.totalConsumePerSec) }}</span>
          <span class="res-unit">EU/s</span>
        </div>
        <div class="resource-bar-info">
          <div class="res-bar-wrap">
            <div
              class="res-bar-fill"
              :class="batteryColorClass"
              :style="{ width: powerStore.batteryPercent + '%' }"
            ></div>
          </div>
          <span class="res-bar-text" :class="batteryColorClass">
            {{ fmt(powerStore.batteryCurrentEU) }} / {{ fmt(powerStore.batteryCapacityEU) }} EU
            ({{ Math.round(powerStore.batteryPercent) }}%)
          </span>
        </div>
      </template>

      <!-- 蒸汽时代前：留空 -->
    </div>

    <div class="top-bar__right">
      <span class="chapter-name">{{ progressionStore.currentChapter?.locKey ? t(progressionStore.currentChapter.locKey) : '—' }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePowerStore } from '../../stores/powerStore'
import { useSteamStore } from '../../stores/steamStore'
import { useProgressionStore } from '../../stores/progressionStore'
import { t } from '../../data/i18n'
import { fmt } from '../../utils/format'

const powerStore = usePowerStore()
const steamStore = useSteamStore()
const progressionStore = useProgressionStore()

const showPower = computed(() => progressionStore.era === 'lv')
const showSteam = computed(() => progressionStore.era === 'steam')

const batteryColorClass = computed(() => {
  const pct = powerStore.batteryPercent
  if (pct >= 60) return 'color-green'
  if (pct >= 25) return 'color-yellow'
  return 'color-red'
})

// 蒸汽消耗/产出比（用于进度条），产出为0时显示0%
const steamBarPct = computed(() => {
  const gen = steamStore.genPerSec
  if (gen <= 0) return 0
  return Math.min(100, (steamStore.consumePerSec / gen) * 100)
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
  border-bottom: 1px solid var(--border);
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
  color: var(--accent);
  letter-spacing: 2px;
}

.top-bar__center {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.resource-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-primary);
}

.res-icon { font-size: 15px; }
.res-gen  { color: var(--accent); font-weight: bold; }
.res-sep  { color: var(--border); }
.res-con  { color: var(--danger); font-weight: bold; }
.res-unit { color: var(--text-muted); margin-left: 2px; }

.resource-bar-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.res-bar-wrap {
  width: 80px;
  height: 8px;
  background: #333;
  border: 1px solid var(--border);
  overflow: hidden;
}

.res-bar-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.res-bar-text {
  font-size: 11px;
  white-space: nowrap;
  color: var(--text-secondary);
}

/* 电力面板进度条颜色跟随电量 */
.color-green { background-color: var(--accent); color: var(--accent); }
.color-yellow { background-color: var(--warn); color: var(--warn); }
.color-red { background-color: var(--danger); color: var(--danger); }
.res-bar-text.color-green  { background-color: transparent; }
.res-bar-text.color-yellow { background-color: transparent; }
.res-bar-text.color-red    { background-color: transparent; }

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

.save-btn {
  background: #333;
  border: 1px solid var(--border);
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
  border-color: var(--accent);
}

.save-btn:active {
  background: #555;
}
</style>
