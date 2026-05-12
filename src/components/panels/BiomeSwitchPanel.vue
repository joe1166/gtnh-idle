<template>
  <div class="biome-panel-wrapper">

    <!-- 左侧 70%：群系横向滚动 -->
    <div class="biome-scroll-area">
      <div class="biome-scroll-inner">
        <button
          v-for="biomeId in worldStore.discoveredBiomeIds"
          :key="biomeId"
          class="biome-card"
          :class="{ 'biome-card--active': biomeId === worldStore.currentBiomeId }"
          :style="biomeCardBg(biomeId)"
          @click="handleSwitch(biomeId)"
        >
          <span class="biome-card-overlay" />
          <span class="biome-card-name">{{ db.name('biomes', biomeId) }}</span>
          <span v-if="biomeId === worldStore.currentBiomeId" class="biome-card-badge">◄</span>
        </button>
      </div>
    </div>

    <!-- 右侧 30%：探索区 -->
    <div class="explore-section">
      <div class="cost-label">{{ t('explore.food.required') }}：{{ worldStore.exploreFoodRequired }}{{ t('explore.food.unit') }}</div>

      <div class="food-progress-wrap">
        <div class="food-progress-label">
          {{ t('explore.food.selected') }}: {{ committedPoints }}/{{ worldStore.exploreFoodRequired }}{{ t('explore.food.unit') }}
        </div>
        <div class="food-progress-bar">
          <div
            class="food-progress-fill"
            :class="canExplore ? 'food-progress-fill--ok' : ''"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
      </div>

      <button class="food-select-btn" @click="openModal">
        {{ t('explore.food.select_btn') }} ▼
      </button>

      <button
        class="explore-btn"
        :class="canExplore ? 'explore-btn--ok' : 'explore-btn--lack'"
        :disabled="!canExplore"
        @click="handleExplore"
      >
        {{ t('btn.explore') }}
      </button>
    </div>

    <!-- 食物选择弹窗 -->
    <div v-show="showFoodModal" class="food-modal-overlay" @click.self="cancelModal">
      <div class="food-modal">
        <div class="food-modal-title">{{ t('explore.food.modal_title') }}</div>

        <div v-if="foodResources.length === 0" class="food-modal-empty">
          {{ t('explore.food.no_food') }}
        </div>
        <div v-else class="food-modal-list">
          <div
            v-for="res in foodResources"
            :key="res.id"
            class="food-modal-row"
          >
            <div class="food-modal-info">
              <span class="food-name">{{ t(res.locKey) }}</span>
              <span class="food-pts">({{ res.foodPoints ?? 0 }}{{ t('explore.food.unit') }})</span>
              <span class="food-stock">库存:{{ inventoryStore.getAmount(res.id) }}</span>
            </div>
            <div class="food-modal-ctrl">
              <button class="qty-btn" @click="decDraft(res.id)">−</button>
              <span class="qty-num">{{ draftFood[res.id] ?? 0 }}</span>
              <button class="qty-btn" @click="incDraft(res.id)">+</button>
              <span class="qty-pts">= {{ ((draftFood[res.id] ?? 0) * (res.foodPoints ?? 0)) }}{{ t('explore.food.unit') }}</span>
            </div>
          </div>
        </div>

        <div class="food-modal-footer">
          <span class="food-modal-total">
            {{ t('explore.food.selected') }}: {{ draftPoints }}/{{ worldStore.exploreFoodRequired }}{{ t('explore.food.unit') }}
          </span>
          <div class="food-modal-actions">
            <button class="modal-btn modal-btn--cancel" @click="cancelModal">{{ t('explore.food.cancel') }}</button>
            <button class="modal-btn modal-btn--confirm" @click="confirmModal">{{ t('explore.food.confirm') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWorldStore } from '../../stores/worldStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import { useToast } from '../../composables/useToast'
import { useSaveLoad } from '../../composables/useSaveLoad'

const worldStore = useWorldStore()
const inventoryStore = useInventoryStore()
const { show } = useToast()
const { save } = useSaveLoad()

const showFoodModal = ref(false)
const draftFood = ref<Record<string, number>>({})
const committedFood = ref<Record<string, number>>({})

const foodResources = computed(() =>
  db.table('resources').filter(r => r.tags.includes('food') && inventoryStore.getAmount(r.id) > 0)
)

const committedPoints = computed(() =>
  Object.entries(committedFood.value).reduce(
    (sum, [id, qty]) => sum + qty * (db.get('resources', id)?.foodPoints ?? 0),
    0,
  )
)

const draftPoints = computed(() =>
  Object.entries(draftFood.value).reduce(
    (sum, [id, qty]) => sum + qty * (db.get('resources', id)?.foodPoints ?? 0),
    0,
  )
)

const progressPercent = computed(() =>
  Math.min(100, worldStore.exploreFoodRequired > 0
    ? Math.round(committedPoints.value / worldStore.exploreFoodRequired * 100)
    : 0)
)

const canExplore = computed(() =>
  committedPoints.value >= worldStore.exploreFoodRequired && worldStore.exploreFoodRequired > 0
)

function biomeCardBg(biomeId: string): Record<string, string> {
  const biome = db.get('biomes', biomeId)
  if (biome?.imagePath) {
    return {
      backgroundImage: `url(${biome.imagePath})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return {}
}

function openModal() {
  draftFood.value = { ...committedFood.value }
  showFoodModal.value = true
}

function cancelModal() {
  showFoodModal.value = false
}

function confirmModal() {
  committedFood.value = { ...draftFood.value }
  showFoodModal.value = false
}

function incDraft(id: string) {
  const max = inventoryStore.getAmount(id)
  draftFood.value = { ...draftFood.value, [id]: Math.min((draftFood.value[id] ?? 0) + 1, max) }
}

function decDraft(id: string) {
  draftFood.value = { ...draftFood.value, [id]: Math.max((draftFood.value[id] ?? 0) - 1, 0) }
}

function handleSwitch(biomeId: string) {
  worldStore.switchBiome(biomeId)
}

function handleExplore() {
  if (!canExplore.value) {
    show(t('hint.no_cost'), 'var(--danger)')
    return
  }
  const result = worldStore.exploreBiome(committedFood.value)
  if (!result.success) {
    show(t('hint.explore_fail'), 'var(--danger)')
    return
  }
  committedFood.value = {}
  const biomeName = db.name('biomes', result.biomeId)
  if (result.isNew) {
    save()
    show(`${t('hint.biome_discovered')}${biomeName}`, 'var(--accent)')
  } else {
    show(`${t('hint.explore_success')}${biomeName}`, 'var(--accent)')
  }
}
</script>

<style scoped>
.biome-panel-wrapper {
  width: 100%;
  height: 190px;
  display: flex;
  flex-direction: row;
  position: relative;
  overflow: hidden;
}

/* ─── 左侧群系滚动区（70%） ──────────────────────────────── */

.biome-scroll-area {
  flex: 0 0 70%;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 12px 10px 12px 16px;
  box-sizing: border-box;
  /* 细滚动条 */
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}

.biome-scroll-area::-webkit-scrollbar {
  height: 4px;
}
.biome-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}
.biome-scroll-area::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 2px;
}

.biome-scroll-inner {
  display: flex;
  flex-direction: row;
  gap: 10px;
  height: 100%;
}

/* 群系卡片：固定宽高，4:3 比例 */
.biome-card {
  flex-shrink: 0;
  /* 高度 = 父级高度 - 上下 padding = 190 - 24 = 166px; 宽 = 166*4/3 ≈ 221px */
  height: 100%;
  aspect-ratio: 4 / 3;
  position: relative;
  border-radius: 5px;
  border: 2px solid var(--border);
  background: rgba(30, 30, 30, 0.9);
  cursor: pointer;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  transition: border-color 0.15s, transform 0.1s;
  font-family: 'Consolas', 'Courier New', monospace;
}

.biome-card:hover {
  border-color: var(--accent);
  transform: scale(1.02);
}

.biome-card--active {
  border-color: var(--accent);
}

/* 渐变遮罩，让文字在背景图上清晰可读 */
.biome-card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 45%, transparent 100%);
  pointer-events: none;
}

.biome-card-name {
  position: relative;
  z-index: 1;
  font-size: 12px;
  color: #eee;
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
  padding: 6px 8px;
  text-align: center;
  word-break: break-all;
}

.biome-card-badge {
  position: absolute;
  top: 6px;
  right: 7px;
  z-index: 1;
  font-size: 11px;
  color: var(--accent);
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}

/* ─── 右侧探索区（30%） ─────────────────────────────────── */

.explore-section {
  flex: 0 0 30%;
  height: 100%;
  box-sizing: border-box;
  padding: 12px 16px 12px 12px;
  border-left: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}

.cost-label {
  font-size: 11px;
  color: #888;
}

.food-progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.food-progress-label {
  font-size: 11px;
  color: #aaa;
}

.food-progress-bar {
  height: 6px;
  background: rgba(80, 80, 80, 0.5);
  border-radius: 3px;
  overflow: hidden;
}

.food-progress-fill {
  height: 100%;
  background: #556;
  border-radius: 3px;
  transition: width 0.15s ease;
}

.food-progress-fill--ok {
  background: var(--accent);
}

.food-select-btn {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 11px;
  padding: 4px 8px;
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: #ccc;
  cursor: pointer;
  white-space: nowrap;
  align-self: flex-start;
}

.food-select-btn:hover {
  background: rgba(50, 50, 50, 0.9);
  color: #eee;
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
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
}

.explore-btn--ok:hover:not(:disabled) {
  background: var(--accent-bg-hover);
}

.explore-btn--lack {
  background: var(--danger-bg);
  border-color: var(--danger-border);
  color: var(--danger-text);
  cursor: not-allowed;
}

/* ─── 食物选择弹窗 ─────────────────────────────── */

.food-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.food-modal {
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 6px;
  width: 340px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Consolas', 'Courier New', monospace;
}

.food-modal-title {
  padding: 10px 14px;
  font-size: 13px;
  font-weight: bold;
  color: #ddd;
  border-bottom: 1px solid var(--border-subtle);
}

.food-modal-empty {
  padding: 20px 14px;
  font-size: 12px;
  color: #666;
  text-align: center;
}

.food-modal-list {
  overflow-y: auto;
  flex: 1;
}

.food-modal-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(180, 180, 180, 0.06);
  gap: 8px;
}

.food-modal-row:last-child {
  border-bottom: none;
}

.food-modal-info {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
}

.food-name {
  font-size: 12px;
  color: #ddd;
}

.food-pts {
  font-size: 10px;
  color: #888;
}

.food-stock {
  font-size: 10px;
  color: #666;
}

.food-modal-ctrl {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.qty-btn {
  width: 20px;
  height: 20px;
  background: rgba(60, 60, 60, 0.8);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: #ccc;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.qty-btn:hover {
  background: rgba(80, 80, 80, 0.9);
}

.qty-num {
  min-width: 22px;
  text-align: center;
  font-size: 12px;
  color: #eee;
}

.qty-pts {
  font-size: 10px;
  color: #888;
  min-width: 36px;
}

.food-modal-footer {
  padding: 10px 14px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.food-modal-total {
  font-size: 11px;
  color: #aaa;
}

.food-modal-actions {
  display: flex;
  gap: 6px;
}

.modal-btn {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid;
}

.modal-btn--cancel {
  background: rgba(30, 30, 30, 0.8);
  border-color: var(--border);
  color: #aaa;
}

.modal-btn--cancel:hover {
  color: #ccc;
}

.modal-btn--confirm {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
}

.modal-btn--confirm:hover {
  background: var(--accent-bg-hover);
}
</style>
