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
      <div class="playtime-label">{{ t('nav.playtime') }}</div>
      <div class="playtime-value">{{ gameStore.formattedPlaytime }}</div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../../stores/gameStore'
import { useTechStore } from '../../stores/techStore'
import { t } from '../../data/i18n'
import { PANEL_DEFS } from '../../data/panelConfig'

const gameStore = useGameStore()
const techStore = useTechStore()

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function isVisible(condition: typeof PANEL_DEFS[number]['condition']): boolean {
  if (!condition) return true
  if (condition.type === 'tech') return techStore.isResearched(condition.para)
  return true
}

const navItems = computed(() =>
  PANEL_DEFS
    .filter(p => isVisible(p.condition))
    .sort((a, b) => a.order - b.order)
)
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

.nav-footer {
  padding: 12px 14px;
  border-top: 1px solid var(--border-color);
  font-size: 11px;
}

.playtime-label {
  color: #666;
  margin-bottom: 2px;
}

.playtime-value {
  color: #888;
  font-family: 'Consolas', 'Courier New', monospace;
  letter-spacing: 1px;
}
</style>
