<template>
  <div class="room-panel">
    <div class="panel-title">
      {{ t('explore.panel.room') }}
      <span class="mode-tag">{{ modeText }}</span>
    </div>

    <div v-if="currentRoom" class="room-info">
      <div class="room-name">{{ roomName }}</div>
      <div class="room-desc">{{ roomDesc }}</div>

      <template v-if="store.mode === 'explore'">
        <button
          v-if="canLoot && !isLooting"
          class="btn-loot"
          @click="startLoot()"
        >
          {{ t('explore.action.loot') }}
        </button>
        <div v-if="isLooting" class="loot-progress-wrap">
          <div class="loot-progress-text">{{ t('explore.action.loot') }}...</div>
          <div class="loot-progress-track">
            <div class="loot-progress-fill" :style="{ width: `${lootProgress}%` }" />
          </div>
        </div>

        <div class="ground-box">
          <div class="ground-title">{{ t('explore.loot.ground_title') }}</div>
          <div
            class="ground-grid"
            :style="{
              '--ground-cols': String(groundCols),
              '--ground-rows': String(groundRows),
            }"
          >
            <div
              v-for="cell in groundCells"
              :key="cell.key"
              class="ground-cell"
            />

            <div
              v-for="placed in groundPlacements"
              :key="placed.item.instanceId"
              v-show="!isDraggingGroundSource(placed.item.instanceId)"
              class="ground-item"
              :style="groundItemStyle(placed.item, placed.x, placed.y)"
              @mouseenter="onLootEnter($event, placed.item.itemId)"
              @mousemove="onLootMove($event)"
              @mouseleave="onLootLeave"
              @mousedown.prevent="onStartDragFromGround($event, placed.item.instanceId)"
            >
              <div class="ground-item-fit" :style="lootFitBoxStyle(placed.item)">
                <img
                  v-if="lootItemDef(placed.item.itemId)?.iconPath"
                  class="ground-item-icon"
                  :src="lootItemDef(placed.item.itemId)?.iconPath"
                  alt=""
                  draggable="false"
                />
              </div>
              <span class="ground-item-name">{{ t(lootItemDef(placed.item.itemId)?.locKey ?? placed.item.itemId) }}</span>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="store.mode === 'event'">
        <div class="event-box">
          <div class="event-text">{{ eventText }}</div>
          <div class="event-actions">
            <button
              v-for="opt in eventOptions"
              :key="opt.key"
              class="btn-event"
              @click="store.chooseEventOption(opt.key)"
            >
              {{ t(opt.textLocKey) }}
            </button>
            <button
              v-if="eventOptions.length === 0"
              class="btn-event"
              @click="store.advanceEvent()"
            >
              {{ t('explore.event.continue') }}
            </button>
          </div>
        </div>
      </template>

      <template v-else-if="store.mode === 'combat'">
        <div class="combat-box">
          <div class="combat-title">{{ t('explore.combat.enemies') }}</div>
          <div
            v-for="enemy in aliveEnemies"
            :key="enemy.id + '-' + enemy.hp"
            class="enemy-row"
          >
            <span>{{ t(enemy.nameLocKey) }}</span>
            <span>{{ enemy.hp }}/{{ enemy.maxHp }}</span>
          </div>
          <div class="combat-log">{{ store.currentRoundLog || t('explore.combat.running') }}</div>
          <button class="btn-flee" @click="store.fleeCombat()">
            {{ t('explore.combat.flee') }}
          </button>
        </div>
      </template>
    </div>
    <AppTooltip :visible="tooltip.visible" :x="tooltip.x" :y="tooltip.y" :lines="tooltip.lines" />

    <button class="btn-exit" :disabled="store.mode === 'combat'" @click="store.openExitDialog()">
      {{ t('explore.action.exit') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import { useExploreStore } from '../../stores/exploreStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import type { ExploreLootInstance, ExploreLootItemDef } from '../../data/types'
import AppTooltip from '../common/AppTooltip.vue'

const store = useExploreStore()
const currentRoom = computed(() => store.currentRoom)
const isLooting = ref(false)
const lootProgress = ref(0)
let lootTimer: number | null = null
const tooltip = ref<{ visible: boolean; x: number; y: number; lines: string[] }>({
  visible: false,
  x: 0,
  y: 0,
  lines: [],
})

const groundCols = 6
const groundRows = 4
const CELL = 34

const modeText = computed(() => {
  if (store.mode === 'event') return t('explore.mode.event')
  if (store.mode === 'combat') return t('explore.mode.combat')
  if (store.mode === 'result') return t('explore.mode.result')
  return t('explore.mode.explore')
})

const roomName = computed(() => {
  const room = currentRoom.value
  if (!room) return ''
  if (room.defId === 'entry') return t('mine.node.entrance')
  const def = db.get('explore_rooms', room.defId)
  return def ? t(def.locKey) : room.defId
})

const roomDesc = computed(() => {
  const room = currentRoom.value
  if (!room || room.defId === 'entry') return t('explore.room.entry_desc')
  const def = db.get('explore_rooms', room.defId)
  return def ? t(def.descLocKey) : ''
})

const canLoot = computed(() => {
  const room = currentRoom.value
  if (!room || room.looted || room.defId === 'entry') return false
  return true
})

const eventText = computed(() => {
  const node = store.currentEventNode
  if (!node) return t('explore.event.empty')
  return t(node.textLocKey)
})

const eventOptions = computed(() => {
  const node = store.currentEventNode
  if (!node) return [] as Array<{ key: 'A' | 'B' | 'C'; textLocKey: string }>
  const options: Array<{ key: 'A' | 'B' | 'C'; textLocKey: string }> = []
  if (node.optionATextLocKey) options.push({ key: 'A', textLocKey: node.optionATextLocKey })
  if (node.optionBTextLocKey) options.push({ key: 'B', textLocKey: node.optionBTextLocKey })
  if (node.optionCTextLocKey) options.push({ key: 'C', textLocKey: node.optionCTextLocKey })
  return options
})

const aliveEnemies = computed(() => {
  const room = currentRoom.value
  if (!room?.enemies) return []
  return room.enemies.filter(e => e.hp > 0)
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
  const panel = (e.currentTarget as HTMLElement | null)?.closest('.room-panel') as HTMLElement | null
  if (!panel) return
  const rect = panel.getBoundingClientRect()
  tooltip.value.x = e.clientX - rect.left + 12
  tooltip.value.y = e.clientY - rect.top - 28
}

function onLootLeave(): void {
  tooltip.value.visible = false
}

type GroundPlaced = { item: ExploreLootInstance; x: number; y: number }

const groundPlacements = computed(() => {
  const source = store.currentRoomGroundLoot
  const rows = groundRows
  const occupied = Array.from({ length: rows }, () => Array.from({ length: groundCols }, () => false))
  const placed: GroundPlaced[] = []

  const canPlace = (x: number, y: number, w: number, h: number): boolean => {
    if (x < 0 || y < 0 || x + w > groundCols || y + h > rows) return false
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (occupied[yy][xx]) return false
      }
    }
    return true
  }

  const mark = (x: number, y: number, w: number, h: number): void => {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        occupied[yy][xx] = true
      }
    }
  }

  for (const item of source) {
    let put = false
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < groundCols; x++) {
        if (!canPlace(x, y, item.width, item.height)) continue
        mark(x, y, item.width, item.height)
        placed.push({ item, x, y })
        put = true
        break
      }
      if (put) break
    }
    if (!put) {
      placed.push({ item, x: 0, y: 0 })
    }
  }
  return placed
})

