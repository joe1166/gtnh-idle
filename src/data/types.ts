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
  /** 分类，格式为 大类.小类，如 raw.wood、mat.metal、fuel */
  category: string
  /** 标签数组，如 ore、metal、flammable、craftable */
  tags: string[]
  unlockedByChapter: number
  /** 食物点数（仅 tags 含 food 的资源有值，用于探索系统） */
  foodPoints?: number
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
  /** 配方允许的最大机器等级（留空=无限制） */
  maxRequiredLevel?: number
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
  /**
   * 机器可承受的最大电压等级。
   * -1 = 不耗电（无 EU 需求），如 hand_assembly、workbench
   *  0 = 蒸汽机器（电力时代改名 ULV 代替）
   * ≥1 = LV/MV/HV/EV/IV，用于超频上限
   */
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
  /**
   * 无耗时模式（category=1 机器）
   * =1 时该机器所有配方均为瞬时，点击一次执行一次，无需开启/关闭
   */
  instantMode?: number
  /** 合成面板排序序号（电压相同时按 order 升序） */
  order?: number
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
 *
 * 各类型用途明确：
 * BUILD_MACHINE  — 建造指定数量机器（para1=machineDefId, para2=数量）
 * PRODUCE_TOTAL  — 仓库中资源累计产出（para1=resourceId，支持多资源逗号分隔，para2=目标数量）
 * HAVE_ITEM     — 当前持有数量（para1=resourceId, para2=目标数量）
 * REACH_EU_PER_SEC — 发电功率（para1=目标 EU/s）
 * HAVE_TOOL      — 工具等级（para1=toolType, para2=目标等级）
 * OWN_MACHINE    — 拥有机器数量（para1=machineDefId, para2=目标数量）
 * PRODUCE_STEAM  — 蒸汽累计产出（para1=目标 mb，不走 inventoryStore，走 steamStore 累计）
 * CRAFT_ITEM     — 制作数量（para1=resourceId, para2=目标数量，只统计任务可见后在制作地点完成的制作，跨存档不重置）
 */
export const TaskType = {
  /** para1=machineId, para2=数量 */
  BUILD_MACHINE:    1,
  /** para1=resourceId（逗号分隔多资源），para2=目标数量（逗号分隔） */
  PRODUCE_TOTAL:    2,
  /** para1=resourceId, para2=目标持有数量 */
  HAVE_ITEM:        3,
  /** para1=目标 EU/s */
  REACH_EU_PER_SEC: 4,
  /** para1=toolType, para2=目标等级 */
  HAVE_TOOL:        5,
  /** para1=machineDefId, para2=目标数量 */
  OWN_MACHINE:      6,
  /** para1=目标蒸汽 mb（累计） */
  PRODUCE_STEAM:    7,
  /** para1=resourceId, para2=目标制作数量 */
  CRAFT_ITEM:       8,
} as const

export type TaskTypeValue = typeof TaskType[keyof typeof TaskType]

/** 任务定义（对应 config/tasks.json） */
export interface TaskDef {
  id: string
  locKey: string
  type: number
  para1: string
  para2?: string
  /** 奖励 ID（引用 rewards.csv，0=无奖励） */
  rewardId: number
  /** 前置任务 ID（逗号分隔多前置，只有前置完成后才会显示和检测） */
  prereqTaskId?: string
}

// ─── 章节系统 ─────────────────────────────────────────────────────────────────

export type Era = 'stone' | 'steam' | 'lv'

export const ERA_ORDER: Era[] = ['stone', 'steam', 'lv']

export interface ChapterDef {
  id: number
  locKey: string
  descLocKey: string
  taskIds: string[]
  advancesEra?: Era
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
  /** 探索所需食物点数 */
  exploreFoodCost: number
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
  /** 群系卡片图片路径（相对 public/） */
  cardImagePath?: string
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
  /** click = 点击即得；timed = 点击后倒计时，完成再领取；mine = 点击后进入矿洞小游戏；explore = 点击后进入遗迹探索小游戏 */
  type: 'click' | 'timed' | 'mine' | 'explore'
  /** 奖励 ID（引用 rewards.id，0 = 无产出，mine 类型通常为 0） */
  rewardId: number
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
  /**
   * mine 类型节点的进入消耗（原始字符串，格式 resourceId:amount|...，worldStore 解析）
   */
  entryCost?: string
  /**
   * mine 类型节点绑定的洞穴 ID（引用 mine_caves.id），领取后传给 mineStore.enter()
   */
  caveId?: string
  /**
   * explore 类型节点绑定的地图 ID（引用 explore_maps.id），点击后传给 exploreStore.enter()
   */
  exploreMapId?: string
}

