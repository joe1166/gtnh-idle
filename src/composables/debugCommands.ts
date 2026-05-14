/**
 * debugCommands.ts — 开发者控制台命令注册中心
 *
 * 命令结构：
 *   give <resourceId>:<count>          — 给资源
 *   tools [upgrade <type>[:<level>]]   — 查看/升级工具
 *   machines [add <machineId>:<count>] — 查看/添加机器
 *   complete <taskId>                 — 完成任务
 *   uncomplete <taskId>                — 重置任务
 *   set_chapter <chapterId>            — 跳转章节
 *   power | resources | tasks | help   — 状态查看
 */

import { useInventoryStore } from '../stores/inventoryStore'
import { useMachineStore } from '../stores/machineStore'
import { useWorldStore } from '../stores/worldStore'
import { useTaskStore } from '../stores/taskStore'
import { useProgressionStore } from '../stores/progressionStore'
import { useToolStore } from '../stores/toolStore'
import { usePowerStore } from '../stores/powerStore'
import { useSteamStore } from '../stores/steamStore'
import { db } from '../data/db'

export interface DebugCommand {
  name: string
  description: string
  execute(args: string[]): string
}

const _commands: DebugCommand[] = []

export function registerCommand(cmd: DebugCommand): void {
  _commands.push(cmd)
}

export function getCommands(): DebugCommand[] {
  return [..._commands]
}

export function runCommand(input: string): string {
  const parts = input.trim().split(/\s+/)
  if (parts.length === 0 || parts[0] === '') return '输入 help 查看命令'
  const name = parts[0].toLowerCase()
  const args = parts.slice(1)

  for (const cmd of _commands) {
    if (cmd.name === name) return cmd.execute(args)
  }

  const matches = _commands.filter(c => c.name.startsWith(name))
  if (matches.length === 1) return matches[0].execute(args)
  if (matches.length > 1) return `模糊匹配: ${matches.map(c => c.name).join(', ')}`

  return `未知命令: ${name}，输入 help 查看`
}

// ============================================================
// 通用
// ============================================================

registerCommand({
  name: 'help',
  description: '显示所有命令',
  execute() {
    return _commands.map(c => `  ${c.name.padEnd(20)} ${c.description}`).join('\n')
  },
})

// ============================================================
// give
// ============================================================

registerCommand({
  name: 'give',
  description: '给资源  用法: give <resourceId>:<count>',
  execute(args) {
    if (args.length < 1) return this.description
    const [id, countStr] = args[0].split(':')
    const count = parseInt(countStr, 10) || 1
    const inv = useInventoryStore()
    inv.initResource(id, 99999)
    inv.addItem(id, count)
    return `✓ 给了 ${id} x${count}`
  },
})

// ============================================================
// tools
// ============================================================

registerCommand({
  name: 'tools',
  description: '查看/升级工具  用法: tools [upgrade <type>[:<level>]]',
  execute(args) {
    const toolStore = useToolStore()

    // 无参数或 tools list：显示当前等级
    if (args.length === 0 || (args[0] === 'list')) {
      const lines = ['（当前等级）']
      for (const [type, level] of Object.entries(toolStore.levels)) {
        const next = toolStore.getNextLevelDef(type)
        const nextCost = next ? `下一级: ${next.upgradeCost.map(c => `${c.resourceId}×${c.amount}`).join(', ')}` : '已满级'
        lines.push(`  ${type.padEnd(10)} Lv.${level}  ${nextCost}`)
      }
      lines.push('', '（配置表所有工具类型）')
      for (const [type, defs] of Object.entries(db.toolsByType())) {
        const levels = defs.map(d => `Lv.${d.level}`).join(', ')
        lines.push(`  ${type.padEnd(10)} [${levels}]`)
      }
      return lines.join('\n')
    }

    // tools upgrade <type>[:<level>]
    if (args[0] === 'upgrade') {
      if (args.length < 2) return '用法: tools upgrade <type>[:<level>]'
      const [type, levelStr] = args[1].split(':')
      const toolDefs = db.toolsByType()[type]
      if (!toolDefs || toolDefs.length === 0) {
        return `工具类型不存在，可用: ${Object.keys(toolStore.levels).join(', ')}`
      }
      const minLevel = Math.min(...toolDefs.map(d => d.level))
      const maxLevel = Math.max(...toolDefs.map(d => d.level))
      const targetLevel = levelStr === undefined ? maxLevel : parseInt(levelStr, 10)
      if (isNaN(targetLevel)) return `等级无效: ${levelStr}`
      const startLevel = toolStore.levels[type] ?? minLevel
      if (targetLevel > maxLevel) return `${type} 最高 Lv.${maxLevel}`
      if (targetLevel <= startLevel) return `${type} 当前 Lv.${startLevel}，无需升级`
      for (let lvl = startLevel; lvl < targetLevel; lvl++) {
        toolStore.upgradeTool(type)
      }
      return `✓ ${type} 已升到 Lv.${toolStore.levels[type]}`
    }

    return this.description
  },
})

