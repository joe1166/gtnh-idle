// ============================================================
// 工具 Store — 管理玩家工具等级和属性能力
// ============================================================

import { defineStore } from 'pinia'
import { db } from '../data/db'
import { useInventoryStore } from './inventoryStore'
import type { PlayerToolState, AbilityId, ResourceAmount, ToolDef } from '../data/types'

export const useToolStore = defineStore('tool', {
  state: (): PlayerToolState => ({
    levels: {
      stone_axe: 0,      // 初始 0 级（待制作）
      stone_pickaxe: 0,
    },
  }),

  getters: {
    /** 按 type 获取工具定义 */
    getToolByType: () => (type: string): ToolDef[] => {
      return db.toolsByType()[type] ?? []
    },

    /** 某工具当前等级定义 */
    getLevelDef: (state) => (toolType: string): ToolDef | null => {
      const tools = db.toolsByType()[toolType] ?? []
      const currentLevel = state.levels[toolType] ?? 0
      return tools.find(t => t.level === currentLevel) ?? null
    },

    /** 某 abilityId 的当前能力值 */
    getAbility: (state) => (abilityId: AbilityId): number => {
      let total = 0
      for (const [toolType, level] of Object.entries(state.levels)) {
        const tools = db.toolsByType()[toolType] ?? []
        const def = tools.find(t => t.level === level)
        if (!def) continue
        if (def.abilityId === abilityId) total += def.abilityValue
      }
      return total
    },

    /** 当前级的升级消耗（制作/升级到下一级） */
    getNextUpgradeCost: (state) => (toolType: string): ResourceAmount[] => {
      const tools = db.toolsByType()[toolType] ?? []
      const currentLevel = state.levels[toolType] ?? 0
      return tools.find(t => t.level === currentLevel)?.upgradeCost ?? []
    },

    /** 是否满级 */
    isMaxLevel: (state) => (toolType: string): boolean => {
      const tools = db.toolsByType()[toolType] ?? []
      if (tools.length === 0) return true
      const maxLevel = Math.max(...tools.map(t => t.level))
      return (state.levels[toolType] ?? 0) >= maxLevel
    },

    /** 下一级定义 */
    getNextLevelDef: (state) => (toolType: string): ToolDef | null => {
      const tools = db.toolsByType()[toolType] ?? []
      const nextLevel = (state.levels[toolType] ?? 0) + 1
      return tools.find(t => t.level === nextLevel) ?? null
    },
  },

  actions: {
    /** 升级工具 */
    upgradeTool(toolType: string): boolean {
      const currentDef = this.getLevelDef(toolType)
      if (!currentDef) return false
      if (!useInventoryStore().canAfford(currentDef.upgradeCost)) return false
      useInventoryStore().spend(currentDef.upgradeCost)
      this.levels[toolType]++
      return true
    },
  },
})
