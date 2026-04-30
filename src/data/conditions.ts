// ============================================================
// 中心化条件系统
// 所有"是否满足条件"的判断统一入口，由各系统按需调用。
//
// 条件类型（type）:
//   'chapter'  → 当前章节 >= para（数字）
//   'task'     → 任务 ID=para 已完成
//   'tech'     → 科技 ID=para 已研究
//   'resource' → 拥有资源 ID=para 且数量 > 0
//   'tool'     → 工具类型=para 的等级 >= value（para:value）
// ============================================================

import { useInventoryStore } from '../stores/inventoryStore'
import { useProgressionStore } from '../stores/progressionStore'
import { useTaskStore } from '../stores/taskStore'
import { useTechStore } from '../stores/techStore'
import { useToolStore } from '../stores/toolStore'

export type ConditionType = 'chapter' | 'task' | 'tech' | 'resource' | 'tool'

export interface Condition {
  type: ConditionType
  /** 各类型 para 格式：
   *  chapter  → 数字字符串，如 '3'
   *  task     → 数字字符串，如 '10'
   *  tech     → 科技 ID 字符串，如 'basic_automation'
   *  resource → 资源 ID 字符串，如 'weeds'
   *  tool     → 'toolType:value'，如 'stone_axe:2'
   */
  para: string
}

/** 工具条件解析：从 'stone_axe:2' 提取 toolType 和 level */
function parseToolCond(para: string): { toolType: string; level: number } | null {
  const colon = para.indexOf(':')
  if (colon < 0) return null
  const toolType = para.slice(0, colon)
  const level = Number(para.slice(colon + 1))
  if (isNaN(level)) return null
  return { toolType, level }
}

/** 中心化条件判断 */
export function evaluateCondition(cond: Condition | undefined | null): boolean {
  if (!cond) return true

  switch (cond.type) {
    case 'chapter': {
      const required = Number(cond.para)
      return useProgressionStore().currentChapterId >= required
    }
    case 'task': {
      const taskId = Number(cond.para)
      return useTaskStore().isComplete(taskId)
    }
    case 'tech':
      return useTechStore().isResearched(cond.para)
    case 'resource':
      return useInventoryStore().getAmount(cond.para) > 0
    case 'tool': {
      const parsed = parseToolCond(cond.para)
      if (!parsed) return false
      const toolStore = useToolStore()
      return (toolStore.levels[parsed.toolType] ?? 0) >= parsed.level
    }
    default:
      return false
  }
}