const groundCells = computed(() => {
  const list: Array<{ key: string }> = []
  for (let y = 0; y < groundRows; y++) {
    for (let x = 0; x < groundCols; x++) {
      list.push({ key: `${x}-${y}` })
    }
  }
  return list
})

function groundItemStyle(item: ExploreLootInstance, x: number, y: number): Record<string, string> {
  return {
    left: `${x * CELL}px`,
    top: `${y * CELL}px`,
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

function onStartDragFromGround(e: MouseEvent, instanceId: string): void {
  const el = e.currentTarget as HTMLElement | null
  if (!el) {
    store.beginDragFromGround(instanceId, 0, 0)
    return
  }
  const rect = el.getBoundingClientRect()
  const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  const offsetY = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
  store.beginDragFromGround(instanceId, offsetX, offsetY)
}

function isDraggingGroundSource(instanceId: string): boolean {
  const drag = store.draggingLoot
  if (!drag) return false
  if (drag.from !== 'ground') return false
  if (!store.currentRoomId || drag.sourceRoomId !== store.currentRoomId) return false
  return drag.item.instanceId === instanceId
}

function clearLootTimer(): void {
  if (lootTimer != null) {
    window.clearInterval(lootTimer)
    lootTimer = null
  }
}

function startLoot(): void {
  const room = currentRoom.value
  if (!room || isLooting.value || !canLoot.value) return
  isLooting.value = true
  lootProgress.value = 0
  clearLootTimer()

  const durationMs = 700
  const stepMs = 50
  const totalSteps = Math.ceil(durationMs / stepMs)
  let step = 0

  lootTimer = window.setInterval(() => {
    step += 1
    lootProgress.value = Math.min(100, Math.round((step / totalSteps) * 100))
    if (step >= totalSteps) {
      clearLootTimer()
      store.lootRoom(room.instanceId)
      isLooting.value = false
    }
  }, stepMs)
}

onBeforeUnmount(() => {
  clearLootTimer()
  tooltip.value.visible = false
})
</script>

<style scoped>
.room-panel {
  position: relative;
  width: 360px;
  max-width: 360px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  background: var(--bg-panel);
  border-left: 1px solid var(--border);
}

.panel-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.mode-tag {
  color: var(--accent);
  font-size: 0.75rem;
}

.room-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.room-name {
  font-size: 1.1rem;
  font-weight: bold;
}

.room-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.event-box,
.combat-box {
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.02);
  padding: 10px;
}

.event-text {
  font-size: 0.86rem;
  color: var(--text-primary);
  line-height: 1.6;
}

.event-actions {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.btn-event {
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--text-primary);
  cursor: pointer;
  font-family: var(--font-mono);
}

.btn-event:hover {
  background: var(--bg-hover);
}

.combat-title {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.enemy-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.84rem;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.combat-log {
  margin-top: 10px;
  font-size: 0.78rem;
  color: var(--accent);
}

.btn-flee {
  margin-top: 10px;
  width: 100%;
  border-radius: 6px;
  border: 1px solid var(--danger-border);
  color: var(--danger);
  background: var(--danger-bg);
  font-family: var(--font-mono);
  cursor: pointer;
  padding: 8px 10px;
}

.btn-flee:hover {
  background: var(--danger-border);
}

.btn-loot,
.btn-exit {
  width: 100%;
  border-radius: 6px;
  border: 1px solid var(--border);
  font-family: var(--font-mono);
  cursor: pointer;
  padding: 9px 12px;
}

.btn-loot {
  color: var(--accent);
  border-color: var(--accent);
  background: transparent;
}

.btn-loot:hover {
  background: var(--accent-subtle);
}

.btn-exit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.loot-progress-wrap {
  margin-top: 6px;
}

.loot-progress-text {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.loot-progress-track {
  height: 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  overflow: hidden;
  background: var(--bg-base);
}

.loot-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.06s linear;
}

.ground-box {
  margin-top: 10px;
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.02);
  padding: 8px;
}

.ground-title {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.ground-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--ground-cols), 34px);
  grid-template-rows: repeat(var(--ground-rows), 34px);
  width: max-content;
  margin-inline: auto;
  border: 1px solid var(--border);
  background: var(--bg-base);
}

.ground-cell {
  width: 34px;
  height: 34px;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.ground-item {
  position: absolute;
  border: 1px solid rgba(188, 188, 188, 0.35);
  background: rgba(45, 38, 27, 0.9);
  overflow: hidden;
  cursor: grab;
}

.ground-item-fit {
  position: absolute;
  inset: 0;
}

.ground-item-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0.8;
  display: block;
}

.ground-item-name {
  position: absolute;
  left: 4px;
  bottom: 3px;
  font-size: 10px;
  color: #f3f3f3;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}

.btn-exit {
  margin-top: auto;
  color: var(--danger);
  border-color: var(--danger-border);
  background: var(--danger-bg);
}

.btn-exit:hover {
  background: var(--danger-border);
}
</style>
