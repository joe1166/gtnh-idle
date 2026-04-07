import { defineStore } from 'pinia'

interface Cost {
  resourceId: string
  amount: number
}

export const useInventoryStore = defineStore('inventory', {
  state: () => ({
    items: {} as Record<string, number>,        // resourceId -> 当前数量
    caps: {} as Record<string, number>,         // resourceId -> 上限
    totalProduced: {} as Record<string, number>, // resourceId -> 累计产出（用于任务追踪）
  }),

  getters: {
    getAmount: (state) => (id: string): number => state.items[id] ?? 0,
    getCap: (state) => (id: string): number => state.caps[id] ?? 0,
  },

  actions: {
    /** 初始化一个资源槽（如果已存在则不覆盖数量，只确保槽位存在） */
    initResource(id: string, defaultCap: number): void {
      if (!(id in this.items)) {
        this.items[id] = 0
      }
      if (!(id in this.caps)) {
        this.caps[id] = defaultCap
      }
      if (!(id in this.totalProduced)) {
        this.totalProduced[id] = 0
      }
    },

    /** 检查是否能负担一组消耗 */
    canAfford(costs: Cost[]): boolean {
      for (const cost of costs) {
        if ((this.items[cost.resourceId] ?? 0) < cost.amount) {
          return false
        }
      }
      return true
    },

    /** 消耗资源；若资源不足则不执行并返回 false */
    spend(costs: Cost[]): boolean {
      if (!this.canAfford(costs)) return false
      for (const cost of costs) {
        this.items[cost.resourceId] = (this.items[cost.resourceId] ?? 0) - cost.amount
      }
      return true
    },

    /** 增加资源数量，自动 clamp 到上限 */
    addItem(resourceId: string, amount: number): void {
      const current = this.items[resourceId] ?? 0
      const cap = this.caps[resourceId] ?? Infinity
      const added = Math.min(current + amount, cap) - current
      this.items[resourceId] = current + added

      // 累计产出（不受上限限制，记录实际新增量）
      if (added > 0) {
        this.totalProduced[resourceId] = (this.totalProduced[resourceId] ?? 0) + added
      }
    },

    /** 设置资源上限 */
    setCap(resourceId: string, cap: number): void {
      this.caps[resourceId] = cap
      // 若当前数量超过新上限，clamp 之
      if ((this.items[resourceId] ?? 0) > cap) {
        this.items[resourceId] = cap
      }
    },
  },
})
