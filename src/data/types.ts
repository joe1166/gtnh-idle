// ============================================================
// 共享类型定义 — 静态游戏数据接口
// ============================================================

import type { Condition } from './conditions'

/** 配方输入/输出条目 */
export interface ResourceAmount {
  resourceId: string
  amount: number
}

/** 资源定义 */
export interface ResourceDef {
  id: string
  locKey: string
  defaultCap: number
  category: 'ore' | 'ingot' | 'component' | 'circuit' | 'fuel' | 'wood' | 'stone'
  unlockedByChapter: number
}

// ─── 电压等级 ─────────────────────────────────────────────────────────────────

/**
 * 电压等级常量
 * 0=ULV（蒸汽），1=LV，2=MV，3=HV，4=EV，5=IV ...
 */
export const VoltTier = {
  ULV: 0,
  LV:  1,
  MV:  2,
  HV:  3,
  EV:  4,
  IV:  5,
} as const

export type VoltTierValue = typeof VoltTier[keyof typeof VoltTier]

/** 电压等级显示名称 */
export const VoltTierName: Record<number, string> = {
  0: 'ULV',
  1: 'LV',
  2: 'MV',
  3: 'HV',
  4: 'EV',
  5: 'IV',
}

// ─── 配方 ──────────────────────────────────────────────────────────────────────

/**
 * 超频模式
 * 0 = 不可超频（高压机器跑低压配方不加速）
 * 1 = 有损超频（每档 ×4 EU，×2 速度）
 * 2 = 无损超频（每档 ×4 EU，×4 速度）
 */
export const OverclockMode = {
  NONE:     0,
  LOSSY:    1,
  LOSSLESS: 2,
} as const

/** 配方定义 */
export interface RecipeDef {
  id: string
  locKey: string
  inputs: ResourceAmount[]
  outputs: ResourceAmount[]
  durationSec: number
  /** 基础 EU/s 消耗（ULV 配方运行时换算为蒸汽：euPerSec × 1000 mb/s） */
  euPerSec: number
  /** 所需最低电压等级（0=ULV/蒸汽，1=LV，...） */
  voltage: number
  /**
   * 超频模式（见 OverclockMode）
   * 0=不可超频，1=有损，2=无损
   */
  overclock: number
  /** 匹配机器的 role 字段 */
  requiredRole: string
  /** 配方所需的最低机器等级 */
  requiredLevel: number
  /** 解锁条件（中心化条件系统） */
  showCond?: Condition
}

// ─── 机器 ──────────────────────────────────────────────────────────────────────

/**
 * 机器定义（合成机器 + 发电机统一表）
 *
 * category = 1  合成机器：有配方槽，消耗 EU 或蒸汽（由配方 voltage 决定）
 * category = 2  EU 发电机：有燃料槽，产出 EU
 * category = 3  蒸汽发生器：有燃料槽，产出蒸汽（mb/s）
 */
export interface MachineDef {
  id: string
  locKey: string
  /** 1=合成机器, 2=EU发电机, 3=蒸汽发生器 */
  category: number
  /** 配方槽类型（仅 category=1 有值），用于匹配 RecipeDef.requiredRole */
  role?: string
  /** 机器等级（category=1），决定能执行哪些配方（配方 requiredLevel ≤ 机器 tier 时可执行） */
  tier: number
  /** 机器最高承受电压等级（category=1，用于超频） */
  maxVoltage?: number
  /**
   * category=2: EU/s 产出
   * category=3: 蒸汽产出折算 EU 值（显示时 ×1000 = mb/s）
   */
  euPerSec: number
  /** 燃料资源 ID（仅 category=2/3） */
  fuelResourceId?: string
  /** 每秒燃料消耗（仅 category=2/3） */
  fuelPerSec?: number
  buildCost: ResourceAmount[]
  /** 最大建造数量，0=不可建造 */
  maxCount: number
  /** 解锁条件（中心化条件系统） */
  showCond?: Condition
  /** 发电机电压等级（仅 category=2/3，决定产出的是哪个等级的 EU） */
  voltage?: number
}

/** 机器实例运行状态 */
export type MachineStatus =
  | 'running'
  | 'paused'
  | 'no_recipe'
  | 'no_material'
  | 'no_power'
  | 'no_fuel'
  | 'no_steam'

/**
 * 机器实例（category=1/2/3 共用）
 */
export interface MachineInstance {
  instanceId: string
  defId: string
  isRunning: boolean
  /** 当前选中配方（category=2/3 始终为 null） */
  selectedRecipeId: string | null
  /** 配方进度秒数（category=2/3 不使用） */
  progressSec: number
  status: MachineStatus
  /**
   * 选择的供电电压等级（替代原 overclock 字段）
   * - category=1：玩家可调（需解锁超频科技），影响速度和 EU 消耗
   * - category=2/3：不使用（发电机电压固定）
   * - ULV 机器（maxVoltage=0）固定为 0
   */
  selectedVoltage: number
}

// ─── 任务系统 ─────────────────────────────────────────────────────────────────

/**
 * 任务类型常量
 */
export const TaskType = {
  /** para1=machineId, para2=数量 */
  BUILD_MACHINE:    1,
  /** para1=resourceId, para2=累计产出数量 */
  PRODUCE_TOTAL:    2,
  /** para1=resourceId, para2=当前拥有数量 */
  HAVE_ITEM:        3,
  /** para1=目标 EU/s */
  REACH_EU_PER_SEC: 4,
} as const

export type TaskTypeValue = typeof TaskType[keyof typeof TaskType]

