import { defineStore } from 'pinia'
import { useInventoryStore } from './inventoryStore'
import { usePowerStore } from './powerStore'
import { useSteamStore } from './steamStore'
import { useTaskStore } from './taskStore'
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

// 每个 defId 独立的计数器，instanceId 格式为 `${defId}_${counter}`
// 例如 hand_assembly_1, hand_assembly_2, workbench_1, furnace_3
// HMR 会重置 _counters，但 load() 会调用 syncCountersFromInstances() 从 localStorage 恢复的实例中同步最大序号
const _counters: Record<string, number> = {}

function nextInstanceId(defId: string): string {
  _counters[defId] = (_counters[defId] ?? 0) + 1
  return `${defId}_${_counters[defId]}`
}

/**
 * 从已有实例列表中同步计数器。
 * load() 后调用一次，确保 _counters 从已恢复的 instance ID 中的最大值开始递增，
 * 避免 HMR 重置 _counters 后新建实例的 ID 与 localStorage 中的旧 ID 冲突。
 */
function syncCountersFromInstances(instances: MachineInstance[]): void {
  for (const inst of instances) {
    const match = inst.instanceId.match(/^([^_]+)_(\d+)$/)
    if (!match) continue
    const defId = match[1]
    const num = parseInt(match[2], 10)
    if (!isNaN(num) && (_counters[defId] ?? 0) < num) {
      _counters[defId] = num
    }
  }
}

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

      // 新建机器默认选中第一个可用配方
      const firstRecipe = initialRecipeId ?? (
        def.category === 1 && def.role
          ? (() => {
              const candidates = db.filter('recipes', (r) =>
                r.requiredRole === def.role &&
                r.requiredLevel <= def.tier &&
                (r.maxRequiredLevel == null || r.maxRequiredLevel >= def.tier)
              )
              return candidates.length > 0 ? candidates[0].id : null
            })()
          : null
      )
      // 默认电压：min(机器可承受最大电压, 全局最大电压)，maxVoltage=-1 的不耗电机器保持 -1
      const maxV = def.maxVoltage ?? 0
      const globalV = usePowerStore().globalMaxVoltage
      const defaultVoltage = maxV === -1 ? -1 : Math.min(maxV, Math.max(0, globalV))

      const newId = nextInstanceId(defId)
      this.instances.push({
        instanceId:      newId,
        defId,
        isRunning:       false,
        selectedRecipeId: firstRecipe,
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
      const firstRecipe =
        def.category === 1 && def.role
          ? (() => {
              const candidates = db.filter('recipes', (r) =>
                r.requiredRole === def.role &&
                r.requiredLevel <= def.tier &&
                (r.maxRequiredLevel == null || r.maxRequiredLevel >= def.tier)
              )
              return candidates.length > 0 ? candidates[0].id : null
            })()
          : null
      const maxV = def.maxVoltage ?? 0
      const globalV = usePowerStore().globalMaxVoltage
      const defaultVoltage = maxV === -1 ? -1 : Math.min(maxV, Math.max(0, globalV))
      this.instances.push({
        instanceId:      nextInstanceId(defId),
        defId,
        isRunning:       false,
        selectedRecipeId: firstRecipe,
        progressSec:     0,
        status:          'paused',
        selectedVoltage: defaultVoltage,
      })
    },

    /** 从外部（useSaveLoad.load）调用，将已恢复实例的 ID 序号同步到计数器，防止新建实例的 ID 与旧 ID 冲突 */
    syncCounters(instances: MachineInstance[]): void {
      syncCountersFromInstances(instances)
    },

    /** 清理配置中已不存在的机器实例（如删除了某机器类型），避免旧存档残留机器显示异常 */
    removeInvalidInstances(): void {
      const before = this.instances.length
      this.instances = this.instances.filter((m) => !!getMachineDef(m.defId))
      const removed = before - this.instances.length
      if (removed > 0) console.log(`[machineStore] 清理了 ${removed} 个无效机器实例`)
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

        // instantMode=1 的机器完全由 UI 驱动，tick 中跳过
        if ((def.instantMode ?? 0) === 1) continue

        if (!m.isRunning) { m.status = 'paused'; continue }

        const recipe = m.selectedRecipeId ? getRecipeDef(m.selectedRecipeId) : null
        if (!recipe) {
          m.status = 'no_recipe'; continue
        }

        // ── 启动前检查：所有条件先检查，全部通过后再扣材料 ──
        if (m.progressSec === 0) {
          // 电压检查
          if (m.selectedVoltage < recipe.voltage) {
            m.status = 'no_power'
            m.progressSec = 0
            continue
          }
          // 材料检查（只检查，不扣）
          if (!inventoryStore.canAfford(recipe.inputs)) {
            m.status = 'no_material'
            m.progressSec = 0
            continue
          }
          // 全部通过后才扣材料
          inventoryStore.spend(recipe.inputs)
        }

        // ── 每 tick 扣能源 ──
        const tiers = m.selectedVoltage - recipe.voltage
        const euCost = recipe.euPerSec * Math.pow(4, tiers)
        if (recipe.voltage !== -1) {
          let consumed = false
          if (recipe.voltage === VoltTier.ULV) {
            consumed = steamStore.consumeSteam(euCost * 1000)
          } else {
            consumed = powerStore.consumeEU(euCost)
          }
          if (!consumed) {
            m.status = 'no_power'
            m.progressSec = 0
            continue
          }
        }

        // 速度倍率（超频）
        const speedMult = calcSpeedMult(recipe.overclock, tiers)
        m.progressSec += speedMult
        m.status = 'running'

        if (m.progressSec >= recipe.durationSec) {
          for (const output of recipe.outputs) {
            inventoryStore.addItem(output.resourceId, output.amount)
          }
          useTaskStore().onCraftComplete(recipe.outputs[0].resourceId, recipe.outputs[0].amount)
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
