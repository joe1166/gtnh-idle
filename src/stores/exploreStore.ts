import { defineStore } from 'pinia'
import { db } from '../data/db'
import { useInventoryStore } from './inventoryStore'
import { applyReward } from '../utils/rewards'
import { t } from '../data/i18n'
import type {
  ExploreRoom,
  ExploreConnection,
  ExploreCombatEnemy,
  ExploreEventNodeDef,
} from '../data/types'

function makePRNG(seed: number) {
  let s = seed >>> 0
  return (): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0xFFFFFFFF
  }
}

const DIRS = [
  { dir: 'N' as const, dr: -1, dc: 0 },
  { dir: 'S' as const, dr: 1, dc: 0 },
  { dir: 'E' as const, dr: 0, dc: 1 },
  { dir: 'W' as const, dr: 0, dc: -1 },
]

const OPPOSITE: Record<string, string> = { N: 'S', S: 'N', E: 'W', W: 'E' }

function makeUnionFind(n: number) {
  const parent = Array.from({ length: n }, (_, i) => i)
  const rank = new Array<number>(n).fill(0)
  const size = new Array<number>(n).fill(1)

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }

  function union(a: number, b: number): boolean {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return false
    if (rank[ra] < rank[rb]) {
      parent[ra] = rb
      size[rb] += size[ra]
    } else if (rank[ra] > rank[rb]) {
      parent[rb] = ra
      size[ra] += size[rb]
    } else {
      parent[rb] = ra
      size[ra] += size[rb]
      rank[ra]++
    }
    return true
  }

  function getSize(x: number): number {
    return size[find(x)]
  }

  return { find, union, getSize }
}

function pickEnemyCount(min: number, max: number): number {
  if (max <= min) return min
  return min + Math.floor(Math.random() * (max - min + 1))
}

function sampleByWeight<T extends { weight: number }>(items: T[], rng: () => number): T | null {
  const total = items.reduce((s, i) => s + i.weight, 0)
  if (total <= 0) return null
  let roll = rng() * total
  for (const item of items) {
    roll -= item.weight
    if (roll <= 0) return item
  }
  return items[0] ?? null
}

let roomCounter = 0

