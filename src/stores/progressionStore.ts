import { defineStore } from 'pinia'
import { useTaskStore } from './taskStore'
import { db } from '../data/db'
import { ERA_ORDER } from '../data/types'
import type { ChapterDef, Era } from '../data/types'

export const useProgressionStore = defineStore('progression', {
  state: () => ({
    currentChapterId: 1,
    chapterCompleted: false,
    era: 'stone' as Era,
  }),

  getters: {
    currentChapter(state): ChapterDef | null {
      return db.get('chapters', state.currentChapterId) ?? null
    },
  },

  actions: {
    /** 确认当前章节已完成，可进入下一章；若章节配置了 advancesEra 则同步推进时代 */
    advanceToNextChapter(): void {
      const chapter = db.get('chapters', this.currentChapterId)
      if (chapter?.advancesEra) {
        const next = chapter.advancesEra
        if (ERA_ORDER.indexOf(next) > ERA_ORDER.indexOf(this.era)) {
          this.era = next
        }
      }
      const nextId = this.currentChapterId + 1
      if (!db.get('chapters', nextId)) return
      this.currentChapterId = nextId
      this.chapterCompleted = false
    },

    tick(): void {
      const chapter = db.get('chapters', this.currentChapterId)
      if (!chapter) return
      useTaskStore().checkTasks(chapter.taskIds)
    },

    /** 检查当前章节是否全部任务完成 */
    isChapterComplete(): boolean {
      const chapter = db.get('chapters', this.currentChapterId)
      if (!chapter) return false
      const taskStore = useTaskStore()
      return chapter.taskIds.every((id) => taskStore.isComplete(id))
    },
  },
})
