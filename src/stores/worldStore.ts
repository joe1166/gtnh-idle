// ============================================================
// 世界/探索 Store — 管理当前维度、群系、场景节点交互状态
// ============================================================

import { defineStore } from 'pinia'
import { db } from '../data/db'
import { useInventoryStore } from './inventoryStore'
import { useToolStore } from './toolStore'
import type { DimensionDef, BiomeDef, BiomeNodeDef } from '../data/types'

/** timed 节点的运行时状态 */
export interface TimedNodeState {
  startAt: number   // 开始时间戳（ms）
  endAt: number     // 结束时间戳（ms）
  done: boolean     // true = 计时完毕，等待玩家点击领取
}

export const useWorldStore = defineStore('world', {
  state: () => ({
    currentDimensionId: 'overworld' as string,
    currentBiomeId:     'plains'    as string,
    /** 已发现的群系 ID 列表 */
    discoveredBiomeIds: ['plains'] as string[],
    /** click 节点防连点：记录每个节点最后点击时间（ms） */
    lastClickTime: {} as Record<string, number>,
    /** timed 节点运行时状态 */
    timedNodes: {} as Record<string, TimedNodeState>,
    /** 已被玩家发现（点击热区后）的隐藏节点 ID 列表 */
    revealedNodeIds: [] as string[],
  }),

  getters: {
    currentDimension(state): DimensionDef | undefined {
      return db.get('dimensions', state.currentDimensionId)
    },

    currentBiome(state): BiomeDef | undefined {
      return db.get('biomes', state.currentBiomeId)
    },

    /** 当前维度的探索消耗 */
    exploreCost(): { resourceId: string; amount: number }[] {
      const dim = this.currentDimension
      return dim?.exploreCost ?? []
    },

    /** 当前维度所有可探索的群系（含权重） */
    explorePool(): { biomeId: string; weight: number }[] {
      const dim = this.currentDimension
      return dim?.explorePool ?? []
    },

    /** 当前群系的所有资源节点（按 nodeIds 顺序，不含找不到的节点） */
    currentNodes(state): BiomeNodeDef[] {
      const biome = db.get('biomes', state.currentBiomeId)
      if (!biome) return []
      return biome.nodeIds
        .map(id => db.get('biome_nodes', id))
        .filter((n): n is BiomeNodeDef => n !== undefined)
    },

    /** 当前可见节点：非隐藏 + 已发现的隐藏节点 */
    visibleNodes(state): BiomeNodeDef[] {
      const biome = db.get('biomes', state.currentBiomeId)
      if (!biome) return []
      return biome.nodeIds
        .map(id => db.get('biome_nodes', id))
        .filter((n): n is BiomeNodeDef => n !== undefined)
        .filter(n => !n.hidden || state.revealedNodeIds.includes(n.id))
    },

    /** 当前未被发现的隐藏节点（需渲染 SVG 热区） */
    hiddenNodes(state): BiomeNodeDef[] {
      const biome = db.get('biomes', state.currentBiomeId)
      if (!biome) return []
      return biome.nodeIds
        .map(id => db.get('biome_nodes', id))
        .filter((n): n is BiomeNodeDef => n !== undefined)
        .filter(n => n.hidden && !state.revealedNodeIds.includes(n.id))
    },
  },

  actions: {
    /**
     * 点击 click 类型节点，给予资源。
     * 内置 10ms 防连点，返回实际给予数量（0 = 被节流或节点不存在或能力不足）。
     */
    clickNode(nodeId: string): number {
      const node = db.get('biome_nodes', nodeId)
      if (!node || node.type !== 'click') return 0

      const now = Date.now()
      if (now - (this.lastClickTime[nodeId] ?? 0) < 10) return 0

      this.lastClickTime[nodeId] = now

      const toolStore = useToolStore()

      // 检查能力门槛
      if (node.requiredAbility && node.requiredAbilityValue !== undefined) {
        const playerAbility = toolStore.getAbility(node.requiredAbility)
        if (playerAbility < node.requiredAbilityValue) return 0
      }

      // 计算产出
      let amount = node.amount
      if (node.requiredAbility && node.requiredAbilityValue !== undefined) {
        const playerAbility = toolStore.getAbility(node.requiredAbility)
        if (playerAbility > node.requiredAbilityValue) {
          // 超出门槛越多，产出越多
          amount += Math.floor((playerAbility - node.requiredAbilityValue) / 10)
        }
      }

      useInventoryStore().addItem(node.resourceId, amount)
      return amount
    },

    /**
     * 启动 timed 节点倒计时。
     * 若节点已在运行中则忽略，返回是否成功启动。
     */
    startTimedNode(nodeId: string): boolean {
      const node = db.get('biome_nodes', nodeId)
      if (!node || node.type !== 'timed' || !node.durationSec) return false

      const state = this.timedNodes[nodeId]
      if (state && !state.done) return false   // 已在运行

      const now = Date.now()
      this.timedNodes[nodeId] = {
        startAt: now,
        endAt:   now + node.durationSec * 1000,
        done:    false,
      }
      return true
    },

    /**
     * 玩家点击「领取」：给予资源并重置状态（允许再次触发）。
     * 返回实际给予数量（0 = 节点未完成或不存在）。
     */
    claimTimedNode(nodeId: string): number {
      const state = this.timedNodes[nodeId]
      if (!state?.done) return 0

      const node = db.get('biome_nodes', nodeId)
      if (!node) return 0

      // 重置为可再次触发
      delete this.timedNodes[nodeId]
      useInventoryStore().addItem(node.resourceId, node.amount)
      return node.amount
    },

    /**
     * 玩家点击隐藏热区，将该节点标记为已发现。
     */
    revealNode(nodeId: string): void {
      if (!this.revealedNodeIds.includes(nodeId)) {
        this.revealedNodeIds.push(nodeId)
      }
    },

    /**
     * 每秒由游戏循环调用：检查 timed 节点是否计时完毕，标记 done。
     * 资源不在此处给予，由玩家主动点击「领取」触发。
     */
    tick(): void {
      const now = Date.now()
      for (const [nodeId, state] of Object.entries(this.timedNodes)) {
        if (!state.done && now >= state.endAt) {
          this.timedNodes[nodeId] = { ...state, done: true }
        }
      }
    },

    /**
     * 切换到指定群系（必须已发现）
     */
    switchBiome(biomeId: string): boolean {
      if (!this.discoveredBiomeIds.includes(biomeId)) return false
      this.currentBiomeId = biomeId
      return true
    },

    /**
     * 探索新群系
     * 1. 扣除探索消耗
     * 2. 按权重随机抽取一个群系
     * 3. 如果是已发现的群系，只切换过去
     * 4. 如果是新群系，加入已发现列表并切换
     * 返回 { success: boolean, biomeId: string, isNew: boolean }
     */
    exploreBiome(): { success: boolean; biomeId: string; isNew: boolean } {
      const cost = this.exploreCost
      const pool = this.explorePool

      // 检查消耗是否足够
      const inventory = useInventoryStore()
      for (const c of cost) {
        if (inventory.getAmount(c.resourceId) < c.amount) {
          return { success: false, biomeId: '', isNew: false }
        }
      }

      // 扣除消耗
      inventory.spend(cost)

      // 按权重随机抽取
      const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0)
      let roll = Math.random() * totalWeight
      let selectedBiomeId = pool[0].biomeId
      for (const entry of pool) {
        roll -= entry.weight
        if (roll <= 0) {
          selectedBiomeId = entry.biomeId
          break
        }
      }

      // 检查是否是新群系
      const isNew = !this.discoveredBiomeIds.includes(selectedBiomeId)
      if (isNew) {
        this.discoveredBiomeIds.push(selectedBiomeId)
      }

      // 切换到该群系
      this.currentBiomeId = selectedBiomeId

      return { success: true, biomeId: selectedBiomeId, isNew }
    },
  },
})
