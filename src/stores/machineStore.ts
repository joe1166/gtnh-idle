import { defineStore } from 'pinia'
import { useInventoryStore } from './inventoryStore'
import { usePowerStore } from './powerStore'
import { useSteamStore } from './steamStore'
import { db } from '../data/db'
import { VoltTier } from '../data/types'
import type { MachineDef, RecipeDef, MachineInstance, MachineStatus } from '../data/types'

export type { MachineStatus, MachineInstance }

function getMachineDef(id: string): MachineDef | undefined {
  return db.get('machines', id)
}
function getRecipeDef(id: string): RecipeDef | undefined {
  return db.get('recipes', id)
}

let _nextId = 1

export const useMachineStore = defineStore('machines', {
  state: () => ({
    instances: [] as MachineInstance[],
  }),

  getters: {
    /** 所有运行中合成机器（category=1）的 EU/s 总消耗（含超频，蒸汽机除外） */
    totalEUConsumePerSec(state): number {
      return state.instances
        .filter((m) => m.status === 'running')
        .reduce((sum, m) => {
          const def = getMachineDef(m.defId)
          if (!def || def.category !== 1) return sum
          const recipe = m.selectedRecipeId ? getRecipeDef(m.selectedRecipeId) : null
          if (!recipe) return sum
          // ULV 配方用蒸汽，不计入 EU 消耗
          if (recipe.voltage === VoltTier.ULV) return sum
          const tiers = Math.max(0, m.selectedVoltage - recipe.voltage)
          return sum + recipe.euPerSec * Math.pow(4, tiers)
        }, 0)
    },

    /** 所有运行中 EU 发电机（category=2）的额定 EU/s 总产出 */
    totalGenPerSec(state): number {
      return state.instances
        .filter((m) => m.isRunning && m.status === 'running')
        .reduce((sum, m) => {
          const def = getMachineDef(m.defId)
          if (!def || def.category !== 2) return sum
          return sum + def.euPerSec
        }, 0)
    },

    /** 所有运行中蒸汽发生器（category=3）的额定蒸汽 mb/s 总产出 */
    totalSteamGenPerSec(state): number {
      return state.instances
        .filter((m) => m.isRunning && m.status === 'running')
        .reduce((sum, m) => {
          const def = getMachineDef(m.defId)
          if (!def || def.category !== 3) return sum
          return sum + def.euPerSec * 1000
        }, 0)
    },

    /**
     * 玩家当前可使用的最高电压等级。
     * 取所有运行中 EU 发电机（category=2）的最高 voltage。
     * 若没有 EU 发电机在运行则为 -1（无 EU 供应）。
     */
    globalMaxVoltage(state): number {
      let max = -1
      for (const m of state.instances) {
        if (!m.isRunning) continue
        const def = getMachineDef(m.defId)
        if (!def || def.category !== 2) continue
        const v = def.voltage ?? VoltTier.LV
        if (v > max) max = v
      }
      return max
    },
  },

  actions: {
    /**
     * 建造一台机器（合成机器/发电机/蒸汽发生器均通过此方法）。
     * @param initialRecipeId 可选，指定初始配方（矿机场景使用）
     */
    buildMachine(defId: string, initialRecipeId?: string): boolean {
      const def = getMachineDef(defId)
      if (!def) return false

      const inventoryStore = useInventoryStore()
      if (!inventoryStore.spend(def.buildCost)) return false

      const autoRecipe =
        initialRecipeId ?? (
          def.category === 1 && def.role
            ? (() => {
                const candidates = db.filter('recipes', (r) => r.requiredRole === def.role && r.requiredLevel <= def.tier)
                return candidates.length === 1 ? candidates[0].id : null
              })()
            : null
        )

      // 默认电压：取机器可承受的最大值（min(machine.maxVoltage, globalMaxVoltage)）
      const defaultVoltage = Math.min((def as any).maxVoltage ?? 0, (usePowerStore().globalMaxVoltage))

      this.instances.push({
        instanceId:      `machine_${_nextId++}`,
        defId,
        isRunning:       false,
        selectedRecipeId: autoRecipe,
        progressSec:     0,
        status:          'paused',
        selectedVoltage: defaultVoltage,
      })
      return true
    },

    /** 直接给玩家一台机器（不消耗材料，用于开局赠送） */
    giveFreeMachine(defId: string): void {
      const def = getMachineDef(defId)
      if (!def) return
      const autoRecipe =
        def.category === 1 && def.role
          ? (() => {
              const candidates = db.filter('recipes', (r) => r.requiredRole === def.role && r.requiredLevel <= def.tier)
              return candidates.length === 1 ? candidates[0].id : null
            })()
          : null
      const defaultVoltage = Math.min((def as any).maxVoltage ?? 0, (usePowerStore().globalMaxVoltage))
      this.instances.push({
        instanceId:      `machine_${_nextId++}`,
        defId,
        isRunning:       false,
        selectedRecipeId: autoRecipe,
        progressSec:     0,
        status:          'paused',
        selectedVoltage: defaultVoltage,
      })
    },

    toggleMachine(instanceId: string): void {
      const m = this.instances.find((m) => m.instanceId === instanceId)
      if (!m) return
      m.isRunning = !m.isRunning
      if (!m.isRunning) {
        m.status = 'paused'
        m.progressSec = 0
      }
    },

    setRecipe(instanceId: string, recipeId: string): void {
      const m = this.instances.find((m) => m.instanceId === instanceId)
      if (!m) return
      m.selectedRecipeId = recipeId
      m.progressSec = 0
      m.status = m.isRunning ? 'no_recipe' : 'paused'
      // 切换配方时，若新配方要求电压高于当前选择，自动调整
      const recipe = getRecipeDef(recipeId)
      if (recipe && m.selectedVoltage < recipe.voltage) {
        m.selectedVoltage = recipe.voltage
      }
    },

    /**
     * 设置机器供电电压。
     * - ULV 机器（maxVoltage=0）固定为 0，不允许修改
     * - 超出 machine.maxVoltage：TODO 爆炸逻辑
     */
    setVoltage(instanceId: string, voltage: number): void {
      const m = this.instances.find((m) => m.instanceId === instanceId)
      if (!m) return
      const def = getMachineDef(m.defId)
      if (!def) return
      // ULV 机器不允许调整
      if (def.maxVoltage === VoltTier.ULV) return
      // TODO: 超出 maxVoltage 时触发爆炸逻辑
      m.selectedVoltage = Math.max(0, voltage)
    },

    /**
     * 每秒核心 tick。
     *
     * Phase 1（蒸汽发生器 category=3）：消耗燃料，向蒸汽池注入蒸汽。
     * Phase 2（EU 发电机 category=2）：消耗燃料，向电池充电。
     * Phase 3（合成机器 category=1）：
     *   - recipe.voltage=0 → 消耗蒸汽
     *   - recipe.voltage>0 → 消耗 EU
     *   - 超频计算按 selectedVoltage - recipe.voltage 档数
     */
    tick(): void {
      const inventoryStore = useInventoryStore()
      const powerStore     = usePowerStore()
      const steamStore     = useSteamStore()

      // ── Phase 1: 蒸汽发生器 ───────────────────────────────────
      for (const m of this.instances) {
        const def = getMachineDef(m.defId)
        if (!def || def.category !== 3) continue

        if (!m.isRunning) { m.status = 'paused'; continue }

        const fuelNeeded = (def.fuelPerSec ?? 0)
        if (inventoryStore.getAmount(def.fuelResourceId ?? '') < fuelNeeded) {
          m.status = 'no_fuel'; continue
        }

        inventoryStore.spend([{ resourceId: def.fuelResourceId!, amount: fuelNeeded }])
        // euPerSec 在蒸汽发生器上表示折算 EU 值，×1000 = mb/s
        steamStore.addSteam(def.euPerSec * 1000)
        m.status = 'running'
      }

      // ── Phase 2: EU 发电机 ────────────────────────────────────
      for (const m of this.instances) {
        const def = getMachineDef(m.defId)
        if (!def || def.category !== 2) continue

        if (!m.isRunning) { m.status = 'paused'; continue }

        const fuelNeeded = (def.fuelPerSec ?? 0)
        if (inventoryStore.getAmount(def.fuelResourceId ?? '') < fuelNeeded) {
          m.status = 'no_fuel'; continue
        }

        inventoryStore.spend([{ resourceId: def.fuelResourceId!, amount: fuelNeeded }])
        powerStore.addEU(def.euPerSec)
        m.status = 'running'
      }

      // ── Phase 3: 合成机器 ─────────────────────────────────────
      for (const m of this.instances) {
        const def = getMachineDef(m.defId)
        if (!def || def.category !== 1) continue

        if (!m.isRunning) { m.status = 'paused'; continue }

        const recipe = m.selectedRecipeId ? getRecipeDef(m.selectedRecipeId) : null
        if (!recipe) { m.status = 'no_recipe'; continue }

        // 超频档数（selectedVoltage 必须 >= recipe.voltage 才能运行）
        if (m.selectedVoltage < recipe.voltage) {
          m.status = 'no_power'; continue
        }
        const tiers = m.selectedVoltage - recipe.voltage

        // 超频后 EU 消耗（GT 公式：×4^tiers）
        const euCost = recipe.euPerSec * Math.pow(4, tiers)

        // 超频后速度倍率
        const speedMult = calcSpeedMult(recipe.overclock, tiers)

        // 消耗能源（ULV 用蒸汽，其他用 EU）
        if (recipe.voltage === VoltTier.ULV) {
          const steamCost = euCost * 1000
          if (!steamStore.consumeSteam(steamCost)) {
            m.status = 'no_steam'; continue
          }
        } else {
          if (!powerStore.consumeEU(euCost)) {
            m.status = 'no_power'; continue
          }
        }

        // 首次开始处理时检查材料
        if (m.progressSec === 0) {
          if (!inventoryStore.canAfford(recipe.inputs)) {
            // 退还能源
            if (recipe.voltage === VoltTier.ULV) {
              steamStore.addSteam(euCost * 1000)
            } else {
              powerStore.addEU(euCost)
            }
            m.status = 'no_material'; continue
          }
          inventoryStore.spend(recipe.inputs)
        }

        m.progressSec += speedMult
        m.status = 'running'

        if (m.progressSec >= recipe.durationSec) {
          for (const output of recipe.outputs) {
            inventoryStore.addItem(output.resourceId, output.amount)
          }
          m.progressSec = 0
        }
      }
    },
  },
})

/**
 * 计算超频后的速度倍率。
 * @param overclockMode 0=不可超频, 1=有损, 2=无损
 * @param tiers 超频档数
 */
function calcSpeedMult(overclockMode: number, tiers: number): number {
  if (tiers <= 0 || overclockMode === 0) return 1
  if (overclockMode === 2) return Math.pow(4, tiers) // 无损：×4^tiers
  return Math.pow(2, tiers)                          // 有损：×2^tiers
}
