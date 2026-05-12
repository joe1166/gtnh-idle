// ============================================================
// 面板配置 (panelConfig.ts)
// ============================================================
//
// 所有侧边栏面板的唯一配置来源，由 tables/panels.csv 生成。
// 新增/修改面板请编辑 CSV 并运行 npm run csv:panels。
//
// 条件字段说明：
//   showCond undefined → 始终显示
//   hideCond undefined → 不隐藏（hideCond 优先于 showCond）
//
// 通用条件类型（来自 conditions.ts）：
//   'chapter'  → 当前章节 >= para
//   'task'     → 任务 ID=para 已完成
//   'tech'     → 科技 ID=para 已研究
//   'resource' → 拥有资源 ID=para 且 > 0
//   'tool'     → 工具类型:等级 >= value
//
// 面板专用条件类型：
//   'panel' → 面板 ID=para 当前可见（仅 hideCond 使用，需两轮计算避免循环依赖）
// ============================================================

import rawPanels from '../config/panels.json'
import { Condition, checkCondition } from './conditions'

export type { Condition } from './conditions'

// panel 类型仅在 hideCond 中使用，不走通用 checkCondition（需两轮计算）
export type PanelHideCondType = 'panel'

export interface PanelShowCondition extends Condition {}
export interface PanelHideCondition {
  type: PanelHideCondType
  para: string
}

export interface PanelDef {
  id: string
  order: number
  icon: string
  labelKey: string
  showCond?: PanelShowCondition
  hideCond?: PanelHideCondition
}

/** 将 CSV 生成的原始记录映射为带结构化条件的 PanelDef */
function buildPanelDef(raw: {
  id: string
  order: number
  icon: string
  labelKey: string
  showCondType: string
  showCondPara: string
  hideCondType: string
  hideCondPara: string
}): PanelDef {
  return {
    id: raw.id,
    order: raw.order,
    icon: raw.icon,
    labelKey: raw.labelKey,
    showCond: raw.showCondType
      ? { type: raw.showCondType as Condition['type'], para: raw.showCondPara }
      : undefined,
    hideCond: raw.hideCondType
      ? { type: raw.hideCondType as PanelHideCondType, para: raw.hideCondPara }
      : undefined,
  }
}

export const PANEL_DEFS: PanelDef[] = (rawPanels as Parameters<typeof buildPanelDef>[0][]).map(buildPanelDef)

export { checkCondition }
