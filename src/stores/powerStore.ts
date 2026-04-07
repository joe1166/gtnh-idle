import { defineStore } from 'pinia'
import { useMachineStore } from './machineStore'

export const usePowerStore = defineStore('power', {
  state: () => ({
    batteryCurrentEU:  0,
    batteryCapacityEU: 100,
    overloadSeconds:   0,
  }),

  getters: {
    /** 所有运行中 EU 发电机的额定 EU/s（用于显示和任务判断） */
    totalGenPerSec(): number {
      return useMachineStore().totalGenPerSec
    },

    /** 所有运行中合成机器的 EU/s 消耗 */
    totalConsumePerSec(): number {
      return useMachineStore().totalEUConsumePerSec
    },

    netPerSec(): number {
      return this.totalGenPerSec - this.totalConsumePerSec
    },

    batteryPercent(state): number {
      if (state.batteryCapacityEU <= 0) return 0
      return Math.min(100, Math.max(0, (state.batteryCurrentEU / state.batteryCapacityEU) * 100))
    },

    /**
     * 玩家当前可使用的最高 EU 电压等级。
     * 委托 machineStore 计算（取运行中 EU 发电机最高 voltage）。
     * -1 表示没有 EU 发电机在运行。
     */
    globalMaxVoltage(): number {
      return useMachineStore().globalMaxVoltage
    },
  },

  actions: {
    addEU(amount: number): void {
      this.batteryCurrentEU = Math.min(
        this.batteryCurrentEU + amount,
        this.batteryCapacityEU,
      )
    },

    consumeEU(amount: number): boolean {
      if (this.batteryCurrentEU < amount) return false
      this.batteryCurrentEU = Math.max(0, this.batteryCurrentEU - amount)
      return true
    },

    tick(): void {
      const net = this.netPerSec
      if (this.batteryCurrentEU >= this.batteryCapacityEU && net > 0) {
        this.overloadSeconds++
      } else {
        this.overloadSeconds = 0
      }
    },
  },
})
