import { useGameStore } from '../stores/gameStore'
import { useInventoryStore } from '../stores/inventoryStore'
import { usePowerStore } from '../stores/powerStore'
import { useMachineStore } from '../stores/machineStore'
import { useProgressionStore } from '../stores/progressionStore'
import { useTechStore } from '../stores/techStore'
import { useTaskStore } from '../stores/taskStore'
import { useWorldStore } from '../stores/worldStore'
import { useToolStore } from '../stores/toolStore'
import { useMineStore } from '../stores/mineStore'
import { useExploreStore } from '../stores/exploreStore'
import { useEquipmentStore } from '../stores/equipmentStore'
import { SAVE_VERSION } from '../data/version'

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
    tools?:      ReturnType<typeof useToolStore>['$state']
    mine?:       ReturnType<typeof useMineStore>['$state']
    explore?:    ReturnType<typeof useExploreStore>['$state']
    equipment?:  ReturnType<typeof useEquipmentStore>['$state']
  }
}

export interface LoadResult {
  success: boolean
  incompatible: boolean
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
        mine:        JSON.parse(JSON.stringify(useMineStore().$state)),
        explore:     JSON.parse(JSON.stringify(useExploreStore().$state)),
        equipment:   JSON.parse(JSON.stringify(useEquipmentStore().$state)),
      },
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    useGameStore().recordSave()
  }

  function load(): LoadResult {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return { success: false, incompatible: false, offlineSeconds: 0 }

    let data: SaveData
    try {
      data = JSON.parse(raw) as SaveData
    } catch {
      return { success: false, incompatible: false, offlineSeconds: 0 }
    }

    if (data.version !== SAVE_VERSION) {
      return { success: false, incompatible: true, offlineSeconds: 0 }
    }

    if (data.state.game)        useGameStore().$patch(data.state.game)
    if (data.state.inventory)   useInventoryStore().$patch(data.state.inventory)
    if (data.state.power)       usePowerStore().$patch(data.state.power)
    if (data.state.machines)    useMachineStore().$patch(data.state.machines)
    if (data.state.machines?.instances) {
      useMachineStore().syncCounters(data.state.machines.instances)
    }
    useMachineStore().removeInvalidInstances()
    useGameStore().setOfflineSimulating(false, 0)
    if (data.state.progression) useProgressionStore().$patch(data.state.progression)
    if (data.state.tasks)       useTaskStore().$patch(data.state.tasks)
    if (data.state.tech)        useTechStore().$patch(data.state.tech)
    if (data.state.world)       useWorldStore().$patch(data.state.world)
    if (data.state.tools)       useToolStore().$patch(data.state.tools)
    if (data.state.mine)        useMineStore().$patch(data.state.mine)
    if (data.state.explore)     useExploreStore().$patch(data.state.explore)
    if (data.state.equipment)   useEquipmentStore().$patch(data.state.equipment)

    // 矿洞会话不跨刷新延续：重登时按“未带走任何物品直接退出”处理。
    if (useMineStore().entered) {
      useMineStore().abandonSessionOnReload()
    }

    // 遗迹探索会话不跨刷新延续：重登时按“未带走任何物品直接退出”处理。
    if (useExploreStore().entered) {
      useExploreStore().abandonSessionOnReload()
    }

    return { success: true, incompatible: false, offlineSeconds: (Date.now() - data.savedAt) / 1000 }
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
