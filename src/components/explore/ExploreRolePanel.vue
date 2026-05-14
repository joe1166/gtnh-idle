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

    <div class="bag-card">
      <div class="section-title">{{ t('explore.loot.bag_title') }}</div>
      <div class="rotate-hint">{{ t('explore.loot.rotate_hint') }}</div>

      <div
        ref="bagGridEl"
        class="bag-grid"
        :style="{
          '--bag-cols': String(store.bagCols),
          '--bag-rows': String(store.bagRows),
        }"
      >
        <div
          v-for="cell in bagCells"
          :key="cell.key"
          class="bag-cell"
          :data-bag-cell="`${cell.x},${cell.y}`"
        />

        <div
          v-for="item in store.bagPlacedItems"
          :key="item.instanceId"
          v-show="!isDraggingBagSource(item.instanceId)"
          class="bag-item"
          :style="bagItemStyle(item)"
          @mouseenter="onLootEnter($event, item.itemId)"
          @mousemove="onLootMove($event)"
          @mouseleave="onLootLeave"
          @mousedown.prevent="onStartDragFromBag($event, item.instanceId)"
          @contextmenu.prevent="store.returnBagItemToGround(item.instanceId)"
        >
          <div class="bag-item-fit" :style="lootFitBoxStyle(item)">
            <img
              v-if="lootItemDef(item.itemId)?.iconPath"
              class="bag-item-icon"
              :src="lootItemDef(item.itemId)?.iconPath"
              alt=""
              draggable="false"
            />
          </div>
          <span class="bag-item-name">{{ t(lootItemDef(item.itemId)?.locKey ?? item.itemId) }}</span>
        </div>
      </div>
    </div>
    <AppTooltip :visible="tooltip.visible" :x="tooltip.x" :y="tooltip.y" :lines="tooltip.lines" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useExploreStore } from '../../stores/exploreStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import type { ExploreLootItemDef, ExploreBagPlacedItem } from '../../data/types'
import AppTooltip from '../common/AppTooltip.vue'

const store = useExploreStore()
const bagGridEl = ref<HTMLElement | null>(null)

const CELL = 34
const tooltip = ref<{ visible: boolean; x: number; y: number; lines: string[] }>({
  visible: false,
  x: 0,
  y: 0,
  lines: [],
})

const hpPercent = computed(() => {
  if (store.maxHp <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((store.hp / store.maxHp) * 100)))
})

const bagCells = computed(() => {
  const cells: Array<{ key: string; x: number; y: number }> = []
  for (let y = 0; y < store.bagRows; y++) {
    for (let x = 0; x < store.bagCols; x++) {
      cells.push({ key: `${x}-${y}`, x, y })
    }
  }
  return cells
})

function lootItemDef(itemId: string): ExploreLootItemDef | undefined {
  return db.get('explore_loot_items', itemId)
}

function lootGainLines(itemId: string): string[] {
  const def = lootItemDef(itemId)
  if (!def || def.convertOutputs.length === 0) return []
  return ['可获得', ...def.convertOutputs.map(out => `${db.name('resources', out.resourceId)} x${out.amount}`)]
}

function onLootEnter(e: MouseEvent, itemId: string): void {
  tooltip.value.lines = lootGainLines(itemId)
  tooltip.value.visible = tooltip.value.lines.length > 0
  onLootMove(e)
}

function onLootMove(e: MouseEvent): void {
  const panel = bagGridEl.value?.closest('.role-panel') as HTMLElement | null
  if (!panel) return
  const rect = panel.getBoundingClientRect()
  tooltip.value.x = e.clientX - rect.left + 12
  tooltip.value.y = e.clientY - rect.top - 28
}

function onLootLeave(): void {
  tooltip.value.visible = false
}

function bagItemStyle(item: ExploreBagPlacedItem): Record<string, string> {
  return {
    left: `${item.x * CELL}px`,
    top: `${item.y * CELL}px`,
    width: `${item.width * CELL - 2}px`,
    height: `${item.height * CELL - 2}px`,
  }
}