// ============================================================
// machines
// ============================================================

registerCommand({
  name: 'machines',
  description: '查看/添加机器  用法: machines [add <machineId>:<count>]',
  execute(args) {
    const machineStore = useMachineStore()

    // 无参数或 machines list：显示当前实例
    if (args.length === 0 || (args[0] === 'list')) {
      const lines = ['（当前实例）']
      if (machineStore.instances.length === 0) {
        lines.push('  无')
      } else {
        const byDefId: Record<string, number> = {}
        for (const inst of machineStore.instances) {
          byDefId[inst.defId] = (byDefId[inst.defId] ?? 0) + 1
        }
        for (const [id, count] of Object.entries(byDefId)) {
          lines.push(`  ${id} x${count}`)
        }
      }
      lines.push('', '（配置表所有机器）')
      for (const m of db.table('machines')) {
        lines.push(`  ${m.id.padEnd(25)} role=${m.role} tier=${m.tier} cat=${m.category}`)
      }
      return lines.join('\n')
    }

    // machines add <machineId>:<count>
    if (args[0] === 'add') {
      if (args.length < 2) return '用法: machines add <machineId>:<count>'
      const [id, countStr] = args[1].split(':')
      const count = parseInt(countStr, 10) || 1
      for (let i = 0; i < count; i++) machineStore.buildMachine(id)
      return `✓ 添加了 ${id} x${count}`
    }

    return this.description
  },
})

// ============================================================
// tasks
// ============================================================

registerCommand({
  name: 'tasks',
  description: '显示当前章节所有任务状态',
  execute() {
    const taskStore = useTaskStore()
    const progStore = useProgressionStore()
    const chapter = db.get('chapters', progStore.currentChapterId)
    if (!chapter) return '无章节'

    const tasks = taskStore.getTasksWithStatus(chapter.taskIds)
    const lines = [`[${chapter.id}] 章节任务`, '']
    for (const t of tasks) {
      const flag = t.completed ? '✓' : ' '
      const pre = t.prereqTaskId ? ` [需:${t.prereqTaskId}]` : ''
      lines.push(`${flag} ${t.id.padEnd(35)}${pre}`)
    }
    return lines.join('\n')
  },
})

// ============================================================
// complete / uncomplete
// ============================================================

registerCommand({
  name: 'complete',
  description: '强制完成任务  用法: complete <taskId>',
  execute(args) {
    if (args.length < 1) return this.description
    const taskStore = useTaskStore()
    const task = db.get('tasks', args[0])
    if (!task) return `任务不存在: ${args[0]}`
    taskStore.completeTask(args[0])
    return `✓ 已完成任务: ${args[0]}`
  },
})

