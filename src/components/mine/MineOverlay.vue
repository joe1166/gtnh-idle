<template>
  <div class="mine-overlay">

    <!-- ── 顶栏 ── -->
    <div class="mine-topbar">
      <button class="exit-btn" @click="store.openExitDialog()">
        ✕ {{ t('mine.btn.exit') }}
      </button>

      <!-- 体力条 -->
      <div class="stamina-section">
        <span class="stamina-label">{{ t('mine.stamina.label') }}</span>
        <div class="stamina-bar-wrap">
          <div
            class="stamina-bar-fill"
            :style="{ width: staminaPercent + '%' }"
            :class="staminaClass"
          />
        </div>
        <span class="stamina-text">{{ store.stamina }} / {{ store.maxStamina }}</span>
        <button
          class="stamina-add-btn"
          :disabled="store.stamina >= store.maxStamina"
          @click="showFoodModal = true"
          :title="t('mine.stamina.add')"
        >+</button>
      </div>

      <!-- 探矿仪扫描（行内） -->
      <div class="prospector-inline">
        <MineProspector />
      </div>
    </div>

    <!-- ── 主区域：网格（深度 HUD 浮于格子上方，由 MineGrid 内部渲染） ── -->
    <div class="mine-main">
      <MineGrid />
    </div>

    <!-- ── 食物弹窗 ── -->
    <div v-if="showFoodModal" class="food-modal-overlay" @click.self="showFoodModal = false">
      <div class="food-modal">
        <div class="food-modal-title">{{ t('mine.stamina.food_modal_title') }}</div>

        <div v-if="foodResources.length === 0" class="food-modal-empty">
          {{ t('mine.stamina.no_food') }}
        </div>
        <div v-else class="food-modal-list">
          <div
            v-for="res in foodResources"
            :key="res.id"
            class="food-modal-row"
          >
            <div class="food-modal-info">
              <span class="food-name">{{ t(res.locKey) }}</span>
              <span class="food-pts">+{{ res.foodPoints ?? 0 }}</span>
              <span class="food-stock">× {{ inv.getAmount(res.id) }}</span>
            </div>
            <button
              class="eat-btn"
              :disabled="store.stamina >= store.maxStamina || inv.getAmount(res.id) <= 0"
              @click="eatFood(res.id)"
            >
              {{ t('mine.stamina.eat') }}
            </button>
          </div>
        </div>

        <div class="food-modal-footer">
          <button class="modal-btn-close" @click="showFoodModal = false">
            {{ t('mine.stamina.close') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── 离开确认弹窗 ── -->
    <Transition name="dialog-fade">
      <div v-if="store.exitDialogOpen" class="dialog-backdrop">
        <div class="exit-dialog">
          <div class="dialog-title">
            {{ store.stamina <= 0 ? t('mine.exit.stamina_depleted') : t('mine.exit.title') }}
          </div>

          <div class="loot-section">
            <div class="loot-title">{{ t('mine.exit.loot_title') }}</div>
            <template v-if="hasLoot">
              <div
                v-for="(amount, resourceId) in store.sessionLoot"
                :key="resourceId"
                class="loot-row"
              >
                <span class="loot-name">{{ t('res.' + resourceId) }}</span>
                <span class="loot-amount">× {{ amount }}</span>
              </div>
            </template>
            <div v-else class="loot-empty">{{ t('mine.exit.no_loot') }}</div>
          </div>

          <div class="dialog-btns">
            <button class="btn-confirm" @click="store.confirmExit()">
              {{ t('mine.exit.confirm') }}
            </button>
            <button class="btn-cancel" @click="store.cancelExitDialog()">
              {{ t('mine.exit.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMineStore } from '../../stores/mineStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import MineGrid from './MineGrid.vue'
import MineProspector from './MineProspector.vue'

const store = useMineStore()
const inv   = useInventoryStore()

const showFoodModal = ref(false)

const foodResources = computed(() =>
  db.table('resources').filter(r => r.tags.includes('food'))
)

const staminaPercent = computed(() =>
  store.maxStamina > 0 ? (store.stamina / store.maxStamina) * 100 : 0
)

const staminaClass = computed(() => {
  if (staminaPercent.value > 50) return 'stamina--high'
  if (staminaPercent.value > 20) return 'stamina--mid'
  return 'stamina--low'
})

const hasLoot = computed(() => Object.keys(store.sessionLoot).length > 0)

function eatFood(resourceId: string) {
  store.useFoodItem(resourceId)
  if (store.stamina >= store.maxStamina) {
    showFoodModal.value = false
  }
}
</script>

<style scoped>
.mine-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #0d0d0d;
  display: flex;
  flex-direction: column;
  font-family: var(--font-mono);
  color: var(--text-primary);
}

/* ── 顶栏 ── */
.mine-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.exit-btn {
  background: var(--danger-bg);
  border: 1px solid #7a3a3a;
  color: var(--danger);
  padding: 4px 12px;
  cursor: pointer;
  border-radius: 4px;
  font-family: var(--font-mono);
  white-space: nowrap;
}
.exit-btn:hover {
  background: var(--danger-border);
}

.stamina-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 200px;
}

.stamina-label {
  color: var(--text-secondary);
  white-space: nowrap;
  font-size: 0.85em;
}

.stamina-bar-wrap {
  flex: 1;
  height: 8px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
}

.stamina-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s, background 0.3s;
}
.stamina--high { background: var(--accent); }
.stamina--mid  { background: var(--warn); }
.stamina--low  { background: var(--danger); }

.stamina-text {
  font-size: 0.8em;
  white-space: nowrap;
  color: var(--text-secondary);
  min-width: 50px;
}

.stamina-add-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--accent);
  background: var(--bg-base);
  color: var(--accent);
  font-size: 1.1em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
}
.stamina-add-btn:hover:not(:disabled) {
  background: var(--accent);
  color: var(--bg-base);
}
.stamina-add-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.prospector-inline {
  min-width: 220px;
  max-width: 320px;
}

