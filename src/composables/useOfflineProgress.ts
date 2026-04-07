import { useGameStore } from '../stores/gameStore'
import { useInventoryStore } from '../stores/inventoryStore'
import { useGameLoop } from './useGameLoop'

export interface OfflineReport {
  /** 实际离线时长（秒），受 MAX_OFFLINE_SEC 限制前的原始值 */
  offlineSeconds: number
  /** 实际模拟了多少秒（经过 MAX_OFFLINE_SEC 限制后） */
  simulatedSeconds: number
  /** 各资源净增量（仅记录正增量） */
  gained: Record<string, number>
  /** 事件列表，如"煤炭耗尽，发电机停转"（预留扩展） */
  events: string[]
}

/** 最大离线时长上限：12 小时 */
const MAX_OFFLINE_SEC = 43200

/** 每批次模拟多少秒（控制 UI 响应间隔） */
const SIM_SPEED = 100

/**
 * 离线进度模拟 composable。
 * 以 100 倍速快速模拟玩家离线期间的游戏进度。
 */
export function useOfflineProgress() {
  /**
   * 获取当前所有资源数量的快照。
   */
  function takeSnapshot(): Record<string, number> {
    const inventoryStore = useInventoryStore()
    // 深拷贝，避免后续 tick 修改影响快照
    return { ...inventoryStore.items }
  }

  /**
   * 根据模拟前后快照计算离线报告。
   */
  function buildReport(
    offlineSeconds: number,
    simulatedSeconds: number,
    before: Record<string, number>,
    after: Record<string, number>,
  ): OfflineReport {
    const gained: Record<string, number> = {}

    // 合并 before 和 after 的所有键
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
    for (const key of allKeys) {
      const delta = (after[key] ?? 0) - (before[key] ?? 0)
      if (delta > 0) {
        gained[key] = delta
      }
    }

    return {
      offlineSeconds,
      simulatedSeconds,
      gained,
      events: [],  // TODO: 后续可扩展，如记录"煤炭耗尽，发电机停转"等事件
    }
  }

  /**
   * 模拟离线进度。
   * 使用异步批次（await setTimeout(0)）让出执行权，避免长时间阻塞 UI 线程。
   *
   * @param offlineSeconds 实际离线秒数
   * @returns 离线报告
   */
  async function simulate(offlineSeconds: number): Promise<OfflineReport> {
    const gameStore = useGameStore()
    const { tick } = useGameLoop()

    const actualSec = Math.min(offlineSeconds, MAX_OFFLINE_SEC)

    // 记录模拟前各资源快照
    const before = takeSnapshot()

    // 标记开始离线模拟
    gameStore.setOfflineSimulating(true, 0)

    let simulated = 0
    while (simulated < actualSec) {
      const batch = Math.min(SIM_SPEED, actualSec - simulated)

      // 同步执行本批次的所有 tick（不触发 UI 渲染）
      for (let i = 0; i < batch; i++) {
        tick()
      }

      simulated += batch

      // 每完成 1000 秒（或到达终点）更新一次进度条，并让出执行权给浏览器
      if (simulated % 1000 === 0 || simulated >= actualSec) {
        const percent = Math.floor((simulated / actualSec) * 100)
        gameStore.updateOfflineSimProgress(percent)
        // 让出执行权，允许浏览器更新 UI
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
    }

    // 标记离线模拟结束
    gameStore.setOfflineSimulating(false)

    const after = takeSnapshot()
    return buildReport(offlineSeconds, actualSec, before, after)
  }

  return { simulate }
}
