// ============================================================
// 科技树 Store — 管理科技研究状态
// ============================================================

import { defineStore } from 'pinia'
import { useInventoryStore } from './inventoryStore'
import { useTaskStore } from './taskStore'
import { usePowerStore } from './powerStore'
import { useProgressionStore } from './progressionStore'
import { db } from '../data/db'
import type { TechDef } from '../data/types'

// ─── 条件解析 ────────────────────────────────────────────────

/**
 * 解析并求值条件字符串。
 * 格式：
 *   "tech:basic_automation"    — 某科技已研究
 *   "task:5"                   — 某任务已完成
 *   "eu_per_sec:32"            — 发电量 >= 32 EU/s
 *   "have_item:iron_ore:100"   — 拥有 iron_ore >= 100
 *   "chapter:2"                — 章节 2 已解锁
 *   空/undefined               — 无条件，始终返回 true
 */
function evalCondition(
  raw: string | undefined,
  researchedTechIds: string[],
): boolean {
  if (!raw) return true
  const parts = raw.split(':')
  const type = parts[0]

  switch (type) {
    case 'tech':
      return researchedTechIds.includes(parts[1])
    case 'task':
      return useTaskStore().isComplete(Number(parts[1]))
    case 'eu_per_sec':
      return usePowerStore().totalGenPerSec >= Number(parts[1])
    case 'have_item':
      return useInventoryStore().getAmount(parts[1]) >= Number(parts[2])
    case 'chapter':
      return useProgressionStore().chapterUnlocked.includes(Number(parts[1]))
    default:
      console.warn('[techStore] Unknown condition type:', type)
      return false
  }
}

// ─── Store ───────────────────────────────────────────────────

export interface TechNodeStatus extends TechDef {
  researched: boolean
  /** 所有前置满足 + unlockCondition 满足 + 未研究 */
  available: boolean
  visible: boolean
  /** 是否有 implicit 前置尚未研究 */
  hasUnmetImplicit: boolean
}

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

    /**
     * 节点可见性（含递归隐藏）。
     * - showCondition 不满足 → 隐藏
     * - 有显式前置 且 全部显式前置都隐藏 → 递归隐藏
     */
    isVisible: (state) => (techId: string): boolean => {
      const tech = db.get('techs', techId)
      if (!tech) return false

      // showCondition
      if (tech.showCondition && !evalCondition(tech.showCondition, state.researchedTechIds)) {
        return false
      }

      // 递归隐藏：有显式前置且全部隐藏
      const explicitPrereqs = tech.prerequisites.filter(p => p.kind === 'explicit')
      if (explicitPrereqs.length > 0) {
        // 需要调用 isVisible，但 getter 里无法直接递归调用自身引用
        // 通过内联递归函数实现
        const hidden = (id: string, visited = new Set<string>()): boolean => {
          if (visited.has(id)) return false // 防循环
          visited.add(id)
          const t = db.get('techs', id)
          if (!t) return true
          if (t.showCondition && !evalCondition(t.showCondition, state.researchedTechIds)) return true
          const exPre = t.prerequisites.filter(p => p.kind === 'explicit')
          if (exPre.length > 0 && exPre.every(p => hidden(p.techId, visited))) return true
          return false
        }
        if (explicitPrereqs.every(p => hidden(p.techId))) return false
      }

      return true
    },

    /** 某棵树是否有至少一个可见节点 */
    isTreeVisible: (_state) => (treeId: string): boolean => {
      const store = useTechStore()
      return db.table('techs')
        .filter(t => t.treeId === treeId)
        .some(t => store.isVisible(t.id))
    },

    /** 是否满足研究条件（不含资源） */
    canResearch: (state) => (techId: string): boolean => {
      if (state.researchedTechIds.includes(techId)) return false
      const tech = db.get('techs', techId)
      if (!tech) return false

      // unlockCondition
      if (!evalCondition(tech.unlockCondition, state.researchedTechIds)) return false

      // 所有前置（explicit + implicit）必须已研究
      return tech.prerequisites.every(p => state.researchedTechIds.includes(p.techId))
    },

    /** 带完整状态的节点列表（仅含可见节点） */
    visibleTechsWithStatus(): TechNodeStatus[] {
      return db.table('techs')
        .filter(tech => this.isVisible(tech.id))
        .map(tech => {
          const researched = this.researchedTechIds.includes(tech.id)
          const available = !researched && this.canResearch(tech.id)
          const hasUnmetImplicit = tech.prerequisites
            .filter(p => p.kind === 'implicit')
            .some(p => !this.researchedTechIds.includes(p.techId))
          return { ...tech, researched, available, visible: true, hasUnmetImplicit }
        })
    },
  },

  actions: {
    research(techId: string): boolean {
      if (!this.canResearch(techId)) return false

      const tech = db.get('techs', techId)
      if (!tech) return false

      const inventoryStore = useInventoryStore()
      if (!inventoryStore.spend(tech.cost)) return false

      this.researchedTechIds.push(techId)
      return true
    },

    /** 重置所有研究进度（开发阶段用） */
    resetAll() {
      this.researchedTechIds = []
    },
  },
})
