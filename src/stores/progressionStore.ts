import { defineStore } from 'pinia'
import { usePowerStore } from './powerStore'
import { useInventoryStore } from './inventoryStore'
import { useTaskStore } from './taskStore'
import { db } from '../data/db'
import type { ChapterDef } from '../data/types'

export const useProgressionStore = defineStore('progression', {
  state: () => ({
    currentChapterId: 1,
    chapterUnlocked: [1] as number[],
  }),

  getters: {
    currentChapter(state): ChapterDef | null {
      return db.get('chapters', state.currentChapterId) ?? null
    },
  },

  actions: {
    unlockNextChapter(): void {
      const nextId = this.currentChapterId + 1
      if (!db.get('chapters', nextId)) return
      if (!this.chapterUnlocked.includes(nextId)) {
        this.chapterUnlocked.push(nextId)
      }
      this.currentChapterId = nextId
    },

    tick(): void {
      const chapter = db.get('chapters', this.currentChapterId)
      if (!chapter) return

      // 将当前章节的任务交给 taskStore 检查
      useTaskStore().checkTasks(chapter.taskIds)

      // 检查章节解锁条件
      const nextId = this.currentChapterId + 1
      if (!db.get('chapters', nextId)) return
      if (this.chapterUnlocked.includes(nextId)) return

      const powerStore     = usePowerStore()
      const inventoryStore = useInventoryStore()
      const { unlockCondition } = chapter
      let canUnlock = false

      switch (unlockCondition.type) {
        case 'eu_per_sec':
          canUnlock =
            unlockCondition.value !== undefined &&
            powerStore.totalGenPerSec >= unlockCondition.value
          break
        case 'item_crafted':
          if (unlockCondition.resourceId && unlockCondition.value !== undefined) {
            canUnlock =
              (inventoryStore.totalProduced[unlockCondition.resourceId] ?? 0) >=
              unlockCondition.value
          }
          break
        case 'manual':
          canUnlock = false
          break
      }

      if (canUnlock) this.unlockNextChapter()
    },
  },
})
