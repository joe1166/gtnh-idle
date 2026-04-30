<template>
  <div class="tool-grid-wrapper">
    <div class="tool-grid">
      <div
        v-for="toolType in toolTypes"
        :key="toolType"
        class="tool-slot"
      >
        <!-- 工具名 + 等级 -->
        <div class="slot-header">
          <span class="slot-name">{{ t(currentLevelDef(toolType)?.locKey ?? '') }}</span>
          <span class="slot-level">Lv.{{ toolStore.levels[toolType] }}</span>
        </div>

        <!-- 当前属性值 -->
        <div class="slot-ability">
          {{ abilityLabel(toolType) }}
        </div>

        <!-- 下一级信息 -->
        <template v-if="!toolStore.isMaxLevel(toolType)">
          <div class="slot-upgrade-label">{{ toolStore.levels[toolType] === 0 ? '制作材料' : t('btn.upgrade') }}</div>
          <div class="slot-cost">
            <span
              v-for="c in toolStore.getNextUpgradeCost(toolType)"
              :key="c.resourceId"
              class="cost-chip"
              :class="inventoryStore.getAmount(c.resourceId) >= c.amount ? 'cost-chip--ok' : 'cost-chip--lack'"
            >
              {{ db.name('resources', c.resourceId) }}×{{ c.amount }}
              <span class="cost-have">({{ inventoryStore.getAmount(c.resourceId) }})</span>
            </span>
          </div>
          <button
            class="upgrade-btn"
            :class="canUpgrade(toolType) ? 'upgrade-btn--ok' : 'upgrade-btn--lack'"
            :disabled="!canUpgrade(toolType)"
            @click="handleUpgrade(toolType)"
          >
            {{ toolStore.levels[toolType] === 0 ? t('btn.craft') : toolStore.isMaxLevel(toolType) ? t('btn.max_level') : t('btn.upgrade') }}
          </button>
        </template>

        <template v-else>
          <div class="slot-max">{{ t('btn.max_level') }}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useToolStore } from '../../stores/toolStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import { useToast } from '../../composables/useToast'
import type { ToolDef } from '../../data/types'

const toolStore = useToolStore()
const inventoryStore = useInventoryStore()
const { show } = useToast()

const toolTypes = computed(() => Object.keys(db.toolsByType()))

function currentLevelDef(toolType: string): ToolDef | null {
  return toolStore.getLevelDef(toolType)
}

function abilityLabel(toolType: string): string {
  const levelDef = toolStore.getLevelDef(toolType)
  if (!levelDef) return ''
  return `${t('attr.' + levelDef.abilityId)} ${levelDef.abilityValue}`
}

function canUpgrade(toolType: string): boolean {
  const cost = toolStore.getNextUpgradeCost(toolType)
  return inventoryStore.canAfford(cost)
}

function handleUpgrade(toolType: string) {
  const ok = toolStore.upgradeTool(toolType)
  if (ok) {
    const newLevelDef = toolStore.getLevelDef(toolType)
    show(`${t('toast.tool.upgraded')} ${t(newLevelDef?.locKey ?? '')}`, 'var(--accent-green)')
  } else {
    show(t('toast.craft.fail'), 'var(--accent-red)')
  }
}
</script>

<style scoped>
.tool-grid-wrapper {
  width: 100%;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 14px 20px 16px;
}

.tool-slot {
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid rgba(180, 180, 180, 0.2);
  border-radius: 4px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.slot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.slot-name {
  font-size: 13px;
  font-weight: bold;
  color: #ddd;
}

.slot-level {
  font-size: 11px;
  color: #888;
}

.slot-ability {
  font-size: 11px;
  color: var(--accent-green, #4caf50);
}

.slot-upgrade-label {
  font-size: 10px;
  color: #666;
  margin-top: 3px;
}

.slot-cost {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cost-chip {
  font-size: 10px;
  padding: 1px 5px;
  border: 1px solid;
  white-space: nowrap;
}

.cost-chip--ok   { color: var(--accent-green, #4caf50);  border-color: #2a4a2a; }
.cost-chip--lack { color: var(--accent-red, #f44336);    border-color: #4a2a2a; }

.cost-have {
  font-size: 9px;
  opacity: 0.6;
  margin-left: 1px;
}

.upgrade-btn {
  margin-top: 4px;
  padding: 4px 10px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid;
  transition: background 0.12s;
  align-self: flex-start;
}

.upgrade-btn--ok {
  background: #1e3a1e;
  border-color: var(--accent-green, #4caf50);
  color: var(--accent-green, #4caf50);
}

.upgrade-btn--ok:hover:not(:disabled) {
  background: #254a25;
}

.upgrade-btn--lack {
  background: #2a2020;
  border-color: #4a3030;
  color: #774444;
  cursor: not-allowed;
}

.slot-max {
  font-size: 11px;
  color: #555;
  margin-top: 4px;
}
</style>
