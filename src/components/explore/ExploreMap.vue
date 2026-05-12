<template>
  <div class="explore-map-wrap">
    <div class="explore-grid" :style="gridStyle">
      <template v-for="row in store.rows" :key="row">
        <div
          v-for="col in store.cols"
          :key="`${row}-${col}`"
          class="map-cell"
          :class="cellClass(row - 1, col - 1)"
          :style="cellStyle(row - 1, col - 1)"
          @click="handleCellClick(row - 1, col - 1)"
        >
          <div
            v-if="shouldShowDoor(row - 1, col - 1, 'N')"
            class="door door--n"
          />
          <div
            v-if="shouldShowDoor(row - 1, col - 1, 'S')"
            class="door door--s"
          />
          <div
            v-if="shouldShowDoor(row - 1, col - 1, 'W')"
            class="door door--w"
          />
          <div
            v-if="shouldShowDoor(row - 1, col - 1, 'E')"
            class="door door--e"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useExploreStore } from '../../stores/exploreStore'

type Dir = 'N' | 'S' | 'E' | 'W'

const store = useExploreStore()

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${store.cols}, var(--room-cell-size))`,
}))

const DIR_OFFSET: Record<Dir, { dr: number; dc: number }> = {
  N: { dr: -1, dc: 0 },
  S: { dr: 1, dc: 0 },
  E: { dr: 0, dc: 1 },
  W: { dr: 0, dc: -1 },
}

const OPPOSITE: Record<Dir, Dir> = {
  N: 'S',
  S: 'N',
  E: 'W',
  W: 'E',
}

function getRoomId(row: number, col: number): string | undefined {
  return store.cellRoomMap[`${row},${col}`]
}

function isVisibleRoom(roomId: string | undefined): boolean {
  return !!roomId && store.visibleRoomIds.includes(roomId)
}

function isCurrentRoom(roomId: string | undefined): boolean {
  return !!roomId && roomId === store.currentRoomId
}

function inSameRoom(row: number, col: number, dir: Dir): boolean {
  const roomId = getRoomId(row, col)
  if (!roomId) return false
  const offset = DIR_OFFSET[dir]
  const neighborId = getRoomId(row + offset.dr, col + offset.dc)
  return neighborId === roomId
}

function hasConnection(row: number, col: number, dir: Dir): boolean {
  const roomId = getRoomId(row, col)
  if (!roomId) return false
  const offset = DIR_OFFSET[dir]
  const neighborId = getRoomId(row + offset.dr, col + offset.dc)
  if (!neighborId || neighborId === roomId) return false
  return store.connections.some(c => {
    const direct = c.roomA === roomId && c.roomB === neighborId
    const reverse = c.roomA === neighborId && c.roomB === roomId
    if (!direct && !reverse) return false

    const forwardMatch = c.row === row && c.col === col && c.direction === dir
    const backwardMatch =
      c.row === row + offset.dr &&
      c.col === col + offset.dc &&
      c.direction === OPPOSITE[dir]

    return forwardMatch || backwardMatch
  })
}

function shouldShowDoor(row: number, col: number, dir: Dir): boolean {
  const roomId = getRoomId(row, col)
  if (!isVisibleRoom(roomId)) return false
  const offset = DIR_OFFSET[dir]
  const neighborId = getRoomId(row + offset.dr, col + offset.dc)
  if (!isVisibleRoom(neighborId)) return false
  return hasConnection(row, col, dir)
}

function cellStyle(row: number, col: number): Record<string, string> {
  const roomId = getRoomId(row, col)
  if (!isVisibleRoom(roomId)) return {}

  const baseWall = 'var(--border)'
  const borderTop = inSameRoom(row, col, 'N') ? 'transparent' : baseWall
  const borderBottom = inSameRoom(row, col, 'S') ? 'transparent' : baseWall
  const borderLeft = inSameRoom(row, col, 'W') ? 'transparent' : baseWall
  const borderRight = inSameRoom(row, col, 'E') ? 'transparent' : baseWall

  // Current room highlight should follow the outer contour only.
  const currentOutline = isCurrentRoom(roomId) ? 'var(--accent-dim)' : 'transparent'
  const outlineTop = inSameRoom(row, col, 'N') ? 'transparent' : currentOutline
  const outlineBottom = inSameRoom(row, col, 'S') ? 'transparent' : currentOutline
  const outlineLeft = inSameRoom(row, col, 'W') ? 'transparent' : currentOutline
  const outlineRight = inSameRoom(row, col, 'E') ? 'transparent' : currentOutline

  return {
    borderTopColor: borderTop,
    borderBottomColor: borderBottom,
    borderLeftColor: borderLeft,
    borderRightColor: borderRight,
    boxShadow: `inset 0 2px 0 ${outlineTop}, inset 0 -2px 0 ${outlineBottom}, inset 2px 0 0 ${outlineLeft}, inset -2px 0 0 ${outlineRight}`,
  }
}

function cellClass(row: number, col: number): Record<string, boolean> {
  const roomId = getRoomId(row, col)
  if (!roomId || !isVisibleRoom(roomId)) {
    return { 'map-cell--hidden': true }
  }

  const room = store.rooms.find(r => r.instanceId === roomId)
  const visited = room?.visited ?? false

  return {
    'map-cell--hidden': false,
    'map-cell--current': isCurrentRoom(roomId),
    'map-cell--visited': visited && !isCurrentRoom(roomId),
    'map-cell--danger':
      !!room &&
      room.defId !== 'entry' &&
      !!room.dangerKnown &&
      (room.escapedFromCombat || !room.combatResolved),
    'map-cell--reachable':
      store.mode === 'explore' && store.adjacentRoomIds.includes(roomId) && !isCurrentRoom(roomId),
  }
}

function handleCellClick(row: number, col: number): void {
  if (store.mode !== 'explore') return
  const roomId = getRoomId(row, col)
  if (!roomId || !isVisibleRoom(roomId)) return
  if (store.adjacentRoomIds.includes(roomId) && roomId !== store.currentRoomId) {
    store.moveToRoom(roomId)
  }
}
</script>

<style scoped>
.explore-map-wrap {
  width: 100%;
  height: 100%;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.explore-grid {
  --room-cell-size: 52px;
  display: grid;
  gap: 0;
  background: transparent;
  flex-shrink: 0;
}

.map-cell {
  position: relative;
  width: var(--room-cell-size);
  height: var(--room-cell-size);
  border: 2px solid transparent;
  background: rgba(255, 255, 255, 0.04);
  transition: background 0.12s ease, box-shadow 0.12s ease;
}

.map-cell--hidden {
  background: transparent;
  border-color: transparent !important;
  pointer-events: none;
}

.map-cell--visited {
  background: rgba(255, 255, 255, 0.1);
}

.map-cell--reachable {
  background: rgba(255, 255, 255, 0.14);
  cursor: pointer;
}

.map-cell--current {
  background: var(--accent-subtle);
}

.map-cell--danger {
  background: rgba(255, 80, 80, 0.18);
}

.map-cell--reachable:hover {
  background: rgba(255, 255, 255, 0.2);
}

.door {
  position: absolute;
  background: var(--bg-deep);
  z-index: 2;
}

.door--n,
.door--s {
  width: 16px;
  height: 4px;
  left: 50%;
  margin-left: -8px;
}

.door--n {
  top: -2px;
}

.door--s {
  bottom: -2px;
}

.door--w,
.door--e {
  width: 4px;
  height: 16px;
  top: 50%;
  margin-top: -8px;
}

.door--w {
  left: -2px;
}

.door--e {
  right: -2px;
}
</style>
