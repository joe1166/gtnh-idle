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

export interface TaskWithStatus extends TaskDef {
  completed: boolean
}

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    completedTaskIds: [] as number[],
  }),

  getters: {
    isComplete: (state) => (taskId: number): boolean =>
      state.completedTaskIds.includes(taskId),
  },

  actions: {
    /**
     * 检查并完成指定任务列表中满足条件的任务。
     * 由 progressionStore 或其他系统传入需要检查的任务 ID。
     */
    checkTasks(taskIds: number[]): void {
      for (const id of taskIds) {
        if (this.completedTaskIds.includes(id)) continue
        const task = db.get('tasks', id)
        if (!task) continue
        if (this.evalTask(task)) this.completeTask(id)
      }
    },

    /** 强制完成一个任务（发放奖励） */
    completeTask(taskId: number): void {
      if (this.completedTaskIds.includes(taskId)) return
      this.completedTaskIds.push(taskId)

      const task = db.get('tasks', taskId)
      if (task?.rewardResourceId && task.rewardAmount) {
        useInventoryStore().addItem(task.rewardResourceId, task.rewardAmount)
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

        case TaskType.PRODUCE_TOTAL:
          return (
            (inv.totalProduced[task.para1] ?? 0) >= Number(task.para2 ?? 0)
          )

        case TaskType.HAVE_ITEM:
          return inv.getAmount(task.para1) >= Number(task.para2 ?? 0)

        case TaskType.REACH_EU_PER_SEC:
          return power.totalGenPerSec >= Number(task.para1)

        default:
          return false
      }
    },

    /** 获取带完成状态的任务对象列表（供 UI 使用） */
    getTasksWithStatus(taskIds: number[]): TaskWithStatus[] {
      return taskIds
        .map((id) => {
          const task = db.get('tasks', id)
          if (!task) return null
          return { ...task, completed: this.completedTaskIds.includes(id) }
        })
        .filter((t): t is TaskWithStatus => t !== null)
    },
  },
})
