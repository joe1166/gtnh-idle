// ============================================================
// 科技树 Store — 管理科技研究状态
// ============================================================

import { defineStore } from 'pinia'
import { useInventoryStore } from './inventoryStore'
import { db } from '../data/db'
import type { TechDef } from '../data/types'

export const useTechStore = defineStore('tech', {
  state: () => ({
    researchedTechIds: [] as string[],
  }),

  getters: {
    isResearched: (state) => (techId: string): boolean => {
      return state.researchedTechIds.includes(techId)
    },

    hasFeature: (state) => (featureId: string): boolean => {
      for (const techId of state.researchedTechIds) {
        const tech = db.get('techs', techId)
        if (tech?.unlocks.features?.includes(featureId)) return true
      }
      return false
    },

    canResearch: (state) => (techId: string): boolean => {
      if (state.researchedTechIds.includes(techId)) return false
      const tech = db.get('techs', techId)
      if (!tech) return false
      return tech.prerequisites.every((preId: string) =>
        state.researchedTechIds.includes(preId),
      )
    },

    allTechsWithStatus(state): Array<TechDef & { researched: boolean; available: boolean }> {
      return db.table('techs').map((tech) => {
        const researched = state.researchedTechIds.includes(tech.id)
        const available =
          !researched &&
          tech.prerequisites.every((preId: string) =>
            state.researchedTechIds.includes(preId),
          )
        return { ...tech, researched, available }
      })
    },
  },

  actions: {
    research(techId: string): boolean {
      if (this.researchedTechIds.includes(techId)) return false

      const tech = db.get('techs', techId)
      if (!tech) return false

      if (!tech.prerequisites.every((preId: string) => this.researchedTechIds.includes(preId))) {
        return false
      }

      const inventoryStore = useInventoryStore()
      if (!inventoryStore.spend(tech.cost)) return false

      this.researchedTechIds.push(techId)
      return true
    },
  },
})