/** 任务定义（对应 config/tasks.json） */
export interface TaskDef {
  id: number
  locKey: string
  type: number
  para1: string
  para2?: string
  rewardResourceId?: string
  rewardAmount?: number
}

// ─── 章节系统 ─────────────────────────────────────────────────────────────────

export interface ChapterUnlockCondition {
  type: 'eu_per_sec' | 'item_crafted' | 'manual'
  value?: number
  resourceId?: string
}

export interface ChapterUnlocks {
  resourceIds?: string[]
  recipeIds?: string[]
  machineDefIds?: string[]
}

export interface ChapterDef {
  id: number
  locKey: string
  descLocKey: string
  unlockCondition: ChapterUnlockCondition
  taskIds: number[]
  unlocks: ChapterUnlocks
}

// ─── 科技系统 ─────────────────────────────────────────────────────────────────

/**
 * 科技前置依赖
 *   explicit — 必须已研究，且在画布上渲染连线
 *   implicit — 必须已研究，不渲染连线，节点上显示"隐藏前置未满足"
 */
export interface TechPrereq {
  techId: string
  kind: 'explicit' | 'implicit'
}

/**
 * 科技树定义（对应 tech_trees.csv）
 */
export interface TechTreeDef {
  id: string
  locKey: string
  order: number
}

/**
 * 科技节点定义
 *
 * showCondition / unlockCondition 为原始条件字符串，运行时解析：
 *   "tech:basic_automation"    — 某科技已研究
 *   "task:5"                   — 某任务已完成
 *   "eu_per_sec:32"            — 发电量 >= 32 EU/s
 *   "have_item:iron_ore:100"   — 拥有 iron_ore >= 100
 *   "chapter:2"                — 章节 2 已解锁
 *   空/undefined               — 无条件
 */
export interface TechDef {
  id: string
  treeId: string
  col: number
  row: number
  locKey: string
  descLocKey: string
  cost: ResourceAmount[]
  prerequisites: TechPrereq[]
  showCondition?: string
  unlockCondition?: string
  unlocks: {
    features?: string[]
    machineDefIds?: string[]
    recipeIds?: string[]
  }
}

// ─── 世界/探索系统 ────────────────────────────────────────────────────────────

/**
 * 维度定义（对应 dimensions.csv）
 * 一个维度包含多个群系。
 */
export interface DimensionDef {
  id: string
  locKey: string
  descLocKey?: string
  /** 该维度包含的群系 ID 列表（有序） */
  biomeIds: string[]
  /** 玩家在此维度的初始群系 */
  startBiomeId: string
  /** 解锁条件字符串（空 = 始终可进入） */
  unlockCondition?: string
  /** 探索消耗 [resourceId, amount][] */
  exploreCost: ResourceAmount[]
  /** 探索池 biomeId:weight[] */
  explorePool: { biomeId: string; weight: number }[]
}

/**
 * 群系定义（对应 biomes.csv）
 * 通过 nodeIds 索引资源节点，不内嵌节点数据。
 */
export interface BiomeDef {
  id: string
  locKey: string
  /** 背景图片路径（相对 public/，留空回退 CSS 渐变） */
  imagePath?: string
  /** CSS filter 色调调整（可选，如 "hue-rotate(30deg)"） */
  ambientColor?: string
  /** 该群系包含的资源节点 ID 列表（有序，决定渲染顺序） */
  nodeIds: string[]
}

/**
 * 资源节点定义（对应 biome_nodes.csv）
 * 合并了节点类型与布局信息。
 */
export interface BiomeNodeDef {
  id: string
  /** 悬浮提示 i18n key */
  locKey: string
  /** 按钮文字 i18n key，如「砍树」「探索洞穴」 */
  actionLocKey: string
  /** click = 点击即得；timed = 点击后倒计时，完成再领取 */
  type: 'click' | 'timed'
  resourceId: string
  amount: number
  /** 倒计时秒数（click 节点填 0） */
  durationSec: number
  /** 按钮位置 X（相对面板百分比，0-100） */
  posX: number
  /** 按钮位置 Y（相对面板百分比，0-100，0=顶部） */
  posY: number
  /**
   * 是否初始隐藏：true = 玩家需先点中 hitArea 才会显示按钮。
   */
  hidden: boolean
  /**
   * SVG polygon 坐标字符串（空格分隔的 "x,y" 列表，坐标单位为面板百分比）。
   * 仅 hidden=true 时有效，定义透明可点击的发现热区。
   * 示例："70,25 95,25 95,65 70,65"
   */
  hitArea?: string
  /**
   * 所需采集能力类型（如 'wood_ability' | 'mining_ability'）
   */
  requiredAbility?: AbilityId
  /**
   * 所需采集能力门槛值（玩家 ability >= 此值才能采集）
   */
  requiredAbilityValue?: number
}

// ─── 工具系统 ─────────────────────────────────────────────────────────────────

/** 采集能力属性ID */
export type AbilityId = 'wood_ability' | 'mining_ability'

/** 工具定义（扁平结构，运行时按 type 分组） */
export interface ToolDef {
  /** 唯一ID（如 1001, 1002） */
  id: number
  /** 工具类型（如 stone_axe, stone_pickaxe） */
  type: string
  /** 等级（1=初始，2=升级...） */
  level: number
  /** 能力ID */
  abilityId: AbilityId
  /** 能力值 */
  abilityValue: number
  /** 升级消耗 */
  upgradeCost: ResourceAmount[]
  /** 多语言key */
  locKey: string
  /** 所属章节 */
  unlockedByChapter: number
}

/** 玩家工具状态 */
export interface PlayerToolState {
  /** toolType → 当前等级 */
  levels: Record<string, number>
}
