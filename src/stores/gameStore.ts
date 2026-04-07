import { defineStore } from 'pinia'

export const useGameStore = defineStore('game', {
  state: () => ({
    gameStartedAt: Date.now(),
    totalPlaytimeSec: 0,
    tickCount: 0,
    lastSaveTime: Date.now(),
    isSimulatingOffline: false,
    offlineSimProgress: 0,   // 0-100，离线模拟进度条用
  }),

  getters: {
    /** 格式化游戏总时长（hh:mm:ss） */
    formattedPlaytime(state): string {
      const total = state.totalPlaytimeSec
      const h = Math.floor(total / 3600)
      const m = Math.floor((total % 3600) / 60)
      const s = total % 60
      return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
    },

    /** 距上次存档的秒数 */
    secondsSinceLastSave(state): number {
      return Math.floor((Date.now() - state.lastSaveTime) / 1000)
    },
  },

  actions: {
    /** 每秒调用：推进游戏时间计数器 */
    tick(): void {
      this.tickCount++
      this.totalPlaytimeSec++
    },

    /** 记录存档时间 */
    recordSave(): void {
      this.lastSaveTime = Date.now()
    },

    /** 开始/结束离线模拟 */
    setOfflineSimulating(active: boolean, progress = 0): void {
      this.isSimulatingOffline = active
      this.offlineSimProgress = active ? progress : 0
    },

    /** 更新离线模拟进度（0-100） */
    updateOfflineSimProgress(progress: number): void {
      this.offlineSimProgress = Math.min(100, Math.max(0, progress))
    },
  },
})
