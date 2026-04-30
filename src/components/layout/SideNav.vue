<template>
  <nav class="side-nav">
    <ul class="nav-list">
      <li
        v-for="item in navItems"
        :key="item.id"
        class="nav-item"
        :class="{ 'nav-item--active': modelValue === item.id }"
        @click="emit('update:modelValue', item.id)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span class="nav-label">{{ t(item.labelKey) }}</span>
      </li>
    </ul>

    <div class="nav-footer">
      <div class="playtime-row">
        <span class="playtime-label">{{ t('nav.playtime') }}</span>
        <span class="playtime-value">{{ gameStore.formattedPlaytime }}</span>
      </div>
      <div class="footer-btns">
        <button class="footer-btn" @click="emit('open-stats')">
          {{ t('nav.stats_btn') }}
        </button>
        <button class="footer-btn" @click="emit('open-settings')">
          {{ t('nav.settings_btn') }}
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../../stores/gameStore'
import { t } from '../../data/i18n'
import { PANEL_DEFS, evaluateCondition, type PanelDef } from '../../data/panelConfig'

const gameStore = useGameStore()

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'open-stats': []
  'open-settings': []
}>()

/**
 * 判断面板是否可见：
 *   1. hideCond 满足 → 强制隐藏（优先，panel 类型需两轮计算）
 *   2. showCond 不满足 → 隐藏（通用 evaluateCondition）
 *   3. 其余情况 → 显示
 *
 * panel 类型条件需要已知当前可见列表，故传入 visibleIds（仅 hideCond 使用）。
 */
function isVisible(def: PanelDef, visibleIds: Set<string>): boolean {
  if (def.hideCond) {
    if (def.hideCond.type === 'panel') {
      // panel 类型需两轮计算，这里只在第二轮被调用，visibleIds 已包含第一轮结果
      if (visibleIds.has(def.hideCond.para)) return false
    }
  }
  if (def.showCond && !evaluateCondition(def.showCond)) return false
  return true
}

/**
 * 计算可见面板列表。
 * panel 类型条件会引入循环依赖，采用两轮计算：
 *   第一轮：计算所有不含 panel 条件的面板可见性
 *   第二轮：再计算含 panel 条件的面板（以第一轮结果为依据）
 */
const navItems = computed(() => {
  const sorted = [...PANEL_DEFS].sort((a, b) => a.order - b.order)

  // 第一轮：不含 hideCond.panel 的面板（hideCond.panel 需两轮计算）
  const firstPass = new Set(
    sorted
      .filter(p => p.hideCond?.type !== 'panel')
      .filter(p => isVisible(p, new Set()))
      .map(p => p.id)
  )

  // 第二轮：含 hideCond.panel 的面板，用第一轮结果作为 visibleIds
  const result = sorted.filter(p => isVisible(p, firstPass))

  return result
})
</script>

<style scoped>
.side-nav {
  width: 140px;
  min-width: 140px;
  background: var(--bg-panel);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: 'Consolas', 'Courier New', monospace;
}

.nav-list {
  list-style: none;
  margin: 0;
  padding: 8px 0;
  flex: 1 1 auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  cursor: pointer;
  color: #aaa;
  font-size: 13px;
  border-left: 3px solid transparent;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  user-select: none;
}

.nav-item:hover {
  background: #333;
  color: var(--text-primary);
}

.nav-item--active {
  background: #333;
  color: var(--accent-green);
  border-left-color: var(--accent-green);
}

.nav-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.nav-label {
  font-size: 13px;
}

/* ── Footer ── */
.nav-footer {
  padding: 10px 12px 12px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.playtime-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.playtime-label {
  font-size: 10px;
  color: #555;
}

.playtime-value {
  font-size: 12px;
  color: #888;
  font-family: 'Consolas', 'Courier New', monospace;
  letter-spacing: 1px;
}

.footer-btns {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.footer-btn {
  width: 100%;
  background: #222;
  border: 1px solid var(--border-color);
  color: #888;
  padding: 4px 0;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.footer-btn:hover {
  background: #333;
  color: var(--text-primary);
  border-color: #555;
}
</style>
