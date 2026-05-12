// ============================================================
// taskStore — 独立任务系统
// ============================================================
// 负责：任务定义读取、完成条件判断、完成状态追踪、奖励发放。
// 任务可被章节、科技或未来任何系统引用，互不耦合。
// ============================================================

import { defineStore } from 'pinia'
import { db } from '../data/db'
import { TaskType } from '../data/types'
import type { TaskDef } from '../data/types'
import { useInventoryStore } from './inventoryStore'
import { usePowerStore } from './powerStore'
import { useMachineStore } from './machineStore'
import { useToolStore } from './toolStore'
import { useSteamStore } from './steamStore'
import { applyReward } from '../utils/rewards'

export interface TaskWithStatus extends TaskDef {
  completed: boolean
}

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    completedTaskIds: [] as string[],
    /** CRAFT_ITEM 任务接取后各资源的制作数量（resourceId -> count） */
    craftCounts: {} as Record<string, number>,
  }),

  getters: {
    isComplete: (state) => (taskId: string): boolean =>
      state.completedTaskIds.includes(taskId),
  },

  actions: {
    /**
     * 检查并完成指定任务列表中满足条件的任务。
     * 由 progressionStore 或其他系统传入需要检查的任务 ID。
     */
    checkTasks(taskIds: string[]): void {
      for (const id of taskIds) {
        if (this.completedTaskIds.includes(id)) continue
        const task = db.get('tasks', id)
        if (!task) continue
        if (task.prereqTaskId && !task.prereqTaskId.split(',').every((p) => this.completedTaskIds.includes(p))) continue
        if (this.evalTask(task)) this.completeTask(id)
      }
    },

    /**
     * 制作完成时由 machineStore 调用，累加 CRAFT_ITEM 任务的制作计数。
     * 只对接取过的（visible）、类型为 CRAFT_ITEM 的任务有效。
     */
    onCraftComplete(resourceId: string, amount: number): void {
      // 查找所有未完成且类型为 CRAFT_ITEM、匹配该资源的任务
      const activeTasks = db.table('tasks').filter(
        t => t.type === TaskType.CRAFT_ITEM && t.para1 === resourceId && !this.completedTaskIds.includes(t.id)
      )
      for (const _task of activeTasks) {
        this.craftCounts[resourceId] = (this.craftCounts[resourceId] ?? 0) + amount
      }
    },

    /** 强制完成一个任务（发放奖励） */
    completeTask(taskId: string): void {
      if (this.completedTaskIds.includes(taskId)) return
      this.completedTaskIds.push(taskId)

      const task = db.get('tasks', taskId)
      if (task?.rewardId) {
        const gains = applyReward(task.rewardId)
        const inv = useInventoryStore()
        for (const [resId, amt] of Object.entries(gains)) {
          inv.addItem(resId, amt)
        }
      }
    },

    /** 判断单个任务的完成条件是否满足 */
    evalTask(task: TaskDef): boolean {
      const inv      = useInventoryStore()
      const power    = usePowerStore()
      const machines = useMachineStore()

      switch (task.type) {
        case TaskType.BUILD_MACHINE:
          return (
            machines.instances.filter((m) => m.defId === task.para1).length >=
            Number(task.para2 ?? 1)
          )

        case TaskType.PRODUCE_TOTAL: {
          const resourceIds = task.para1.split(',')
          const amounts = (task.para2 ?? '').split(',').map((v) => Number(v) || 0)
          return resourceIds.every((rid, i) => (inv.totalProduced[rid] ?? 0) >= (amounts[i] ?? 0))
        }

        case TaskType.HAVE_ITEM:
          return inv.getAmount(task.para1) >= Number(task.para2 ?? 0)

        case TaskType.REACH_EU_PER_SEC:
          return power.totalGenPerSec >= Number(task.para1)

        case TaskType.HAVE_TOOL:
          return useToolStore().levels[task.para1] >= Number(task.para2 ?? 0)

        case TaskType.OWN_MACHINE:
          return machines.instances.filter((m) => m.defId === task.para1).length >= Number(task.para2 ?? 1)

        case TaskType.PRODUCE_STEAM:
          return useSteamStore().totalProducedMb >= Number(task.para1)

        case TaskType.CRAFT_ITEM:
          return (this.craftCounts[task.para1] ?? 0) >= Number(task.para2 ?? 1)

        default:
          return false
      }
    },

    /** 获取带完成状态的任务对象列表（供 UI 使用），过滤掉前置未完成的任务） */
    getTasksWithStatus(taskIds: string[]): TaskWithStatus[] {
      return taskIds
        .map((id) => {
          const task = db.get('tasks', id)
          if (!task) return null
          return { ...task, completed: this.completedTaskIds.includes(id) }
        })
        .filter((t): t is TaskWithStatus => t !== null)
        .filter((t) => !t.prereqTaskId || t.prereqTaskId.split(',').every((prereq) => this.completedTaskIds.includes(prereq)))
    },
  },
})
