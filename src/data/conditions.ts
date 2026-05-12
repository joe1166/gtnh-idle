// ============================================================
// 中心化条件系统
// 所有"是否满足条件"的判断统一入口，由各系统按需调用。
//
// 条件类型（type）:
//   'chapter'       → 当前章节 >= para（数字）
//   'task'          → 任务 ID=para 已完成
//   'tech'          → 科技 ID=para 已研究
//   'resource'      → 当前背包中拥有资源 ID=para 且数量 > 0
//   'resource_ever' → 曾经获得过资源 ID=para（累计产出 > 0），para='*' 表示曾获得过任意物品
//   'tool'          → 工具类型=para 的等级 >= value（para:value）
// ============================================================

import { useInventoryStore } from '../stores/inventoryStore'
import { usePowerStore } from '../stores/powerStore'
import { useProgressionStore } from '../stores/progressionStore'
import { useTaskStore } from '../stores/taskStore'
import { useTechStore } from '../stores/techStore'
import { useToolStore } from '../stores/toolStore'

export type ConditionType = 'chapter' | 'task' | 'tech' | 'resource' | 'tool' | 'resource_ever' | 'voltage'

export interface Condition {
  type: ConditionType
  /** 各类型 para 格式：
   *  chapter       → 数字字符串，如 '3'
   *  task          → 数字字符串，如 '10'
   *  tech          → 科技 ID 字符串，如 'basic_automation'
   *  resource     → 资源 ID 字符串，如 'weeds'
   *  resource_ever → 资源 ID 字符串，如 'weeds'（曾获得过即可，用 totalProduced 判断）；para='*' 表示曾获得过任意物品
   *  tool          → 'toolType:value'，如 'stone_axe:2'
   *  voltage       → 最低全局电压等级数字字符串，如 '1'（LV），'2'（MV）
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
export function checkCondition(cond: Condition | undefined | null): boolean {
  if (!cond) return true

  switch (cond.type) {
    case 'chapter': {
      const required = Number(cond.para)
      return useProgressionStore().currentChapterId >= required
    }
    case 'task': {
      return useTaskStore().isComplete(cond.para)
    }
    case 'tech':
      return useTechStore().isResearched(cond.para)
    case 'resource':
      return useInventoryStore().getAmount(cond.para) > 0
    case 'resource_ever':
      if (cond.para === '*') {
        // '*' = 曾获得过任意物品（totalProduced 中任意一条 value > 0）
        const totalProduced = useInventoryStore().totalProduced
        return Object.values(totalProduced).some((v) => v > 0)
      }
      return useInventoryStore().everHad(cond.para)
    case 'tool': {
      const parsed = parseToolCond(cond.para)
      if (!parsed) return false
      const toolStore = useToolStore()
      return (toolStore.levels[parsed.toolType] ?? 0) >= parsed.level
    }
    case 'voltage': {
      return usePowerStore().globalMaxVoltage >= Number(cond.para)
    }
    default:
      return false
  }
}
