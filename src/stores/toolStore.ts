import { defineStore } from 'pinia'
import { db } from '../data/db'
import { useInventoryStore } from './inventoryStore'
import type { PlayerToolState, AbilityId, ResourceAmount, ToolDef } from '../data/types'

export const useToolStore = defineStore('tool', {
  state: (): PlayerToolState => ({
    levels: {
      axe: 0,
      pickaxe: 0,
      bag: 0,
      prospector: 1,
    },
  }),

  getters: {
    getToolByType: () => (type: string): ToolDef[] => db.toolsByType()[type] ?? [],

    getLevelDef: (state) => (toolType: string): ToolDef | null => {
      const tools = db.toolsByType()[toolType] ?? []
      const currentLevel = state.levels[toolType] ?? 0
      return tools.find(t => t.level === currentLevel) ?? null
    },

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

    getNextUpgradeCost: (state) => (toolType: string): ResourceAmount[] => {
      const tools = db.toolsByType()[toolType] ?? []
      const currentLevel = state.levels[toolType] ?? 0
      return tools.find(t => t.level === currentLevel)?.upgradeCost ?? []
    },

    isMaxLevel: (state) => (toolType: string): boolean => {
      const tools = db.toolsByType()[toolType] ?? []
      if (tools.length === 0) return true
      const maxLevel = Math.max(...tools.map(t => t.level))
      return (state.levels[toolType] ?? 0) >= maxLevel
    },

    getNextLevelDef: (state) => (toolType: string): ToolDef | null => {
      const tools = db.toolsByType()[toolType] ?? []
      const nextLevel = (state.levels[toolType] ?? 0) + 1
      return tools.find(t => t.level === nextLevel) ?? null
    },
  },

  actions: {
    upgradeTool(toolType: string): boolean {
      const currentDef = this.getLevelDef(toolType)
      if (!currentDef) return false
      if (!useInventoryStore().canAfford(currentDef.upgradeCost)) return false
      useInventoryStore().spend(currentDef.upgradeCost)
      this.levels[toolType] = (this.levels[toolType] ?? 0) + 1
      return true
    },
  },
})
