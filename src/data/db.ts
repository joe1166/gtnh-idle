// ============================================================
// 通用配置数据库 (db.ts)
// ============================================================
//
// 【支持的表名】
//   'resources'   — 资源定义      (ResourceDef[])
//   'recipes'     — 配方定义      (RecipeDef[])
//   'machines'    — 机器定义      (MachineDef[])  含发电机（category=2）
//   'chapters'    — 章节定义      (ChapterDef[])
//   'techs'       — 科技定义      (TechDef[])
//   'tech_trees'  — 科技树定义    (TechTreeDef[])
//   'tasks'       — 任务定义      (TaskDef[])
//   'dimensions'  — 维度定义      (DimensionDef[])
//   'biomes'      — 群系定义      (BiomeDef[])    含 nodeIds，不嵌套节点
//   'biome_nodes' — 资源节点定义  (BiomeNodeDef[])
//   'mine_blocks' — 矿洞方块定义  (MineBlockDef[])
//   'mine_veins'  — 矿脉类型定义  (MineVeinDef[])
//   'mine_caves'  — 洞穴定义      (MineCaveDef[])
//
// 【使用方式】
//   db.table('machines')                          // → MachineDef[]
//   db.get('machines', 'steam_boiler')            // → MachineDef | undefined
//   db.filter('machines', m => m.category === 2)  // 筛选发电机
//   db.name('resources', 'iron_ore')              // → '铁矿石'
// ============================================================

import { t } from './i18n'
import type { Condition } from './conditions'
import type {
  ResourceDef,
  RecipeDef,
  MachineDef,
  ChapterDef,
  TechDef,
  TechTreeDef,
  TaskDef,
  DimensionDef,
  BiomeDef,
  BiomeNodeDef,
  ToolDef,
  MineBlockDef,
  MineCaveDef,
  MineVeinDef,
  RewardDef,
  ExploreMapDef,
  ExploreRoomDef,
  ExploreEnemyDef,
  ExploreEventNodeDef,
} from './types'

import resourcesData   from '../config/resources.json'
import recipesData     from '../config/recipes.json'
import machinesData    from '../config/machines.json'
import chaptersData    from '../config/chapters.json'
import techsData       from '../config/techs.json'
import techTreesData   from '../config/tech_trees.json'
import tasksData       from '../config/tasks.json'
import dimensionsData  from '../config/dimensions.json'
import biomesData      from '../config/biomes.json'
import biomeNodesData  from '../config/biome_nodes.json'
import toolsData       from '../config/tools.json'
import mineBlocksData  from '../config/mine_blocks.json'
import mineVeinsData  from '../config/mine_veins.json'
import mineCavesData  from '../config/mine_caves.json'
import rewardsData    from '../config/rewards.json'
import exploreMapsData  from '../config/explore_maps.json'
import exploreRoomsData from '../config/explore_rooms.json'
import exploreEnemiesData from '../config/explore_enemies.json'
import exploreEventsData from '../config/explore_events.json'

/** 将 showCondType + showCondPara 合并为 Condition 对象 */
function buildShowCond(raw: { showCondType?: string; showCondPara?: string }): Condition | undefined {
  if (!raw.showCondType) return undefined
  return { type: raw.showCondType as Condition['type'], para: raw.showCondPara ?? '' }
}

interface TableMap {
  resources:     ResourceDef
  recipes:       RecipeDef
  machines:      MachineDef
  chapters:      ChapterDef
  techs:         TechDef
  tech_trees:    TechTreeDef
  tasks:         TaskDef
  dimensions:    DimensionDef
  biomes:        BiomeDef
  biome_nodes:   BiomeNodeDef
  tools:         ToolDef
  mine_blocks:   MineBlockDef
  mine_veins:    MineVeinDef
  mine_caves:    MineCaveDef
  rewards:       RewardDef
  explore_maps:  ExploreMapDef
  explore_rooms: ExploreRoomDef
  explore_enemies: ExploreEnemyDef
  explore_events: ExploreEventNodeDef
}

export type TableName = keyof TableMap

