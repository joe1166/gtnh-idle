<template>
  <div class="explore-overlay">
    <div class="explore-topbar">
      <div class="map-title">{{ mapName }}</div>
      <div class="topbar-spacer" />
      <button class="exit-btn" :disabled="store.defeatDialogOpen" @click="store.openExitDialog()">
        {{ t('explore.action.exit') }}
      </button>
    </div>

    <div class="explore-main">
      <ExploreRolePanel />
      <div class="map-area">
        <ExploreMap />
      </div>
      <ExploreRoomPanel />
    </div>

    <Transition name="dialog-fade">
      <div v-if="store.exitDialogOpen" class="dialog-backdrop">
        <div class="exit-dialog">
          <div class="dialog-title">
            {{ store.defeatDialogOpen ? t('explore.exit.defeat_title') : t('explore.action.exit') }}
          </div>

          <div v-if="store.defeatDialogOpen" class="defeat-desc">
            {{ t('explore.exit.defeat_desc') }}
          </div>

          <div class="loot-section">
            <div class="loot-title">{{ t('explore.loot.title') }}</div>
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

          <div class="dialog-btns">
            <button class="btn-confirm" @click="store.confirmExit()">
              {{ store.defeatDialogOpen ? t('explore.exit.defeat_confirm') : t('explore.exit.confirm') }}
            </button>
            <button v-if="!store.defeatDialogOpen" class="btn-cancel" @click="store.cancelExitDialog()">
              {{ t('mine.exit.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useExploreStore } from '../../stores/exploreStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import ExploreMap from '../explore/ExploreMap.vue'
import ExploreRoomPanel from '../explore/ExploreRoomPanel.vue'
import ExploreRolePanel from '../explore/ExploreRolePanel.vue'

const store = useExploreStore()

const mapName = computed(() => {
  const mapDef = db.get('explore_maps', store.mapId)
  return mapDef ? t(mapDef.locKey) : store.mapId
})
</script>

<style scoped>
.explore-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--bg-deep);
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
  font-family: var(--font-mono);
}

.explore-topbar {
  height: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-panel);
}

.map-title {
  font-weight: bold;
  color: var(--accent);
  letter-spacing: 0.06em;
}

.topbar-spacer {
  flex: 1;
}

.exit-btn {
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  color: var(--danger);
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 6px;
  font-family: var(--font-mono);
}

.exit-btn:hover {
  background: var(--danger-border);
}

.exit-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.explore-main {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.map-area {
  flex: 1;
  min-width: 0;
  background: var(--bg-deep);
}

.dialog-backdrop {
  position: absolute;
  inset: 0;
  background: var(--bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.exit-dialog {
  width: 360px;
  max-width: calc(100% - 24px);
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 18px;
}

.dialog-title {
  font-weight: bold;
  margin-bottom: 12px;
}

.defeat-desc {
  color: var(--text-secondary);
  margin-bottom: 10px;
  font-size: 0.88rem;
}

.loot-title {
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-size: 0.82rem;
}

.loot-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.loot-amount {
  color: var(--accent);
  font-weight: bold;
}

.loot-empty {
  color: var(--text-muted);
  font-style: italic;
}

.dialog-btns {
  margin-top: 14px;
  display: flex;
  gap: 8px;
}

.btn-confirm,
.btn-cancel {
  flex: 1;
  border-radius: 6px;
  padding: 8px 10px;
  font-family: var(--font-mono);
  border: 1px solid var(--border);
  cursor: pointer;
}

.btn-confirm {
  color: var(--danger);
  border-color: var(--danger-border);
  background: var(--danger-bg);
}

.btn-confirm:hover {
  background: var(--danger-border);
}

.btn-cancel {
  color: var(--text-primary);
  background: var(--bg-base);
}

.btn-cancel:hover {
  background: var(--bg-hover);
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.15s;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

@media (max-width: 1100px) {
  .explore-main {
    flex-direction: column;
  }

  .map-area {
    order: 1;
    min-height: 320px;
  }
}
</style>
