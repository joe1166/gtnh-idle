import { db } from '../data/db'

import { useGameStore } from '../stores/gameStore'
import { useInventoryStore } from '../stores/inventoryStore'
import { usePowerStore } from '../stores/powerStore'
import { useSteamStore } from '../stores/steamStore'
import { useMachineStore } from '../stores/machineStore'
import { useProgressionStore } from '../stores/progressionStore'

import { useSaveLoad } from './useSaveLoad'

export function useGameLoop() {
  function initGame(): void {
    const inventoryStore = useInventoryStore()
    const chapters       = db.table('chapters')
    const resources      = db.table('resources')

    const chapter1ResourceIds = new Set<string>()
    for (const chapter of chapters) {
      if (chapter.id === 1 && chapter.unlocks.resourceIds) {
        for (const id of chapter.unlocks.resourceIds) {
          chapter1ResourceIds.add(id)
        }
      }
    }

    for (const resource of resources) {
      if (chapter1ResourceIds.has(resource.id) || resource.unlockedByChapter === 1) {
        inventoryStore.initResource(resource.id, resource.defaultCap)
      }
    }

    const hasAnySave = !!localStorage.getItem('gtnh_idle_save')
    if (!hasAnySave) {
      inventoryStore.addItem('coal', 200)
      inventoryStore.addItem('iron_ore', 100)
      inventoryStore.addItem('copper_ore', 60)
      inventoryStore.addItem('tin_ore', 40)
      inventoryStore.addItem('iron_ingot', 30)
      inventoryStore.addItem('iron_plate', 20)
      inventoryStore.addItem('wrench', 2)
    }
  }

  /**
   * 每秒 tick 顺序：
   * 1. gameStore        — 推进游戏时间
   * 2. steamStore.beginTick() — 重置蒸汽池（Phase 1 发生器会往里注入）
   * 3. machineStore     — Phase1: 蒸汽发生器; Phase2: EU发电机; Phase3: 合成机器
   * 4. powerStore       — 过载计数
   * 5. progressionStore — 章节解锁（内部调用 taskStore.checkTasks）
   * 6. 自动存档
   */
  function tick(): void {
    const gameStore        = useGameStore()
    const steamStore       = useSteamStore()
    const machineStore     = useMachineStore()
    const powerStore       = usePowerStore()
    const progressionStore = useProgressionStore()

    gameStore.tick()
    steamStore.beginTick()
    machineStore.tick()
    powerStore.tick()
    progressionStore.tick()

    if (!gameStore.isSimulatingOffline && gameStore.secondsSinceLastSave >= 30) {
      const { save } = useSaveLoad()
      save()
    }
  }

  function start(): ReturnType<typeof setInterval> {
    return setInterval(tick, 1000)
  }

  return { initGame, tick, start }
}
