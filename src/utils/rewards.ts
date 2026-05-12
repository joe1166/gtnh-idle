import { db } from '../data/db'

/**
 * 根据 rewardId 计算本次获得的道具。
 * - fixed 部分全部给出（可叠加 fixedBonus，用于能力加成）
 * - pool 部分按权重随机抽取一项（resourceId='nothing' 或空时跳过）
 * @param rewardId  奖励定义 ID（0 = 无奖励）
 * @param fixedBonus 额外叠加到每个 fixed 条目的数量（默认 0）
 */
export function applyReward(
  rewardId: number,
  fixedBonus = 0,
): Record<string, number> {
  if (!rewardId) return {}
  const def = db.get('rewards', rewardId)
  if (!def) return {}

  const gains: Record<string, number> = {}

  for (const entry of def.fixed) {
    if (!entry.resourceId) continue
    const amt = entry.amount + fixedBonus
    if (amt > 0) gains[entry.resourceId] = (gains[entry.resourceId] ?? 0) + amt
  }

  if (def.pool.length > 0) {
    const totalWeight = def.pool.reduce((s, e) => s + e.weight, 0)
    let roll = Math.random() * totalWeight
    for (const entry of def.pool) {
      roll -= entry.weight
      if (roll <= 0) {
        if (entry.resourceId && entry.resourceId !== 'nothing' && entry.amount > 0) {
          gains[entry.resourceId] = (gains[entry.resourceId] ?? 0) + entry.amount
        }
        break
      }
    }
  }

  return gains
}
