// ============================================================
// 矿洞探索 Store — 管理矿洞小游戏的全部状态与逻辑
// ============================================================

import { defineStore } from 'pinia'
import { db } from '../data/db'
import { useInventoryStore } from './inventoryStore'
import { useToolStore } from './toolStore'
import { applyReward } from '../utils/rewards'
import type { MineCell, MineVeinDef, MineStratum, ProspectorResult } from '../data/types'

// ─── LCG 伪随机数生成器（可种子复现）────────────────────────

function makePRNG(seed: number) {
  let s = seed >>> 0
  return (): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0xFFFFFFFF
  }
}

// ─── 矿脉计数器（全局，每次 generateMap 重置）───────────────

let veinCounter = 0

export const useMineStore = defineStore('mine', {
  state: () => ({
    caveId:  '' as string,
    grid:    [] as MineCell[],
    rows:    20,
    cols:    20,
    stamina: 0,
    maxStamina: 50,
    entered: false,
    seed:    0,
    prospectorResult: null as ProspectorResult | null,
    prospectorCooldown: 0,
    sessionLoot:    {} as Record<string, number>,
    exitDialogOpen: false,
  }),

  getters: {
    /** 获取指定格子（越界返回 null） */
    getCell: (state) => (row: number, col: number): MineCell | null => {
      if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return null
      return state.grid[row * state.cols + col] ?? null
    },

    /** 某格子是否与已挖且可到达的格子相邻 */
    isAdjacent: (state) => (row: number, col: number): boolean => {
      const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]]
      for (const [dr, dc] of dirs) {
        const r = row + dr, c = col + dc
        if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) continue
        const cell = state.grid[r * state.cols + c]
        if (cell?.dug && cell.reachable) return true
      }
      return false
    },

    /** 玩家的 mining_ability 是否满足方块要求 */
    canDig: () => (blockId: string): boolean => {
      const def = db.get('mine_blocks', blockId)
      if (!def) return false
      return useToolStore().getAbility('mining_ability') >= def.requiredMiningAbility
    },

    /** 所有已挖且可到达格坐标列表（用于探矿仪中心点） */
    dugCells: (state): { row: number; col: number }[] => {
      const result: { row: number; col: number }[] = []
      for (let i = 0; i < state.grid.length; i++) {
        const cell = state.grid[i]
        if (cell.dug && cell.reachable) {
          result.push({ row: Math.floor(i / state.cols), col: i % state.cols })
        }
      }
      return result
    },
  },

  actions: {
    /** 进入矿洞：从 cave config 读取参数，生成新地图，重置体力 */
    enter(caveId: string): void {
      const caveDef = db.get('mine_caves', caveId)
      if (!caveDef) return
      this.caveId     = caveId
      this.rows       = caveDef.rows
      this.cols       = caveDef.cols
      this.maxStamina = caveDef.maxStamina
      this.seed       = Date.now()
      this.stamina    = this.maxStamina
      this.entered    = true
      this.prospectorResult   = null
      this.prospectorCooldown = 0
      this.sessionLoot        = {}
      this.exitDialogOpen     = false
      this.generateMap()
    },

    /** 退出矿洞（直接退出，不经弹窗） */
    exit(): void {
      this.entered = false
    },

    /** 打开离开确认弹窗 */
    openExitDialog(): void {
      this.exitDialogOpen = true
    },

    /** 关闭弹窗但不离开 */
    cancelExitDialog(): void {
      this.exitDialogOpen = false
    },

    /** 确认离开矿洞 */
    confirmExit(): void {
      this.exitDialogOpen = false
      this.entered        = false
    },

    /** 生成矿洞地图（配置驱动：深度分层底色 + 独立 roll 矿脉） */
    generateMap(): void {
      const { rows, cols, caveId } = this
      const rand = makePRNG(this.seed)
      veinCounter = 0

      const caveDef = db.get('mine_caves', caveId)!
      const strata  = caveDef.strata as MineStratum[]
      const veinDefs = caveDef.veinIds
        .map(id => db.get('mine_veins', id))
        .filter((v): v is MineVeinDef => v !== undefined)

      const idx = (r: number, c: number) => r * cols + c

      // Step 1: 按深度分层填充底色石头，重叠区域用 LCG 概率过渡
      const grid: MineCell[] = Array.from({ length: rows * cols }, (_, i) => {
        const row = Math.floor(i / cols)
        const depthRatio = row / rows
        const matching = strata.filter(s => depthRatio >= s.depthMin && depthRatio < s.depthMax)
        let blockId: string
        if (matching.length === 0) {
          blockId = strata[strata.length - 1]?.blockId ?? 'stone'
        } else if (matching.length === 1) {
          blockId = matching[0].blockId
        } else {
          // 重叠过渡带：matching[0]=上层（depthMin更小），matching[1]=下层
          const upper = matching[0], lower = matching[matching.length - 1]
          const overlapStart = lower.depthMin
          const overlapEnd   = upper.depthMax
          const prob = overlapEnd > overlapStart
            ? (depthRatio - overlapStart) / (overlapEnd - overlapStart)
            : 0.5
          blockId = rand() < prob ? lower.blockId : upper.blockId
        }
        return { blockId, dug: false, veinId: null, reachable: false }
      })

      // Step 1.5: 底部基岩过渡（最后一行100%基岩，往上4行逐渐减少）
      const bedrockRows = 5
      for (let r = rows - bedrockRows; r < rows; r++) {
        // depthFromBottom: 0 = 最底行，1 = 倒数第二行，...
        const depthFromBottom = rows - 1 - r
        const prob = depthFromBottom === 0 ? 1.0 : 1.0 - depthFromBottom * 0.2
        for (let c = 0; c < cols; c++) {
          if (rand() < prob) {
            grid[idx(r, c)].blockId = 'bedrock'
            grid[idx(r, c)].veinId  = null
          }
        }
      }

      // Step 2: 起始格（第0行中央）已挖且可到达
      const startCell = grid[idx(0, Math.floor(cols / 2))]
      startCell.dug       = true
      startCell.reachable = true

      // Step 3: 逐行逐矿独立 roll 矿脉（各矿脉有自己的深度范围和 spawnRate）
      const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]]
      for (let r = 0; r < rows; r++) {
        const depthRatio = r / rows
        for (const vein of veinDefs) {
          if (depthRatio < vein.depthMin || depthRatio >= vein.depthMax) continue
          if (rand() > vein.spawnRate) continue

          const startC   = Math.floor(rand() * cols)
          const veinSize = vein.veinSizeMin + Math.floor(rand() * (vein.veinSizeMax - vein.veinSizeMin + 1))
          const veinId   = `vein_${++veinCounter}`

          // BFS 膨胀
          const queue: [number, number][] = [[r, startC]]
          let filled = 0
          while (queue.length > 0 && filled < veinSize) {
            const [qr, qc] = queue.shift()!
            if (qr < 0 || qr >= rows || qc < 0 || qc >= cols) continue
            const cell = grid[idx(qr, qc)]
            if (cell.veinId !== null) continue
            if (cell.blockId === 'bedrock') continue
            if (vein.forbidBlocks.includes(cell.blockId)) continue

            cell.blockId = vein.blockId
            cell.veinId  = veinId
            filled++

            for (const [dr, dc] of dirs) {
              if (rand() < 0.6) queue.push([qr + dr, qc + dc])
            }
          }
        }
      }

      // Step 4: 废弃通道（数量从 caveDef 读取）
      const tunnelCount = caveDef.tunnelCountMin +
        Math.floor(rand() * (caveDef.tunnelCountMax - caveDef.tunnelCountMin + 1))
      for (let t = 0; t < tunnelCount; t++) {
        const tr   = 3 + Math.floor(rand() * (rows - 5))
        const tc   = Math.floor(rand() * (cols - 5))
        const tLen = 3 + Math.floor(rand() * 3)
        for (let i = 0; i < tLen && tc + i < cols; i++) {
          const cell = grid[idx(tr, tc + i)]
          if (!cell.dug) {
            cell.blockId   = 'abandoned_tunnel'
            cell.dug       = true
            cell.reachable = false
          }
        }
      }

      this.grid = grid
    },

    /** 玩家点击格子尝试挖掘 */
    digCell(row: number, col: number): void {
      const cell = this.getCell(row, col)
      if (!cell || cell.dug) return
      if (!this.isAdjacent(row, col)) return
      if (this.stamina <= 0) return

      const def = db.get('mine_blocks', cell.blockId)
      if (!def) return
      if (!this.canDig(cell.blockId)) return

      cell.dug       = true
      cell.reachable = true
      this.stamina--

      // BFS 传播可到达性：挖通到废弃通道时打通连通性
      const reachQueue: [number, number][] = [[row, col]]
      while (reachQueue.length > 0) {
        const [qr, qc] = reachQueue.shift()!
        const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]]
        for (const [dr, dc] of dirs) {
          const neighbor = this.getCell(qr + dr, qc + dc)
          if (!neighbor || !neighbor.dug || neighbor.reachable) continue
          neighbor.reachable = true
          reachQueue.push([qr + dr, qc + dc])
        }
      }

      // 记录本次收获
      const gains = applyReward(def.rewardId)
      const inv = useInventoryStore()
      for (const [resId, amt] of Object.entries(gains)) {
        inv.addItem(resId, amt)
        this.sessionLoot[resId] = (this.sessionLoot[resId] ?? 0) + amt
      }

      // 体力耗尽时自动弹出结算弹窗
      if (this.stamina <= 0) {
        this.exitDialogOpen = true
      }
    },

    /** 使用道具回复体力（resourceId 为背包中的道具） */
    useStaminaItem(resourceId: string, restoreAmount: number): void {
      const inv = useInventoryStore()
      if (inv.getAmount(resourceId) < 1) return
      inv.spend([{ resourceId, amount: 1 }])
      this.stamina = Math.min(this.maxStamina, this.stamina + restoreAmount)
    },

    /** 吃一个食物道具，直接加体力（溢出部分丢弃） */
    useFoodItem(resourceId: string): void {
      if (this.stamina >= this.maxStamina) return
      const inv = useInventoryStore()
      if (inv.getAmount(resourceId) < 1) return
      const resDef = db.get('resources', resourceId)
      if (!resDef) return
      inv.spend([{ resourceId, amount: 1 }])
      this.stamina = Math.min(this.maxStamina, this.stamina + (resDef.foodPoints ?? 0))
    },

    /** 使用探矿仪扫描 */
    useProspector(): void {
      if (this.prospectorCooldown > 0) return
      const prospectorLevel = useToolStore().levels['prospector'] ?? 0
      if (prospectorLevel <= 0) return

      const radii = [0, 3, 5, 8]
      const radius = radii[prospectorLevel] ?? 3

      // 找最深已挖格作为扫描中心
      const dugged = this.dugCells
      if (dugged.length === 0) return
      const center = dugged.reduce((a, b) => (a.row > b.row ? a : b))

      // 扫描半径内未挖矿石格
      const oreBlocks: { row: number; col: number; blockId: string; dist: number }[] = []
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const r = center.row + dr
          const c = center.col + dc
          const cell = this.getCell(r, c)
          if (!cell || cell.dug) continue
          const def = db.get('mine_blocks', cell.blockId)
          if (!def || def.category !== 'ore') continue
          oreBlocks.push({ row: r, col: c, blockId: cell.blockId, dist: Math.abs(dr) + Math.abs(dc) })
        }
      }

      oreBlocks.sort((a, b) => a.dist - b.dist)
      const count   = oreBlocks.length
      const nearest = oreBlocks[0] ?? null

      this.prospectorResult = {
        nearestBlockId: nearest?.blockId ?? null,
        abundance: count >= 5 ? 'rich' : count >= 3 ? 'moderate' : count >= 1 ? 'scarce' : 'empty',
        nearestRow: nearest?.row ?? null,
        nearestCol: nearest?.col ?? null,
      }

      this.stamina = Math.max(0, this.stamina - 1)
      this.prospectorCooldown = 3
    },

    /** 每秒游戏循环调用：递减探矿仪冷却 */
    tick(): void {
      if (this.prospectorCooldown > 0) this.prospectorCooldown--
    },
  },
})