/* ── 主区域 ── */
.mine-main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px;
}

/* ── 食物弹窗 ── */
.food-modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.food-modal {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  min-width: 280px;
  max-width: 360px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
}

.food-modal-title {
  font-size: 1em;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

.food-modal-empty {
  color: var(--text-secondary);
  font-size: 0.85em;
  text-align: center;
  padding: 16px 0;
}

.food-modal-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.food-modal-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.food-modal-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.food-name {
  color: var(--text-primary);
  font-size: 0.9em;
}

.food-pts {
  color: var(--accent);
  font-size: 0.85em;
  font-weight: bold;
}

.food-stock {
  color: var(--text-secondary);
  font-size: 0.8em;
}

.eat-btn {
  background: var(--accent);
  border: none;
  color: var(--bg-base);
  padding: 4px 14px;
  cursor: pointer;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.85em;
  white-space: nowrap;
}
.eat-btn:hover:not(:disabled) {
  filter: brightness(1.15);
}
.eat-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.food-modal-footer {
  display: flex;
  justify-content: flex-end;
}

.modal-btn-close {
  background: var(--bg-base);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 6px 16px;
  cursor: pointer;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.85em;
}
.modal-btn-close:hover {
  background: #3a3a3a;
}

/* ── 离开确认弹窗 ── */
.dialog-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.exit-dialog {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 24px;
  min-width: 280px;
  max-width: 380px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
}

.dialog-title {
  font-size: 1.1em;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
}

.loot-section {
  margin-bottom: 20px;
}

.loot-title {
  font-size: 0.8em;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.loot-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.loot-name {
  color: var(--text-primary);
  font-size: 0.9em;
}

.loot-amount {
  color: var(--accent);
  font-weight: bold;
  font-size: 0.9em;
}

.loot-empty {
  color: var(--text-secondary);
  font-size: 0.85em;
  font-style: italic;
}

.dialog-btns {
  display: flex;
  gap: 10px;
}

.btn-confirm {
  flex: 1;
  padding: 8px 16px;
  background: var(--danger-bg);
  border: 1px solid #7a3a3a;
  color: var(--danger);
  cursor: pointer;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.9em;
}
.btn-confirm:hover {
  background: var(--danger-border);
}

.btn-cancel {
  flex: 1;
  padding: 8px 16px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.9em;
}
.btn-cancel:hover {
  background: #3a3a3a;
}

/* ── 弹窗过渡动画 ── */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.15s;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>