export const useExploreStore = defineStore('explore', {
  state: () => ({
    mapId: '' as string,
    rows: 0,
    cols: 0,
    rooms: [] as ExploreRoom[],
    connections: [] as ExploreConnection[],
    cellRoomMap: {} as Record<string, string>,
    currentRoomId: null as string | null,
    entered: false,
    mode: 'explore' as 'explore' | 'event' | 'combat' | 'result',
    hp: 100,
    maxHp: 100,
    playerAttack: 9,
    playerDefense: 2,
    playerSpeed: 6,
    combatTickMs: 1000,
    combatElapsedMs: 0,
    currentRoundLog: '' as string,
    previousRoomId: null as string | null,
    seed: 0,
    visitedRoomIds: [] as string[],
    sessionLoot: {} as Record<string, number>,
    exitDialogOpen: false,
    defeatDialogOpen: false,
  }),

  getters: {
    currentRoom(state): ExploreRoom | undefined {
      return state.rooms.find(r => r.instanceId === state.currentRoomId)
    },

    adjacentRoomIds(state): string[] {
      if (!state.currentRoomId) return []
      return state.connections
        .filter(c => c.roomA === state.currentRoomId || c.roomB === state.currentRoomId)
        .map(c => (c.roomA === state.currentRoomId ? c.roomB : c.roomA))
    },

    hasLoot(state): boolean {
      return Object.keys(state.sessionLoot).length > 0
    },

    visibleRoomIds(state): string[] {
      const ids = new Set<string>()
      if (state.currentRoomId) ids.add(state.currentRoomId)
      for (const id of state.visitedRoomIds) ids.add(id)
      for (const id of this.adjacentRoomIds) ids.add(id)
      return Array.from(ids)
    },

    currentEventNode(): ExploreEventNodeDef | undefined {
      const room = this.currentRoom
      if (!room?.eventNodeId) return undefined
      return db.get('explore_events', room.eventNodeId)
    },
  },

  actions: {
    enter(mapId: string): void {
      const mapDef = db.get('explore_maps', mapId)
      if (!mapDef) return

      roomCounter = 0
      this.mapId = mapId
      this.rows = mapDef.rows
      this.cols = mapDef.cols
      this.seed = Date.now()
      this.rooms = []
      this.connections = []
      this.cellRoomMap = {}
      this.currentRoomId = null
      this.entered = false
      this.mode = 'explore'
      this.hp = this.maxHp
      this.combatElapsedMs = 0
      this.currentRoundLog = ''
      this.previousRoomId = null
      this.visitedRoomIds = []
      this.sessionLoot = {}
      this.exitDialogOpen = false
      this.defeatDialogOpen = false

      this.generateMap()
      this.entered = true
      this.enterCurrentRoomContext()
    },

    generateMap(): void {
      const mapDef = db.get('explore_maps', this.mapId)
      if (!mapDef) return

      const { rows, cols, voidRate, cycleEdgeRate, mergeProb, maxMergeSize } = mapDef
      const rand = makePRNG(this.seed)
      const n = rows * cols
      const idx = (r: number, c: number) => r * cols + c

      const locked = new Array<boolean>(n).fill(false)
      const doorConstraints = new Array<Set<string> | null>(n).fill(null)

      for (const fr of mapDef.fixedRooms) {
        const roomDef = db.get('explore_rooms', fr.roomDefId)
        if (!roomDef) continue

        const allowedSet = fr.allowedDoors
          ? new Set(fr.allowedDoors.split(',').map(d => d.trim()).filter(Boolean))
          : null

        const shapeCells = roomDef.shape.length > 0
          ? roomDef.shape.map(s => ({ row: fr.anchorRow + s.dRow, col: fr.anchorCol + s.dCol }))
          : [{ row: fr.anchorRow, col: fr.anchorCol }]

        const instanceId = `fixed_${++roomCounter}`
        const cells: { row: number; col: number }[] = []
        for (const { row, col } of shapeCells) {
          if (row < 0 || row >= rows || col < 0 || col >= cols) continue
          const i = idx(row, col)
          locked[i] = true
          if (allowedSet) doorConstraints[i] = allowedSet
          cells.push({ row, col })
        }

        this.rooms.push({
          instanceId,
          defId: fr.roomDefId,
          cells,
          visited: false,
          looted: false,
          eventDone: false,
          combatSpawned: false,
          combatResolved: false,
          dangerKnown: false,
          escapedFromCombat: false,
        })
        for (const c of cells) this.cellRoomMap[`${c.row},${c.col}`] = instanceId
      }

      const voidCells = new Array<boolean>(n).fill(false)
      for (let i = 0; i < n; i++) if (!locked[i] && rand() < voidRate) voidCells[i] = true

      const adjEdges: Set<number>[] = Array.from({ length: n }, () => new Set())

      const [entryRow, entryCol] = mapDef.entryPos.split(':').map(Number)
      const entryIdx = idx(entryRow, entryCol)
      voidCells[entryIdx] = false

      const visited = new Array<boolean>(n).fill(false)
      const frontier: Array<{ from: number; to: number; dir: string }> = []

      const addFrontiers = (i: number) => {
        const r = Math.floor(i / cols)
        const c = i % cols
        for (const { dir, dr, dc } of DIRS) {
          const nr = r + dr
          const nc = c + dc
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
          const j = idx(nr, nc)
          if (!visited[j] && !voidCells[j]) frontier.push({ from: i, to: j, dir })
        }
      }

      const canConnect = (fromIdx: number, toIdx: number, dir: string): boolean => {
        const fromConstraint = doorConstraints[fromIdx]
        if (fromConstraint && !fromConstraint.has(dir)) return false
        const toConstraint = doorConstraints[toIdx]
        if (toConstraint && !toConstraint.has(OPPOSITE[dir])) return false
        return true
      }

      visited[entryIdx] = true
      addFrontiers(entryIdx)
      while (frontier.length > 0) {
        const pickIdx = Math.floor(rand() * frontier.length)
        const { from, to, dir } = frontier.splice(pickIdx, 1)[0]
        if (visited[to]) continue
        if (!canConnect(from, to, dir)) continue
        visited[to] = true
        adjEdges[from].add(to)
        adjEdges[to].add(from)
        addFrontiers(to)
      }

      const allEdges: Array<[number, number, string]> = []
      for (let i = 0; i < n; i++) {
        if (voidCells[i] || !visited[i]) continue
        const r = Math.floor(i / cols)
        const c = i % cols
        for (const { dir, dr, dc } of DIRS) {
          const nr = r + dr
          const nc = c + dc
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
          const j = idx(nr, nc)
          if (j > i && visited[j] && !adjEdges[i].has(j)) allEdges.push([i, j, dir])
        }
      }

      const extraCount = Math.floor(allEdges.length * cycleEdgeRate)
      for (let k = 0; k < extraCount && allEdges.length > 0; k++) {
        const pickIdx = Math.floor(rand() * allEdges.length)
        const [a, b, dir] = allEdges.splice(pickIdx, 1)[0]
        if (!canConnect(a, b, dir)) continue
        adjEdges[a].add(b)
        adjEdges[b].add(a)
      }

      const uf = makeUnionFind(n)
      for (let i = 0; i < n; i++) {
        if (voidCells[i] || !visited[i] || locked[i]) continue
        for (const j of adjEdges[i]) {
          if (j <= i || locked[j]) continue
          if (uf.getSize(i) + uf.getSize(j) > maxMergeSize) continue
          if (rand() >= mergeProb) continue
          uf.union(i, j)
        }
      }

      const rootToInstanceId: Record<number, string> = {}
      for (let i = 0; i < n; i++) {
        if (voidCells[i] || !visited[i] || locked[i]) continue
        const root = uf.find(i)
        if (!rootToInstanceId[root]) rootToInstanceId[root] = `room_${++roomCounter}`
        const instanceId = rootToInstanceId[root]
        const r = Math.floor(i / cols)
        const c = i % cols
        this.cellRoomMap[`${r},${c}`] = instanceId
        let room = this.rooms.find(rm => rm.instanceId === instanceId)
        if (!room) {
          room = {
            instanceId,
            defId: '',
            cells: [],
            visited: false,
            looted: false,
            eventDone: false,
            combatSpawned: false,
            combatResolved: false,
            dangerKnown: false,
            escapedFromCombat: false,
          }
          this.rooms.push(room)
        }
        room.cells.push({ row: r, col: c })
      }

      const entryRoomId = this.cellRoomMap[`${entryRow},${entryCol}`]
      if (entryRoomId) {
        const entryRoom = this.rooms.find(r => r.instanceId === entryRoomId)
        if (entryRoom) {
          entryRoom.defId = 'entry'
          entryRoom.visited = true
          this.currentRoomId = entryRoomId
          this.visitedRoomIds.push(entryRoomId)
        }
      }

      const unassignedRooms = this.rooms.filter(r => r.defId === '')
      const requiredCounts: Record<string, number> = {}
      for (const reqId of mapDef.requiredRoomIds) {
        requiredCounts[reqId] = (requiredCounts[reqId] ?? 0) + 1
      }

      for (const [reqId, requiredCount] of Object.entries(requiredCounts)) {
        const def = db.get('explore_rooms', reqId)
        if (!def) continue

        const existingCount = this.rooms.filter(r => r.defId === reqId).length
        const deficit = Math.max(0, requiredCount - existingCount)
        if (deficit <= 0) continue

        const min = def.minCells ?? 1
        const max = def.maxCells ?? 99
        for (let i = 0; i < deficit; i++) {
          const best = unassignedRooms
            .filter(r => r.cells.length >= min && r.cells.length <= max)
            .sort((a, b) => Math.abs(a.cells.length - min) - Math.abs(b.cells.length - min))[0]
          if (!best) break
          best.defId = reqId
          unassignedRooms.splice(unassignedRooms.indexOf(best), 1)
        }
      }

      const generatableRooms = mapDef.generatableRoomIds
        .map(id => db.get('explore_rooms', id))
        .filter(Boolean)
      const totalWeight = generatableRooms.reduce((s, r) => s + (r?.weight ?? 0), 0)
      for (const room of unassignedRooms) {
        if (totalWeight <= 0) {
          room.defId = 'corridor'
          continue
        }
        let roll = rand() * totalWeight
        for (const def of generatableRooms) {
          roll -= def?.weight ?? 0
          if (roll <= 0 && def) {
            room.defId = def.id
            break
          }
        }
        if (!room.defId) room.defId = generatableRooms[0]?.id ?? 'corridor'
      }

      const addedPairs = new Set<string>()
      for (let i = 0; i < n; i++) {
        if (voidCells[i] || !visited[i]) continue
        const rA = Math.floor(i / cols)
        const cA = i % cols
        const roomA = this.cellRoomMap[`${rA},${cA}`]
        if (!roomA) continue
        for (const j of adjEdges[i]) {
          if (j <= i) continue
          const rB = Math.floor(j / cols)
          const cB = j % cols
          const roomB = this.cellRoomMap[`${rB},${cB}`]
          if (!roomB || roomA === roomB) continue
          const pairKey = roomA < roomB ? `${roomA}__${roomB}` : `${roomB}__${roomA}`
          if (addedPairs.has(pairKey)) continue
          addedPairs.add(pairKey)
          const dr = rB - rA
          const dc = cB - cA
          const dir = DIRS.find(d => d.dr === dr && d.dc === dc)?.dir ?? 'S'
          this.connections.push({ roomA, roomB, row: rA, col: cA, direction: dir })
        }
      }

      for (const room of this.rooms) {
        if (room.defId === 'entry') continue
        const def = db.get('explore_rooms', room.defId)
        if (!def) continue
        room.eventDone = def.type !== 'event'
        room.combatResolved = def.type !== 'combat'
      }
    },

    enterCurrentRoomContext(): void {
      const room = this.currentRoom
      if (!room || room.defId === 'entry') {
        this.mode = 'explore'
        return
      }

      const def = db.get('explore_rooms', room.defId)
      if (!def) {
        this.mode = 'explore'
        return
      }

      if (def.type === 'event' && !room.eventDone) {
        room.eventNodeId = def.eventStartNodeId ?? ''
        this.mode = 'event'
        return
      }

      if (def.type === 'combat' && !room.combatResolved) {
        this.startCombat(room.instanceId)
        return
      }

      this.mode = 'explore'
    },

    moveToRoom(instanceId: string): void {
      if (this.mode !== 'explore') return
      if (!this.adjacentRoomIds.includes(instanceId)) return
      const prevRoomId = this.currentRoomId
      this.currentRoomId = instanceId
      this.previousRoomId = prevRoomId
      const room = this.rooms.find(r => r.instanceId === instanceId)
      if (room && !room.visited) {
        room.visited = true
        this.visitedRoomIds.push(instanceId)
      }
      this.enterCurrentRoomContext()
    },

    lootRoom(instanceId: string): void {
      if (this.mode !== 'explore') return
      const room = this.rooms.find(r => r.instanceId === instanceId)
      if (!room || room.looted) return
      const def = db.get('explore_rooms', room.defId)
      if (!def || !def.rewardId) {
        room.looted = true
        return
      }
      const gains = applyReward(def.rewardId)
      room.roomLoot = {}
      for (const [resId, amount] of Object.entries(gains)) {
        this.sessionLoot[resId] = (this.sessionLoot[resId] ?? 0) + amount
        room.roomLoot[resId] = (room.roomLoot[resId] ?? 0) + amount
      }
      room.looted = true
    },

    advanceEvent(): void {
      const room = this.currentRoom
      if (!room || this.mode !== 'event') return
      const node = room.eventNodeId ? db.get('explore_events', room.eventNodeId) : undefined
      if (!node) {
        room.eventDone = true
        this.mode = 'explore'
        return
      }
      if (node.isTerminal) {
        room.eventDone = true
        room.eventNodeId = undefined
        this.enterCurrentRoomContext()
        return
      }
      if (node.autoNextId) {
        room.eventNodeId = node.autoNextId
        return
      }
    },

    chooseEventOption(option: 'A' | 'B' | 'C'): void {
      const room = this.currentRoom
      if (!room || this.mode !== 'event') return
      const node = room.eventNodeId ? db.get('explore_events', room.eventNodeId) : undefined
      if (!node) return

      const nextId = option === 'A' ? node.optionANextId : option === 'B' ? node.optionBNextId : node.optionCNextId
      const rewardId = option === 'A' ? node.optionARewardId : option === 'B' ? node.optionBRewardId : node.optionCRewardId
      const hpDelta = option === 'A' ? node.optionAHpDelta : option === 'B' ? node.optionBHpDelta : node.optionCHpDelta

      if (rewardId && rewardId > 0) {
        const gains = applyReward(rewardId)
        for (const [resId, amount] of Object.entries(gains)) {
          this.sessionLoot[resId] = (this.sessionLoot[resId] ?? 0) + amount
        }
      }
      if (hpDelta && hpDelta !== 0) {
        this.hp = Math.max(0, Math.min(this.maxHp, this.hp + hpDelta))
      }
      if (this.hp <= 0) {
        this.handleDefeat()
        return
      }

      if (!nextId) {
        room.eventDone = true
        room.eventNodeId = undefined
        this.enterCurrentRoomContext()
        return
      }

      room.eventNodeId = nextId
      const nextNode = db.get('explore_events', nextId)
      if (nextNode?.isTerminal) {
        room.eventDone = true
        room.eventNodeId = undefined
        this.enterCurrentRoomContext()
      }
    },

    startCombat(instanceId: string): void {
      const room = this.rooms.find(r => r.instanceId === instanceId)
      if (!room) return
      const def = db.get('explore_rooms', room.defId)
      if (!def || def.type !== 'combat') {
        this.mode = 'explore'
        return
      }

      if (!room.combatSpawned) {
        const rand = makePRNG(this.seed + room.instanceId.length * 97)
        const pool = def.enemyPool ?? []
        const min = def.enemyCountMin ?? 1
        const max = def.enemyCountMax ?? min
        const count = pickEnemyCount(min, max)
        const enemies: ExploreCombatEnemy[] = []

        for (let i = 0; i < count; i++) {
          const pick = sampleByWeight(pool, rand)
          if (!pick) continue
          const enemyDef = db.get('explore_enemies', pick.enemyId)
          if (!enemyDef) continue
          enemies.push({
            id: enemyDef.id,
            nameLocKey: enemyDef.locKey,
            hp: enemyDef.hp,
            maxHp: enemyDef.hp,
            attack: enemyDef.attack,
            defense: enemyDef.defense,
            speed: enemyDef.speed,
            rewardId: enemyDef.rewardId,
          })
        }

        room.enemies = enemies
        room.combatSpawned = true
      }

      room.dangerKnown = true
      this.mode = 'combat'
      this.combatElapsedMs = 0
      this.currentRoundLog = ''
    },

    fleeCombat(): void {
      const room = this.currentRoom
      if (!room || this.mode !== 'combat') return

      room.dangerKnown = true
      room.escapedFromCombat = true

      const lootEntries = Object.entries(this.sessionLoot).filter(([, amount]) => amount > 0)
      if (lootEntries.length > 0) {
        const dropCount = 1 + Math.floor(Math.random() * lootEntries.length)
        const shuffled = [...lootEntries].sort(() => Math.random() - 0.5)
        for (const [resId] of shuffled.slice(0, dropCount)) {
          delete this.sessionLoot[resId]
        }
      }

      const fallbackRoomId = this.previousRoomId
      if (fallbackRoomId && this.adjacentRoomIds.includes(fallbackRoomId)) {
        this.currentRoomId = fallbackRoomId
      }
      this.mode = 'explore'
      this.combatElapsedMs = 0
      this.currentRoundLog = ''
    },

    tickCombat(): void {
      const room = this.currentRoom
      if (!room || !room.enemies || room.enemies.length === 0) return
      const enemies = room.enemies.filter(e => e.hp > 0)
      if (enemies.length === 0) {
        room.combatResolved = true
        this.mode = 'explore'
        return
      }

      const target = enemies[0]
      const playerFirst = this.playerSpeed >= target.speed
      const hits: string[] = []

      const playerHit = () => {
        const dmg = Math.max(1, this.playerAttack - target.defense)
        target.hp = Math.max(0, target.hp - dmg)
        hits.push(`you -> ${t(target.nameLocKey)} -${dmg}`)
      }

      const enemyHit = () => {
        const aliveEnemy = room.enemies?.find(e => e.hp > 0)
        if (!aliveEnemy) return
        const dmg = Math.max(1, aliveEnemy.attack - this.playerDefense)
        this.hp = Math.max(0, this.hp - dmg)
        hits.push(`${t(aliveEnemy.nameLocKey)} -> you -${dmg}`)
      }

      if (playerFirst) {
        playerHit()
        if (target.hp > 0) enemyHit()
      } else {
        enemyHit()
        if (this.hp > 0) playerHit()
      }

      this.currentRoundLog = hits.join(' | ')

      if (this.hp <= 0) {
        this.handleDefeat()
        return
      }

      const remaining = room.enemies.filter(e => e.hp > 0)
      if (remaining.length === 0) {
        const rewardMap: Record<number, boolean> = {}
        for (const e of room.enemies) {
          if (e.rewardId > 0) rewardMap[e.rewardId] = true
        }
        for (const rewardIdStr of Object.keys(rewardMap)) {
          const gains = applyReward(Number(rewardIdStr))
          for (const [resId, amount] of Object.entries(gains)) {
            this.sessionLoot[resId] = (this.sessionLoot[resId] ?? 0) + amount
          }
        }
        room.combatResolved = true
        room.dangerKnown = !!room.escapedFromCombat
        this.mode = 'explore'
      }
    },

    handleDefeat(): void {
      this.sessionLoot = {}
      this.exitDialogOpen = true
      this.defeatDialogOpen = true
      this.mode = 'result'
    },

    openExitDialog(): void {
      if (this.mode === 'combat') return
      if (this.defeatDialogOpen) return
      this.exitDialogOpen = true
    },

    cancelExitDialog(): void {
      if (this.defeatDialogOpen) return
      this.exitDialogOpen = false
    },

    confirmExit(): void {
      const inv = useInventoryStore()
      for (const [resId, amount] of Object.entries(this.sessionLoot)) {
        inv.addItem(resId, amount)
      }
      this.sessionLoot = {}
      this.exitDialogOpen = false
      this.defeatDialogOpen = false
      this.entered = false
    },

    tick(deltaMs = 1000): void {
      if (this.mode !== 'combat') return
      this.combatElapsedMs += deltaMs
      while (this.combatElapsedMs >= this.combatTickMs) {
        this.combatElapsedMs -= this.combatTickMs
        if (this.mode !== 'combat') break
        this.tickCombat()
      }
    },
  },
})
