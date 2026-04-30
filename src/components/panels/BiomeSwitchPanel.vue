<template>
  <div class="biome-panel-wrapper">
    <!-- 群系列表 -->
    <div class="biome-list">
      <div
        v-for="biomeId in worldStore.discoveredBiomeIds"
        :key="biomeId"
        class="biome-item"
        :class="{ 'biome-item--active': biomeId === worldStore.currentBiomeId }"
      >
        <span class="biome-name">{{ db.name('biomes', biomeId) }}</span>
        <button
          v-if="biomeId !== worldStore.currentBiomeId"
          class="switch-btn"
          @click="handleSwitch(biomeId)"
        >
          {{ t('btn.switch_biome') }}
        </button>
        <span v-else class="current-label">◄</span>
      </div>
    </div>

    <!-- 探索按钮 -->
    <div class="explore-section">
      <div class="explore-cost">
        <span class="cost-label">{{ t('hint.explore_cost') }}</span>
        <span
          v-for="c in worldStore.exploreCost"
          :key="c.resourceId"
          class="cost-chip"
          :class="inventoryStore.getAmount(c.resourceId) >= c.amount ? 'cost-chip--ok' : 'cost-chip--lack'"
        >
          {{ db.name('resources', c.resourceId) }}×{{ c.amount }}
        </span>
      </div>
      <button
        class="explore-btn"
        :class="canExplore ? 'explore-btn--ok' : 'explore-btn--lack'"
        :disabled="!canExplore"
        @click="handleExplore"
      >
        {{ t('btn.explore') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWorldStore } from '../../stores/worldStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import { useToast } from '../../composables/useToast'

const worldStore = useWorldStore()
const inventoryStore = useInventoryStore()
const { show } = useToast()

const canExplore = computed(() => {
  for (const c of worldStore.exploreCost) {
    if (inventoryStore.getAmount(c.resourceId) < c.amount) return false
  }
  return true
})

function handleSwitch(biomeId: string) {
  worldStore.switchBiome(biomeId)
}

function handleExplore() {
  if (!canExplore.value) {
    show(t('hint.no_cost'), 'var(--accent-red)')
    return
  }
  const result = worldStore.exploreBiome()
  if (!result.success) {
    show(t('hint.no_cost'), 'var(--accent-red)')
    return
  }
  const biomeName = db.name('biomes', result.biomeId)
  if (result.isNew) {
    show(`${t('hint.biome_discovered')}${biomeName}`, 'var(--accent-green)')
  } else {
    show(`${t('hint.explore_success')}${biomeName}`, 'var(--accent-green)')
  }
}
</script>

<style scoped>
.biome-panel-wrapper {
  width: 100%;
}

.biome-list {
  padding: 10px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.biome-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid rgba(180, 180, 180, 0.2);
  border-radius: 4px;
}

.biome-item--active {
  border-color: var(--accent-green, #4caf50);
  background: rgba(30, 50, 30, 0.8);
}

.biome-name {
  font-size: 13px;
  color: #ddd;
}

.current-label {
  font-size: 12px;
  color: var(--accent-green, #4caf50);
}

.switch-btn {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 11px;
  padding: 3px 8px;
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid rgba(180, 180, 180, 0.3);
  border-radius: 3px;
  color: #e8e8e8;
  cursor: pointer;
}

.switch-btn:hover {
  background: rgba(50, 50, 50, 0.9);
}

.explore-section {
  padding: 10px 20px 14px;
  border-top: 1px solid rgba(180, 180, 180, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.explore-cost {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.cost-label {
  font-size: 11px;
  color: #888;
}

.cost-chip {
  font-size: 11px;
  padding: 2px 6px;
  border: 1px solid;
  border-radius: 3px;
}

.cost-chip--ok {
  color: var(--accent-green, #4caf50);
  border-color: #2a4a2a;
}

.cost-chip--lack {
  color: var(--accent-red, #f44336);
  border-color: #4a2a2a;
}

.explore-btn {
  align-self: flex-start;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  padding: 5px 14px;
  border: 1px solid;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.12s;
}

.explore-btn--ok {
  background: #1e3a1e;
  border-color: var(--accent-green, #4caf50);
  color: var(--accent-green, #4caf50);
}

.explore-btn--ok:hover:not(:disabled) {
  background: #254a25;
}

.explore-btn--lack {
  background: #2a2020;
  border-color: #4a3030;
  color: #774444;
  cursor: not-allowed;
}
</style>
