// ============================================================
// 通用配置数据库 (db.ts)
// ============================================================
//
// 【支持的表名】
//   'resources'  — 资源定义      (ResourceDef[])
//   'recipes'    — 配方定义      (RecipeDef[])
//   'machines'   — 机器定义      (MachineDef[])  含发电机（category=2）
//   'chapters'   — 章节定义      (ChapterDef[])
//   'techs'      — 科技定义      (TechDef[])
//   'tasks'      — 任务定义      (TaskDef[])
//
// 【使用方式】
//   db.table('machines')                          // → MachineDef[]
//   db.get('machines', 'steam_boiler')            // → MachineDef | undefined
//   db.filter('machines', m => m.category === 2)  // 筛选发电机
//   db.name('resources', 'iron_ore')              // → '铁矿石'
// ============================================================

import { t } from './i18n'
import type {
  ResourceDef,
  RecipeDef,
  MachineDef,
  ChapterDef,
  TechDef,
  TaskDef,
} from './types'

import resourcesData from '../config/resources.json'
import recipesData   from '../config/recipes.json'
import machinesData  from '../config/machines.json'
import chaptersData  from '../config/chapters.json'
import techsData     from '../config/techs.json'
import tasksData     from '../config/tasks.json'

interface TableMap {
  resources: ResourceDef
  recipes:   RecipeDef
  machines:  MachineDef
  chapters:  ChapterDef
  techs:     TechDef
  tasks:     TaskDef
}

export type TableName = keyof TableMap

const RAW: Record<TableName, unknown[]> = {
  resources: resourcesData as ResourceDef[],
  recipes:   recipesData   as RecipeDef[],
  machines:  machinesData  as MachineDef[],
  chapters:  chaptersData  as ChapterDef[],
  techs:     techsData     as TechDef[],
  tasks:     tasksData     as TaskDef[],
}

const INDEX_CACHE: Partial<Record<TableName, Map<string | number, unknown>>> = {}

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
}