registerCommand({
  name: 'uncomplete',
  description: '重置任务完成状态  用法: uncomplete <taskId>',
  execute(args) {
    if (args.length < 1) return this.description
    const taskStore = useTaskStore()
    taskStore.completedTaskIds = taskStore.completedTaskIds.filter(id => id !== args[0])
    return `✓ 已重置任务: ${args[0]}`
  },
})

// ============================================================
// set_chapter
// ============================================================

registerCommand({
  name: 'set_chapter',
  description: '跳转章节  用法: set_chapter <chapterId>',
  execute(args) {
    if (args.length < 1) return this.description
    const id = parseInt(args[0], 10)
    const chapter = db.get('chapters', id)
    if (!chapter) return `章节不存在: ${id}`
    const progStore = useProgressionStore()
    progStore.currentChapterId = id
    progStore.chapterCompleted = false
    return `✓ 已跳转至章节 ${id}`
  },
})

// ============================================================
// power / resources
// ============================================================

registerCommand({
  name: 'power',
  description: '显示电力状态',
  execute() {
    const ps = usePowerStore()
    const net = ps.totalGenPerSec - ps.totalConsumePerSec
    return [
      `  电池: ${Math.round(ps.batteryCurrentEU)} / ${ps.batteryCapacityEU} EU`,
      `  发电: ${ps.totalGenPerSec.toFixed(1)} EU/s`,
      `  消耗: ${ps.totalConsumePerSec.toFixed(1)} EU/s`,
      `  净产: ${net.toFixed(1)} EU/s`,
      `  电压: ${ps.globalMaxVoltage > 0 ? `Tier ${ps.globalMaxVoltage}` : '无发电机'}`,
    ].join('\n')
  },
})

registerCommand({
  name: 'timed',
  description: '显示 timed 节点状态（调试存档用）',
  execute() {
    const ws = useWorldStore()
    const entries = Object.entries(ws.timedNodes)
    if (entries.length === 0) return '无 timed 节点'
    const now = Date.now()
    return entries.map(([id, s]) => {
      const remaining = Math.max(0, Math.ceil((s.endAt - now) / 1000))
      const elapsed = Math.floor((now - s.startAt) / 1000)
      const total = Math.floor((s.endAt - s.startAt) / 1000)
      return `  ${id.padEnd(25)} ${s.done ? '✓完成' : `倒计时${remaining}s`} (已过${elapsed}s/共${total}s)`
    }).join('\n')
  },
})

registerCommand({
  name: 'resources',
  description: '显示资源库存（仅数量>0）',
  execute() {
    const inv = useInventoryStore()
    const lines = []
    for (const [resId, amount] of Object.entries(inv.items)) {
      if (amount > 0) lines.push(`  ${resId.padEnd(25)} ${amount}`)
    }
    return lines.length === 0 ? '无资源' : lines.join('\n')
  },
})

// ============================================================
// 存档 / 充能
// ============================================================

registerCommand({
  name: 'add_steam',
  description: '增加蒸汽产出  用法: add_steam <mb>',
  execute(args) {
    const mb = parseInt(args[0], 10) || 0
    const steamStore = useSteamStore()
    steamStore.totalProducedMb += mb
    return `✓ 蒸汽产出增加 ${mb} MB（累计: ${steamStore.totalProducedMb} MB）`
  },
})

registerCommand({
  name: 'infuse_power',
  description: '给电池充能  用法: infuse_power <eu>',
  execute(args) {
    const eu = parseInt(args[0], 10) || 0
    const ps = usePowerStore()
    ps.batteryCurrentEU = Math.min(ps.batteryCurrentEU + eu, ps.batteryCapacityEU)
    return `✓ 电池充能 +${eu} EU（当前: ${Math.round(ps.batteryCurrentEU)} EU）`
  },
})

registerCommand({
  name: 'clear_save',
  description: '删除当前存档',
  execute() {
    localStorage.removeItem('gtnh_idle_save')
    return '✓ 存档已删除，刷新后将重新开始'
  },
})
