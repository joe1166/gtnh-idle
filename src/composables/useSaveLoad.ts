import { useGameStore } from '../stores/gameStore'
import { useInventoryStore } from '../stores/inventoryStore'
import { usePowerStore } from '../stores/powerStore'
import { useMachineStore } from '../stores/machineStore'
import { useProgressionStore } from '../stores/progressionStore'
import { useTechStore } from '../stores/techStore'
import { useTaskStore } from '../stores/taskStore'
import { useWorldStore } from '../stores/worldStore'
import { useToolStore } from '../stores/toolStore'

const SAVE_VERSION = '4.0.0'
const SAVE_KEY = 'gtnh_idle_save'

interface SaveData {
  version: string
  savedAt: number
  state: {
    game:        ReturnType<typeof useGameStore>['$state']
    inventory:   ReturnType<typeof useInventoryStore>['$state']
    power:       ReturnType<typeof usePowerStore>['$state']
    machines:    ReturnType<typeof useMachineStore>['$state']
    progression: ReturnType<typeof useProgressionStore>['$state']
    tasks:       ReturnType<typeof useTaskStore>['$state']
    tech?:       ReturnType<typeof useTechStore>['$state']
    world?:      ReturnType<typeof useWorldStore>['$state']
    tools?:     ReturnType<typeof useToolStore>['$state']
  }
}

export interface LoadResult {
  success: boolean
  offlineSeconds: number
}

export function useSaveLoad() {
  function save(): void {
    const data: SaveData = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      state: {
        game:        JSON.parse(JSON.stringify(useGameStore().$state)),
        inventory:   JSON.parse(JSON.stringify(useInventoryStore().$state)),
        power:       JSON.parse(JSON.stringify(usePowerStore().$state)),
        machines:    JSON.parse(JSON.stringify(useMachineStore().$state)),
        progression: JSON.parse(JSON.stringify(useProgressionStore().$state)),
        tasks:       JSON.parse(JSON.stringify(useTaskStore().$state)),
        tech:        JSON.parse(JSON.stringify(useTechStore().$state)),
        world:       JSON.parse(JSON.stringify(useWorldStore().$state)),
        tools:       JSON.parse(JSON.stringify(useToolStore().$state)),
      },
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    useGameStore().recordSave()
  }

  function load(): LoadResult {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return { success: false, offlineSeconds: 0 }

    let data: SaveData
    try {
      data = JSON.parse(raw) as SaveData
    } catch {
      return { success: false, offlineSeconds: 0 }
    }

    if (data.version !== SAVE_VERSION) {
      data = migrate(data) as SaveData
    }

    if (data.state.game)        useGameStore().$patch(data.state.game)
    if (data.state.inventory)   useInventoryStore().$patch(data.state.inventory)
    if (data.state.power)       usePowerStore().$patch(data.state.power)
    if (data.state.machines)    useMachineStore().$patch(data.state.machines)
    if (data.state.progression) useProgressionStore().$patch(data.state.progression)
    if (data.state.tasks)       useTaskStore().$patch(data.state.tasks)
    if (data.state.tech)        useTechStore().$patch(data.state.tech)
    if (data.state.world)       useWorldStore().$patch(data.state.world)
    if (data.state.tools)       useToolStore().$patch(data.state.tools)

    return { success: true, offlineSeconds: (Date.now() - data.savedAt) / 1000 }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function migrate(data: any): unknown {
    // v1.0.0 → v2.0.0：发电机从 powerStore 迁移到 machineStore
    if (data.version === '1.0.0') {
      const genInstances: Array<{
        instanceId: string; defId: string; isRunning: boolean; overclock: number
      }> = data.state?.power?.generatorInstances ?? []

      if (genInstances.length > 0) {
        const machineInstances = data.state?.machines?.instances ?? []
        for (const gen of genInstances) {
          machineInstances.push({
            instanceId:       gen.instanceId,
            defId:            gen.defId,
            isRunning:        gen.isRunning,
            selectedRecipeId: null,
            progressSec:      0,
            status:           gen.isRunning ? 'running' : 'paused',
            overclock:        gen.overclock ?? 1,
          })
        }
        data.state.machines.instances = machineInstances
      }

      data.state.tasks = { completedTaskIds: [] }
      delete data.state.progression?.completedTaskIds
      data.version = '2.0.0'
    }

    // v2.0.0 → v3.0.0：MachineInstance.overclock → selectedVoltage
    if (data.version === '2.0.0') {
      const instances: Array<Record<string, unknown>> =
        data.state?.machines?.instances ?? []

      for (const inst of instances) {
        if ('overclock' in inst) {
          // overclock=1（原默认）→ selectedVoltage=1(LV)；overclock=2 → selectedVoltage=2(MV)
          // ULV 机器后续 tick 会自动修正，这里保守给 1
          const oc = inst.overclock as number
          inst.selectedVoltage = oc >= 1 ? oc : 1
          delete inst.overclock
        } else if (!('selectedVoltage' in inst)) {
          inst.selectedVoltage = 1
        }
      }

      data.version = '3.0.0'
    }

    // v3.0.0 → v4.0.0：新增工具系统，tools 由 store 默认状态初始化，无需迁移
    if (data.version === '3.0.0') {
      data.version = '4.0.0'
    }

    return data
  }

  function exportSave(): string {
    const raw = localStorage.getItem(SAVE_KEY) ?? ''
    return btoa(unescape(encodeURIComponent(raw)))
  }

  function importSave(encoded: string): boolean {
    try {
      const raw  = decodeURIComponent(escape(atob(encoded)))
      const data = JSON.parse(raw) as Partial<SaveData>
      if (!data.version || !data.savedAt || !data.state) return false
      localStorage.setItem(SAVE_KEY, raw)
      location.reload()
      return true
    } catch {
      return false
    }
  }

  function deleteSave(): void {
    localStorage.removeItem(SAVE_KEY)
  }

  return { save, load, exportSave, importSave, deleteSave }
}
