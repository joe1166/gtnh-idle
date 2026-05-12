<template>
  <div class="tool-panel-wrapper">
    <div class="tool-scroll-inner">
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
import { checkCondition } from '../../data/conditions'
import type { ToolDef } from '../../data/types'

const toolStore = useToolStore()
const inventoryStore = useInventoryStore()
const { show } = useToast()

const toolTypes = computed(() => {
  const byType = db.toolsByType()
  return Object.keys(byType).filter((type) => {
    const def = byType[type][0]
    return checkCondition(def.showCond)
  })
})

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
    show(`${t('toast.tool.upgraded')} ${t(newLevelDef?.locKey ?? '')}`, 'var(--accent)')
  } else {
    show(t('toast.craft.fail'), 'var(--danger)')
  }
}
</script>

<style scoped>
.tool-panel-wrapper {
  width: 100%;
  height: 190px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 12px 16px;
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}

.tool-panel-wrapper::-webkit-scrollbar {
  height: 4px;
}
.tool-panel-wrapper::-webkit-scrollbar-track {
  background: transparent;
}
.tool-panel-wrapper::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 2px;
}

.tool-scroll-inner {
  display: flex;
  flex-direction: row;
  gap: 12px;
  height: 100%;
}

.tool-slot {
  flex-shrink: 0;
  width: 190px;
  height: 100%;
  box-sizing: border-box;
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid var(--border);
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
  color: var(--accent);
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

.cost-chip--ok   { color: var(--accent);  border-color: var(--accent-bg-hover); }
.cost-chip--lack { color: var(--danger);    border-color: var(--danger-border); }

.cost-have {
  font-size: 9px;
  opacity: 0.6;
  margin-left: 1px;
}

.upgrade-btn {
  margin-top: auto;
  padding: 4px 10px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid;
  transition: background 0.12s;
  align-self: flex-start;
}

.upgrade-btn--ok {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
}

.upgrade-btn--ok:hover:not(:disabled) {
  background: var(--accent-bg-hover);
}

.upgrade-btn--lack {
  background: var(--danger-bg);
  border-color: var(--danger-border);
  color: var(--danger-text);
  cursor: not-allowed;
}

.slot-max {
  font-size: 11px;
  color: #555;
  margin-top: auto;
}
</style>