// ─── 工具系统 ─────────────────────────────────────────────────────────────────

/** 采集能力属性ID */
export type AbilityId = 'wood_ability' | 'mining_ability' | 'prospector_ability' | 'bag_capacity'

/** 工具定义（扁平结构，运行时按 type 分组） */
export interface ToolDef {
  /** 唯一ID（如 stone_axe_1, prospector_2） */
  id: string
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
  /** 解锁条件（中心化条件系统） */
  showCond?: Condition
}

/** 玩家工具状态 */
export interface PlayerToolState {
  /** toolType → 当前等级 */
  levels: Record<string, number>
}

export interface GlobalMiscDef {
  id: string
  k1?: string
  k2?: string
  k3?: string
}

// ─── 矿洞探索系统 ──────────────────────────────────────────────

/** 矿洞深度分层定义（mine_caves.strata 中的单项） */
export interface MineStratum {
  depthMin: number
  depthMax: number
  blockId: string
}

/** 矿洞洞穴定义（对应 mine_caves.json） */
export interface MineCaveDef {
  id: string
  locKey: string
  rows: number
  cols: number
  maxStamina: number
  tunnelCountMin: number
  tunnelCountMax: number
  /** 该洞穴可出现的矿脉 ID 列表 */
  veinIds: string[]
  /** 深度分层（相邻层可重叠，重叠区自动过渡） */
  strata: MineStratum[]
}

/** 矿脉类型定义（对应 mine_veins.json） */
export interface MineVeinDef {
  id: string
  /** 矿脉填充的方块类型（引用 mine_blocks.id） */
  blockId: string
  /** 出现的深度下限（占总行数比例，0-1） */
  depthMin: number
  /** 出现的深度上限（占总行数比例，0-1） */
  depthMax: number
  /** 每行触发该矿脉的概率（各矿脉独立 roll） */
  spawnRate: number
  veinSizeMin: number
  veinSizeMax: number
  /** 禁止生成的方块类型列表（如 dirt），空数组表示无限制 */
  forbidBlocks: string[]
}

/** 奖励表条目：固定产出 */
export interface RewardFixed {
  resourceId: string
  amount: number
}

/** 奖励表条目：随机池项 */
export interface RewardPool {
  resourceId: string
  amount: number
  weight: number
}

/** 奖励定义（对应 rewards.json） */
export interface RewardDef {
  id: number
  /** 必定全部给出的固定产出 */
  fixed: RewardFixed[]
  /** 按权重随机抽取一项（resourceId='nothing' 表示空抽） */
  pool: RewardPool[]
}

/** 矿洞方块定义（对应 mine_blocks.json） */
export interface MineBlockDef {
  id: string
  locKey: string
  /** soft=软土 | hard=硬石 | ore=矿石 | special=特殊 */
  category: 'soft' | 'hard' | 'ore' | 'special'
  /** CSS 颜色，用于格子背景 */
  color: string
  /** 挖掘所需的 mining_ability 最低值 */
  requiredMiningAbility: number
  /** 挖开后的奖励 ID（0 = 无产出，引用 rewards.id） */
  rewardId: number
}

/** 矿洞网格单元格 */
export interface MineCell {
  blockId: string
  dug: boolean
  /** 矿脉 ID，同一矿脉共享同一值（null = 非矿脉） */
  veinId: string | null
  /** 是否可从入口到达（预生成的废弃通道初始为 false，挖通后变 true） */
  reachable: boolean
}

/** 探矿仪扫描结果 */
export interface ProspectorResult {
  /** 距离最近的矿脉方块 ID（null = 范围内无矿） */
  nearestBlockId: string | null
  /** 模糊数量词 */
  abundance: 'rich' | 'moderate' | 'scarce' | 'empty'
  /** 最近矿石格坐标（用于格子高亮） */
  nearestRow: number | null
  nearestCol: number | null
}

/** 矿洞 Store 完整状态（可序列化到存档） */
export interface MineState {
  /** 当前洞穴 ID（引用 mine_caves.id） */
  caveId: string
  /** 网格数据（row-major 一维数组，length = rows × cols） */
  grid: MineCell[]
  rows: number
  cols: number
  stamina: number
  maxStamina: number
  /** 是否正处于矿洞小游戏内 */
  entered: boolean
  /** 当前地图种子（LCG 复现用） */
  seed: number
  prospectorResult: ProspectorResult | null
  /** 探矿仪冷却剩余秒数（tick 递减） */
  prospectorCooldown: number
  /** 本次进入后的资源收获（resourceId → 数量） */
  sessionLoot: Record<string, number>
  /** 是否显示离开确认弹窗 */
  exitDialogOpen: boolean
}

// ─── 遗迹探索系统 ──────────────────────────────────────────────

