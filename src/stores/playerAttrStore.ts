import { defineStore } from 'pinia'
import { useToolStore } from './toolStore'
import { useEquipmentStore } from './equipmentStore'
import type { PlayerAttrId } from '../data/types'

const BASE_ATTRS: Record<PlayerAttrId, number> = {
  wood_ability: 0,
  mining_ability: 0,
  prospector_ability: 0,
  bag_capacity: 0,
  combat_attack: 9,
  combat_defense: 2,
  combat_hp: 100,
  combat_speed: 6,
}

export const usePlayerAttrStore = defineStore('playerAttr', {
  getters: {
    baseAttrs(): Record<PlayerAttrId, number> {
      return { ...BASE_ATTRS }
    },

    finalAttrs(): Record<string, number> {
      const out: Record<string, number> = { ...this.baseAttrs }
      const toolStore = useToolStore()
      const equipStore = useEquipmentStore()

      for (const [toolType, level] of Object.entries(toolStore.levels)) {
        const defs = toolStore.getToolByType(toolType)
        const def = defs.find(d => d.level === level)
        if (!def) continue
        out[def.abilityId] = (out[def.abilityId] ?? 0) + def.abilityValue
      }

      for (const [attrId, value] of Object.entries(equipStore.equipAttrBonuses)) {
        out[attrId] = (out[attrId] ?? 0) + value
      }

      for (const [attrId, value] of Object.entries(equipStore.setAttrBonuses)) {
        out[attrId] = (out[attrId] ?? 0) + value
      }

      return out
    },

    getPlayerAttr(): (attrId: PlayerAttrId | string) => number {
      return attrId => this.finalAttrs[attrId] ?? 0
    },

    getPlayerAttrs(): Record<string, number> {
      return this.finalAttrs
    },
  },
})
