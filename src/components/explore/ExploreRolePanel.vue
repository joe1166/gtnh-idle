<template>
  <div class="role-panel">
    <div class="panel-title">{{ t('explore.panel.role') }}</div>

    <div class="stat-card">
      <div class="stat-head">
        <span>{{ t('explore.role.hp') }}</span>
        <span>{{ store.hp }}/{{ store.maxHp }}</span>
      </div>
      <div class="hp-bar">
        <div class="hp-fill" :style="{ width: `${hpPercent}%` }" />
      </div>
    </div>

    <div class="loot-card">
      <div class="section-title">{{ t('explore.loot.title') }}</div>
      <template v-if="store.hasLoot">
        <div
          v-for="(amount, resId) in store.sessionLoot"
          :key="resId"
          class="loot-row"
        >
          <span class="loot-name">{{ t('res.' + resId) }}</span>
          <span class="loot-amount">x{{ amount }}</span>
        </div>
      </template>
      <div v-else class="loot-empty">{{ t('mine.exit.no_loot') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useExploreStore } from '../../stores/exploreStore'
import { t } from '../../data/i18n'

const store = useExploreStore()

const hpPercent = computed(() => {
  if (store.maxHp <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((store.hp / store.maxHp) * 100)))
})
</script>

<style scoped>
.role-panel {
  width: 300px;
  max-width: 300px;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  background: var(--bg-panel);
  border-right: 1px solid var(--border);
}

.panel-title {
  font-size: 0.9rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.stat-card,
.loot-card {
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.02);
  padding: 10px;
}

.stat-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.hp-bar {
  width: 100%;
  height: 10px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
}

.hp-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s ease;
}

.section-title {
  font-size: 0.78rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}

.loot-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 0.84rem;
}

.loot-name {
  color: var(--text-primary);
}

.loot-amount {
  color: var(--accent);
  font-weight: bold;
}

.loot-empty {
  color: var(--text-muted);
  font-size: 0.8rem;
  font-style: italic;
}
</style>
