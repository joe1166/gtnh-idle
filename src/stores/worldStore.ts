// ============================================================
// 世界/探索 Store — 管理当前维度、群系、场景节点交互状态
// ============================================================

import { defineStore } from 'pinia'
import { db } from '../data/db'
import { useInventoryStore } from './inventoryStore'
import { usePlayerAttrStore } from './playerAttrStore'
import { useMineStore } from './mineStore'
import { useExploreStore } from './exploreStore'
import { applyReward } from '../utils/rewards'
import type { DimensionDef, BiomeDef, BiomeNodeDef, ResourceAmount } from '../data/types'

/** 解析 entryCost 字符串（格式 resourceId:amount|...） */
function parseEntryCost(raw?: string): ResourceAmount[] {
  if (!raw) return []
  return raw.split('|').map(part => {
    const [resourceId, amountStr] = part.split(':')
    return { resourceId: resourceId.trim(), amount: parseInt(amountStr, 10) || 0 }
  }).filter(r => r.resourceId)
}

function calcGatherBonus(level: number): number {
  const lv = Math.max(0, level)
  if (lv <= 5) return 2 ** lv
  return (2 ** 5) * (1.5 ** (lv - 5))
}

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

    /** 当前维度的探索所需食物点数 */
    exploreFoodRequired(): number {
      return this.currentDimension?.exploreFoodCost ?? 0
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
    clickNode(nodeId: string): Record<string, number> {
      const node = db.get('biome_nodes', nodeId)
      if (!node || (node.type !== 'click' && node.type !== 'explore')) return {}

      // explore 类型：进入遗迹小游戏
      if (node.type === 'explore') {
        const now = Date.now()
        if (now - (this.lastClickTime[nodeId] ?? 0) < 10) return {}
        this.lastClickTime[nodeId] = now
        if (node.exploreMapId) {
          useExploreStore().enter(node.exploreMapId)
        }
        return {}
      }

      const now = Date.now()
      if (now - (this.lastClickTime[nodeId] ?? 0) < 10) return {}

      this.lastClickTime[nodeId] = now

      const attrStore = usePlayerAttrStore()

      // 检查能力门槛
      if (node.requiredAbility && node.requiredAbilityValue !== undefined) {
        const playerAbility = attrStore.getPlayerAttr(node.requiredAbility)
        if (playerAbility < node.requiredAbilityValue) return {}
      }

      // 计算能力加成（超出门槛的部分额外给固定产出 bonus）
      let bonus = 1
      if (node.requiredAbility) {
        const playerAbility = attrStore.getPlayerAttr(node.requiredAbility)
        bonus = calcGatherBonus(playerAbility)
      }

      const gains = applyReward(node.rewardId, bonus)
      const inv = useInventoryStore()
      for (const [resId, amt] of Object.entries(gains)) inv.addItem(resId, amt)
      return gains
    },

    /**
     * 启动 timed / mine 节点倒计时。
     * mine 节点会先消耗 entryCost，再启动倒计时。
     * 若节点已在运行中则忽略，返回是否成功启动。
     */
    startTimedNode(nodeId: string): boolean {
      const node = db.get('biome_nodes', nodeId)
      if (!node || (node.type !== 'timed' && node.type !== 'mine') || !node.durationSec) return false

      const state = this.timedNodes[nodeId]
      if (state && !state.done) return false   // 已在运行

      // mine 类型：消耗入口材料
      if (node.type === 'mine') {
        const cost = parseEntryCost(node.entryCost)
        const inv  = useInventoryStore()
        if (!inv.canAfford(cost)) return false
        inv.spend(cost)
      }

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
     * mine 类型节点：进入矿洞而非给资源，返回空对象。
     * 返回 gains 字典（空对象 = 节点未完成或 mine 类型）。
     */
    claimTimedNode(nodeId: string): Record<string, number> {
      const state = this.timedNodes[nodeId]
      if (!state?.done) return {}

      const node = db.get('biome_nodes', nodeId)
      if (!node) return {}

      // 重置为可再次触发
      delete this.timedNodes[nodeId]

      if (node.type === 'mine') {
        useMineStore().enter(node.caveId ?? '')
        return {}
      }

      const gains = applyReward(node.rewardId)
      const inv = useInventoryStore()
      for (const [resId, amt] of Object.entries(gains)) inv.addItem(resId, amt)
      return gains
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
     * 1. 消耗玩家选择的食物（由调用方验证合法性）
     * 2. 按权重随机抽取一个群系
     * 3. 如果是已发现的群系，只切换过去
     * 4. 如果是新群系，加入已发现列表并切换
     * 返回 { success: boolean, biomeId: string, isNew: boolean }
     */
    exploreBiome(foodCommit: Record<string, number>): { success: boolean; biomeId: string; isNew: boolean } {
      const pool = this.explorePool

      // 消耗食物
      const inventory = useInventoryStore()
      for (const [resId, qty] of Object.entries(foodCommit)) {
        if (qty > 0) inventory.spend([{ resourceId: resId, amount: qty }])
      }

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
