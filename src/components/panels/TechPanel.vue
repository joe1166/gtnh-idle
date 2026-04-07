<template>
  <div class="tech-panel">
    <div class="panel-header">
      <span class="panel-title">{{ t('panel.tech.title') }}</span>
      <span class="panel-hint">{{ t('panel.tech.hint') }}</span>
    </div>

    <div v-if="techStore.allTechsWithStatus.length === 0" class="empty-hint">
      {{ t('empty.no_techs') }}
    </div>

    <div v-else class="tech-list">
      <div
        v-for="tech in techStore.allTechsWithStatus"
        :key="tech.id"
        class="tech-card"
        :class="{
          'tech-card--researched': tech.researched,
          'tech-card--available': tech.available,
          'tech-card--locked': !tech.researched && !tech.available,
        }"
      >
        <!-- 标题行 -->
        <div class="tech-header">
          <span class="tech-status-icon">
            {{ tech.researched ? '✅' : tech.available ? '🔬' : '🔒' }}
          </span>
          <span class="tech-name">{{ t(tech.locKey) }}</span>
          <span v-if="tech.researched" class="tech-badge tech-badge--done">
            {{ t('tech.status.researched') }}
          </span>
          <span v-else-if="!tech.available" class="tech-badge tech-badge--locked">
            {{ t('tech.status.locked') }}
          </span>
        </div>

        <div class="tech-desc">{{ t(tech.descLocKey) }}</div>

        <!-- 前置科技 -->
        <div v-if="tech.prerequisites.length > 0" class="tech-prereqs">
          <span class="prereq-label">{{ t('tech.prereq.label') }}</span>
          <span
            v-for="preId in tech.prerequisites"
            :key="preId"
            class="prereq-chip"
            :class="techStore.isResearched(preId) ? 'prereq-chip--ok' : 'prereq-chip--lack'"
          >
            {{ getTechName(preId) }}
          </span>
        </div>

        <!-- 研究消耗 -->
        <div class="tech-cost">
          <span class="cost-label">{{ t('tech.cost.label') }}</span>
          <span
            v-for="c in tech.cost"
            :key="c.resourceId"
            class="cost-chip"
            :class="inventoryStore.getAmount(c.resourceId) >= c.amount ? 'cost-chip--ok' : 'cost-chip--lack'"
          >
            {{ getResName(c.resourceId) }}×{{ c.amount }}
            <span class="cost-have">({{ fmt(inventoryStore.getAmount(c.resourceId)) }})</span>
          </span>
        </div>

        <!-- 解锁内容预览 -->
        <div class="tech-unlocks">
          <span class="unlocks-label">{{ t('tech.unlocks.label') }}</span>
          <span v-if="tech.unlocks.features?.length" class="unlock-group">
            <span class="unlock-type">{{ t('tech.unlocks.features') }}:</span>
            <span v-for="f in tech.unlocks.features" :key="f" class="unlock-item">{{ f }}</span>
          </span>
          <span v-if="tech.unlocks.machineDefIds?.length" class="unlock-group">
            <span class="unlock-type">{{ t('tech.unlocks.machines') }}:</span>
            <span v-for="id in tech.unlocks.machineDefIds" :key="id" class="unlock-item">{{ id }}</span>
          </span>
          <span v-if="tech.unlocks.recipeIds?.length" class="unlock-group">
            <span class="unlock-type">{{ t('tech.unlocks.recipes') }}:</span>
            <span v-for="id in tech.unlocks.recipeIds" :key="id" class="unlock-item">{{ id }}</span>
          </span>
        </div>

        <!-- 研究按钮 -->
        <div v-if="tech.available" class="tech-actions">
          <button
            class="research-btn"
            :class="canAffordTech(tech) ? 'research-btn--ok' : 'research-btn--lack'"
            :disabled="!canAffordTech(tech)"
            @click="handleResearch(tech.id, tech.locKey)"
          >
            🔬 {{ t('btn.research') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTechStore } from '../../stores/techStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import { fmt } from '../../utils/format'
import { useToast } from '../../composables/useToast'
import type { TechDef } from '../../data/types'

const techStore = useTechStore()
const inventoryStore = useInventoryStore()
const { show } = useToast()

function getTechName(techId: string): string {
  return db.name('techs', techId)
}

function getResName(id: string): string {
  return db.name('resources', id)
}

function canAffordTech(tech: TechDef): boolean {
  return inventoryStore.canAfford(tech.cost)
}

function handleResearch(techId: string, techLocKey: string) {
  const ok = techStore.research(techId)
  if (ok) show(`${t('toast.research.success')} ${t(techLocKey)}`, 'var(--accent-green)')
  else show(t('toast.research.fail'), 'var(--accent-red)')
}
</script>

<style scoped>
.tech-panel {
  font-family: 'Consolas', 'Courier New', monospace;
  color: var(--text-primary);
}

.panel-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}
.panel-title { font-size: 15px; font-weight: bold; }
.panel-hint  { font-size: 11px; color: #666; }

.empty-hint {
  color: #555;
  font-size: 12px;
  padding: 8px 0;
}

.tech-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tech-card {
  border: 1px solid var(--border-color);
  background: var(--bg-panel);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.15s;
}

.tech-card--researched {
  border-color: #2a4a2a;
  opacity: 0.7;
}

.tech-card--available {
  border-color: var(--accent-yellow);
}

.tech-card--locked {
  border-color: #333;
  opacity: 0.5;
}

.tech-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tech-status-icon { font-size: 16px; }

.tech-name {
  font-size: 14px;
  font-weight: bold;
  color: #ddd;
}

.tech-badge {
  font-size: 10px;
  padding: 1px 6px;
  border: 1px solid;
  margin-left: auto;
}
.tech-badge--done   { color: var(--accent-green); border-color: var(--accent-green); }
.tech-badge--locked { color: #666; border-color: #444; }

.tech-desc {
  font-size: 12px;
  color: #999;
  line-height: 1.5;
}

.tech-prereqs {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.prereq-label { font-size: 11px; color: #666; }

.prereq-chip {
  font-size: 11px;
  padding: 1px 6px;
  border: 1px solid;
}
.prereq-chip--ok   { color: var(--accent-green); border-color: #2a4a2a; }
.prereq-chip--lack { color: var(--accent-red);   border-color: #4a2a2a; }

.tech-cost {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.cost-label { font-size: 11px; color: #666; }

.cost-chip {
  font-size: 11px;
  padding: 1px 6px;
  border: 1px solid;
  white-space: nowrap;
}
.cost-chip--ok   { color: var(--accent-green); border-color: #2a4a2a; }
.cost-chip--lack { color: var(--accent-red);   border-color: #4a2a2a; }
.cost-have { font-size: 10px; opacity: 0.7; margin-left: 2px; }

.tech-unlocks {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11px;
}

.unlocks-label { color: #666; }

.unlock-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.unlock-type { color: #888; }

.unlock-item {
  color: var(--accent-yellow);
  padding: 0 4px;
  border: 1px solid #554400;
}

.tech-actions {
  margin-top: 4px;
}

.research-btn {
  padding: 4px 14px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid;
  transition: background 0.12s;
}

.research-btn--ok {
  background: #1e3a1e;
  border-color: var(--accent-green);
  color: var(--accent-green);
}
.research-btn--ok:hover { background: #254a25; }

.research-btn--lack {
  background: #2a2020;
  border-color: #4a3030;
  color: #774444;
  cursor: not-allowed;
}
</style>