/** 原始数据（CSV 生成，含字符串 showCondType/showCondPara） */
interface RawRecipe {
  id: string; locKey: string; inputs: { resourceId: string; amount: number }[];
  outputs: { resourceId: string; amount: number }[]; durationSec: number; euPerSec: number;
  requiredRole: string; requiredLevel: number; showCondType: string; showCondPara: string;
  voltage?: number; overclock?: number;
}
interface RawMachine {
  id: string; locKey: string; category: number; role?: string; tier: number;
  euPerSec: number; fuelResourceId?: string; fuelPerSec?: number;
  buildCost: { resourceId: string; amount: number }[]; maxCount: number;
  showCondType: string; showCondPara: string; maxVoltage?: number; voltage?: number;
}
interface RawTool {
  id: string; type: string; level: number; abilityId: string; abilityValue: number;
  upgradeCost: { resourceId: string; amount: number }[]; locKey: string;
  unlockedByChapter: number; showCondType: string; showCondPara: string;
}

const RAW: Record<TableName, unknown[]> = {
  resources:   resourcesData  as ResourceDef[],
  // recipes 和 machines 需要在运行时转换 showCond
  recipes:     (recipesData as RawRecipe[]).map(r => ({
    ...r, showCond: buildShowCond(r),
  })) as unknown as RecipeDef[],
  machines:    (machinesData as RawMachine[]).map(m => ({
    ...m, showCond: buildShowCond(m),
  })) as unknown as MachineDef[],
  chapters:    chaptersData   as ChapterDef[],
  techs:       techsData      as TechDef[],
  tech_trees:  techTreesData  as TechTreeDef[],
  tasks:       tasksData      as TaskDef[],
  dimensions:  dimensionsData as DimensionDef[],
  biomes:      biomesData     as BiomeDef[],
  biome_nodes: biomeNodesData as BiomeNodeDef[],
  tools:       (toolsData as RawTool[]).map(t => ({
    ...t, showCond: buildShowCond(t),
  })) as unknown as ToolDef[],
  mine_blocks: mineBlocksData as MineBlockDef[],
  mine_veins:  mineVeinsData  as MineVeinDef[],
  mine_caves:  mineCavesData  as MineCaveDef[],
  rewards:       rewardsData      as RewardDef[],
  explore_maps:  exploreMapsData  as ExploreMapDef[],
  explore_rooms: exploreRoomsData as ExploreRoomDef[],
  explore_enemies: exploreEnemiesData as ExploreEnemyDef[],
  explore_events: exploreEventsData as ExploreEventNodeDef[],
}

const INDEX_CACHE: Partial<Record<TableName, Map<string | number, unknown>>> = {}
let _toolsByTypeCache: Record<string, ToolDef[]> | null = null

function getIndex(tableName: TableName): Map<string | number, unknown> {
  if (!INDEX_CACHE[tableName]) {
    const map = new Map<string | number, unknown>()
    for (const item of RAW[tableName]) {
      const id = (item as { id: string | number }).id
      map.set(id, item)
    }
    INDEX_CACHE[tableName] = map
  }
  return INDEX_CACHE[tableName]!
}

export const db = {
  table<T extends TableName>(tableName: T): TableMap[T][] {
    return RAW[tableName] as TableMap[T][]
  },

  get<T extends TableName>(tableName: T, id: string | number): TableMap[T] | undefined {
    return getIndex(tableName).get(id) as TableMap[T] | undefined
  },

  filter<T extends TableName>(
    tableName: T,
    predicate: (item: TableMap[T]) => boolean,
  ): TableMap[T][] {
    return (RAW[tableName] as TableMap[T][]).filter(predicate)
  },

  name(tableName: TableName, id: string | number): string {
    const item = this.get(tableName, id) as { locKey?: string } | undefined
    if (!item?.locKey) return String(id)
    return t(item.locKey)
  },

  desc(tableName: TableName, id: string | number): string {
    const item = this.get(tableName, id) as { descLocKey?: string } | undefined
    if (!item?.descLocKey) return ''
    return t(item.descLocKey)
  },

  /** 工具按 type 分组，返回 { type: ToolDef[] }。结果缓存，只在首次调用时计算。 */
  toolsByType(): Record<string, ToolDef[]> {
    if (_toolsByTypeCache) return _toolsByTypeCache
    const result: Record<string, ToolDef[]> = {}
    for (const tool of this.table('tools')) {
      if (!result[tool.type]) result[tool.type] = []
      result[tool.type].push(tool)
    }
    for (const type of Object.keys(result)) {
      result[type].sort((a, b) => a.level - b.level)
    }
    _toolsByTypeCache = result
    return result
  },
}
