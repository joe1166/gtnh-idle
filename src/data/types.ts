// ============================================================
// 共享类型定义 — 静态游戏数据接口
// ============================================================

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
  category: 'ore' | 'ingot' | 'component' | 'circuit' | 'fuel'
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
  unlockedByChapter: number
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
  /**
   * category=1: 基础 EU/s 消耗（由配方决定，此字段仅作参考）
   * category=2: EU/s 产出
   * category=3: 蒸汽产出折算 EU 值（显示时 ×1000 = mb/s）
   */
  euPerSec: number
  /** 机器最高承受电压等级（超出此电压 TODO: 爆炸） */
  maxVoltage: number
  /** 允许执行的配方 ID 列表（category=2/3 为空数组） */
  allowedRecipeIds: string[]
  /** 燃料资源 ID（仅 category=2/3） */
  fuelResourceId?: string
  /** 每秒燃料消耗（仅 category=2/3） */
  fuelPerSec?: number
  buildCost: ResourceAmount[]
  unlockedByChapter: number
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

export interface TechDef {
  id: string
  locKey: string
  descLocKey: string
  cost: ResourceAmount[]
  prerequisites: string[]
  unlocks: {
    features?: string[]
    machineDefIds?: string[]
    recipeIds?: string[]
  }
}