/** 探索地图定义（对应 explore_maps.json） */
export interface ExploreMapDef {
  id: string
  locKey: string
  rows: number
  cols: number
  voidRate: number
  cycleEdgeRate: number
  mergeProb: number
  maxMergeSize: number
  generatableRoomIds: string[]
  requiredRoomIds: string[]
  /** "row:col" 格式，如 "8:4" */
  entryPos: string
  fixedRooms: ExploreMapFixedRoom[]
}

/** 固定房间的地图内放置配置（从 fixedRooms 字段解析而来） */
export interface ExploreMapFixedRoom {
  roomDefId: string
  anchorRow: number
  anchorCol: number
  /** 原始字符串，如 "N,S"，代码中用逗号分割成数组 */
  allowedDoors: string
}

/** 房间类型定义（对应 explore_rooms.json） */
export interface ExploreRoomDef {
  id: string
  locKey: string
  /** fixed = 固定形状；generatable = 有机合并形状 */
  /** fixed = 固定布局；generatable = 可生成布局 */
  layoutType: 'fixed' | 'generatable'
  /** normal = 普通房；combat = 战斗房；event = 剧情房 */
  type: 'normal' | 'combat' | 'event'
  /** 剧情房入口节点（引用 explore_events.id） */
  eventStartNodeId?: string
  /** 战斗房敌人池 */
  enemyPool?: { enemyId: string; weight: number }[]
  /** 战斗房敌人数量范围 */
  enemyCountMin?: number
  enemyCountMax?: number
  /** 格子偏移列表（仅 fixed 有效，相对锚点） */
  shape: { dRow: number; dCol: number }[]
  /** 最小占格数（仅 generatable 有效） */
  minCells?: number
  /** 最大占格数（仅 generatable 有效） */
  maxCells?: number
  /** 随机分配权重（仅 generatable 有效） */
  weight?: number
  rewardId: number
  descLocKey: string
}

/** 运行时探索房间实例 */
export interface ExploreRoom {
  /** 运行时唯一ID */
  instanceId: string
  /** 对应 explore_rooms.id（'entry' 为入口保留值） */
  defId: string
  /** 该房间占据的所有格子坐标 */
  cells: { row: number; col: number }[]
  visited: boolean
  looted: boolean
  /** 本房间搜刮获得明细（resourceId -> amount） */
  roomLoot?: Record<string, number>
  /** 剧情是否完成 */
  eventDone?: boolean
  /** 当前剧情节点 */
  eventNodeId?: string
  /** 战斗敌人是否已生成 */
  combatSpawned?: boolean
  /** 战斗是否完成 */
  combatResolved?: boolean
  /** 是否已确认该房间有怪物（用于地图红色标记） */
  dangerKnown?: boolean
  /** 是否从该房间战斗逃跑过（逃跑后维持红色标记） */
  escapedFromCombat?: boolean
  /** 本房间战斗敌人快照 */
  enemies?: ExploreCombatEnemy[]
}

/** 两个房间之间的连接（门） */
export interface ExploreConnection {
  roomA: string   // instanceId
  roomB: string   // instanceId
  /** 连接发生的格子边缘（A侧格子坐标 + 方向） */
  row: number
  col: number
  direction: 'N' | 'S' | 'E' | 'W'
}

export interface ExploreEnemyDef {
  id: string
  locKey: string
  descLocKey: string
  hp: number
  attack: number
  defense: number
  speed: number
  rewardId: number
}

export interface ExploreLootItemDef {
  id: string
  locKey: string
  iconPath: string
  sizeW: number
  sizeH: number
  convertOutputs: ResourceAmount[]
}

export interface ExploreLootPoolDef {
  id: string
  sourceType: 'room' | 'enemy' | 'event'
  sourceId: string
  itemId: string
  weight: number
  minCount: number
  maxCount: number
}

export interface ExploreLootInstance {
  instanceId: string
  itemId: string
  width: number
  height: number
  rotated: boolean
}

export interface ExploreBagPlacedItem extends ExploreLootInstance {
  x: number
  y: number
}

export interface ExploreEventNodeDef {
  id: string
  textLocKey: string
  autoNextId?: string
  isTerminal?: boolean
  optionATextLocKey?: string
  optionANextId?: string
  optionARewardId?: number
  optionAHpDelta?: number
  optionBTextLocKey?: string
  optionBNextId?: string
  optionBRewardId?: number
  optionBHpDelta?: number
  optionCTextLocKey?: string
  optionCNextId?: string
  optionCRewardId?: number
  optionCHpDelta?: number
}

export interface ExploreCombatEnemy {
  id: string
  nameLocKey: string
  hp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  rewardId: number
}