function lootFitBoxStyle(item: { width: number; height: number; rotated?: boolean }): Record<string, string> {
  if (!item.rotated) return {}
  const w = Math.max(1, item.width)
  const h = Math.max(1, item.height)
  return {
    width: `${(h / w) * 100}%`,
    height: `${(w / h) * 100}%`,
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%) rotate(90deg)',
    transformOrigin: 'center center',
  }
}

function onStartDragFromBag(e: MouseEvent, instanceId: string): void {
  const el = e.currentTarget as HTMLElement | null
  if (!el) {
    store.beginDragFromBag(instanceId, 0, 0)
    return
  }
  const rect = el.getBoundingClientRect()
  const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  const offsetY = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
  store.beginDragFromBag(instanceId, offsetX, offsetY)
}

function isDraggingBagSource(instanceId: string): boolean {
  const drag = store.draggingLoot
  return drag?.from === 'bag' && drag.sourcePlacedId === instanceId
}

function onWindowMouseUp(e: MouseEvent): void {
  const drag = store.draggingLoot
  if (!drag) return
  const gridEl = bagGridEl.value
  if (!gridEl) {
    store.cancelDraggingLoot()
    return
  }

  const rect = gridEl.getBoundingClientRect()
  const topLeftX = e.clientX - rect.left - drag.grabOffsetX
  const topLeftY = e.clientY - rect.top - drag.grabOffsetY

  // Snap by nearest center of the dragged item's top-left grid cell.
  const topLeftCenterX = topLeftX + CELL / 2
  const topLeftCenterY = topLeftY + CELL / 2
  let x = Math.round((topLeftCenterX - CELL / 2) / CELL)
  let y = Math.round((topLeftCenterY - CELL / 2) / CELL)

  // If right/bottom overflow, shift left/up to keep it in bounds.
  if (x + drag.item.width > store.bagCols) {
    x = store.bagCols - drag.item.width
  }
  if (y + drag.item.height > store.bagRows) {
    y = store.bagRows - drag.item.height
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    store.cancelDraggingLoot()
    return
  }
  if (x < 0 || y < 0 || x >= store.bagCols || y >= store.bagRows) {
    store.cancelDraggingLoot()
    return
  }
  if (!store.placeDraggingLoot(x, y)) {
    store.cancelDraggingLoot()
  }
}

function onWindowKeyDown(e: KeyboardEvent): void {
  if (!store.draggingLoot) return
  if (e.key.toLowerCase() !== 'r') return
  e.preventDefault()
  store.rotateDraggingLoot()
}

onMounted(() => {
  window.addEventListener('mouseup', onWindowMouseUp)
  window.addEventListener('keydown', onWindowKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('mouseup', onWindowMouseUp)
  window.removeEventListener('keydown', onWindowKeyDown)
  tooltip.value.visible = false
})
</script>

<style scoped>
.role-panel {
  position: relative;
  width: 320px;
  max-width: 320px;
  min-width: 280px;
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
.bag-card {
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
  margin-bottom: 6px;
}

.rotate-hint {
  font-size: 0.74rem;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.bag-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--bag-cols), 34px);
  grid-template-rows: repeat(var(--bag-rows), 34px);
  width: max-content;
  margin-inline: auto;
  gap: 0;
  border: 1px solid var(--border);
  background: var(--bg-base);
}

.bag-cell {
  width: 34px;
  height: 34px;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.bag-item {
  position: absolute;
  border: 1px solid var(--accent-dim);
  background: rgba(30, 45, 30, 0.9);
  overflow: hidden;
  cursor: grab;
  user-select: none;
}

.bag-item:active {
  cursor: grabbing;
}

.bag-item-fit {
  position: absolute;
  inset: 0;
}

.bag-item-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0.82;
  display: block;
}

.bag-item-name {
  position: absolute;
  left: 4px;
  bottom: 3px;
  font-size: 10px;
  color: #f3f3f3;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  pointer-events: none;
}
</style>
