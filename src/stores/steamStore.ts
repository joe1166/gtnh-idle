// ============================================================
// steamStore — 蒸汽系统
// ============================================================
// 蒸汽无法储存，每 tick 重置。
// tick 顺序：beginTick() → machineStore.tick()（内部 addSteam/consumeSteam）
// 多余蒸汽直接浪费。
// 不加入存档（无持久状态）。
// ============================================================

import { defineStore } from 'pinia'

export const useSteamStore = defineStore('steam', {
  state: () => ({
    /** 本 tick 可用蒸汽（mb），由蒸汽发生器注入，消费后减少 */
    _steamPool: 0,
    /** 上一 tick 总产出 mb/s（供 UI 展示） */
    genPerSec: 0,
    /** 上一 tick 总消耗 mb/s（供 UI 展示） */
    consumePerSec: 0,
    /** 累计产出蒸汽 mb（用于 PRODUCE_STEAM 任务追踪） */
    totalProducedMb: 0,
  }),

  getters: {
    /** 上一 tick 浪费的蒸汽 mb/s */
    wastePerSec(state): number {
      return Math.max(0, state.genPerSec - state.consumePerSec)
    },
  },

  actions: {
    /**
     * 每 tick 开始时调用，重置蒸汽池。
     * 必须在 machineStore.tick() 之前调用。
     */
    beginTick(): void {
      this._steamPool    = 0
      this.genPerSec     = 0
      this.consumePerSec = 0
    },

    /**
     * 蒸汽发生器向池子注入蒸汽。
     * @param mb 本 tick 产出的蒸汽量（mb）
     */
    addSteam(mb: number): void {
      this._steamPool += mb
      this.genPerSec += mb
      this.totalProducedMb += mb
    },

    /**
     * 从池中实际消耗蒸汽。
     * @returns 蒸汽足够返回 true 并扣除，不足返回 false（不扣除）
     */
    consumeSteam(mb: number): boolean {
      if (this._steamPool < mb) return false
      this._steamPool -= mb
      this.consumePerSec += mb
      return true
    },

    /**
     * 每 tick 结束时调用，刷新展示数据。
     * 在 machineStore.tick() 之后调用。
     */
    /** 每 tick 结束时调用（目前为空，预留扩展点） */
    tick(): void {},
  },
})
