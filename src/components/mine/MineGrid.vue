<template>
  <div
    ref="gridEl"
    class="mine-grid"
    :style="{ '--cols': store.cols }"
  >
    <!-- 深度 HUD 标签（绝对定位，浮于格子上方） -->
    <div
      v-for="milestone in depthMilestones"
      :key="'hud-' + milestone.row"
      class="depth-hud-label"
      :style="{ top: (milestone.row / store.rows * 100) + '%' }"
    >
      {{ milestone.row }}m
    </div>

    <!-- 网格格子 -->
    <div
      v-for="(_, idx) in store.grid"
      :key="idx"
      class="mine-cell"
      :class="cellClass(idx)"
      :style="cellStyle(idx)"
      :title="cellTitle(idx)"
      @click="handleClick(idx)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMineStore } from '../../stores/mineStore'
import { useDevConsole } from '../../composables/useDevConsole'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import { useToast } from '../../composables/useToast'
import type { MineStratum } from '../../data/types'

const store = useMineStore()
const { mineReveal } = useDevConsole()
const { show } = useToast()
const gridEl = ref<HTMLElement>()

// 深度 HUD 里程碑（每 10 行一个，跳过第0行入口）
const depthMilestones = computed(() => {
  const result: { row: number }[] = []
  for (let r = 10; r < store.rows; r += 10) {
    result.push({ row: r })
  }
  return result
})

function rowCol(idx: number): [number, number] {
  return [Math.floor(idx / store.cols), idx % store.cols]
}

function cellClass(idx: number): Record<string, boolean> {
  const cell = store.grid[idx]
  const [row, col] = rowCol(idx)

  // 已挖且可到达：显示为空洞（黑底）
  if (cell.dug && cell.reachable) {
    return { 'mine-cell--dug': true }
  }

  // 与可到达已挖格相邻：显示方块颜色，可挖或不可挖
  const adjacent = store.isAdjacent(row, col)
  if (!adjacent) {
    if (mineReveal.value) {
      const canDig = store.canDig(cell.blockId)
      return {
        'mine-cell--revealed': true,
        'mine-cell--diggable': canDig,
        'mine-cell--locked':   !canDig,
      }
    }
    return { 'mine-cell--invisible': true }
  }

  const isPing = isProspectorPing(row, col)
  const canDig = store.canDig(cell.blockId)

  return {
    'mine-cell--diggable': canDig,
    'mine-cell--locked':   !canDig,
    'mine-cell--prospector-ping': isPing,
  }
}

/** 根据深度比例从 cave strata 找底色石头颜色 */
function getStrataColor(row: number): string {
  const caveDef = db.get('mine_caves', store.caveId)
  if (!caveDef) return '#808080'
  const depthRatio = row / store.rows
  // 取最后一个覆盖当前深度的层（或最深层）
  const strata = caveDef.strata as MineStratum[]
  const matching = strata.filter(s => depthRatio >= s.depthMin && depthRatio < s.depthMax)
  const stratum = matching[matching.length - 1] ?? strata[strata.length - 1]
  const stoneDef = db.get('mine_blocks', stratum?.blockId ?? 'stone')
  return stoneDef?.color ?? '#808080'
}

function cellStyle(idx: number): Record<string, string> {
  const cell = store.grid[idx]
  if (cell.dug) return {}
  const [row, col] = rowCol(idx)
  if (!store.isAdjacent(row, col) && !mineReveal.value) return {}
  const def = db.get('mine_blocks', cell.blockId)
  if (!def) return {}

  // 矿石格：底色（所在深度的石头色）+ 彩色圆点
  if (def.category === 'ore') {
    const stoneColor = getStrataColor(row)
    const oreColor   = def.color
    return {
      background: [
        `radial-gradient(circle at 30% 35%, ${oreColor} 18%, transparent 20%)`,
        `radial-gradient(circle at 68% 62%, ${oreColor} 15%, transparent 17%)`,
        `radial-gradient(circle at 52% 18%, ${oreColor} 12%, transparent 14%)`,
        stoneColor,
      ].join(', '),
    }
  }

  return { backgroundColor: def.color }
}

function cellTitle(idx: number): string {
  const cell = store.grid[idx]
  if (!cell || cell.dug) return ''
  const [row, col] = rowCol(idx)
  if (!store.isAdjacent(row, col) && !mineReveal.value) return ''
  const def = db.get('mine_blocks', cell.blockId)
  if (!def) return ''
  return t(def.locKey)
}

function isProspectorPing(row: number, col: number): boolean {
  const result = store.prospectorResult
  if (!result) return false
  return result.nearestRow === row && result.nearestCol === col
}

function handleClick(idx: number): void {
  const [row, col] = rowCol(idx)
  const cell = store.grid[idx]

  // 已挖通格：无操作
  if (cell.dug && cell.reachable) return

  // 不可见区域（未与可达格相邻）
  if (!store.isAdjacent(row, col)) {
    show(t('mine.hint.not_visible'), 'var(--text-secondary)')
    return
  }

  // 体力耗尽
  if (store.stamina <= 0) {
    show(t('mine.stamina.empty'), 'var(--danger)')
    return
  }

  // 工具等级不足
  if (!store.canDig(cell.blockId)) {
    show(t('mine.hint.tool_required'), 'var(--danger)')
    return
  }

  store.digCell(row, col)
  autoScroll(row)
}

function autoScroll(row: number) {
  const grid = gridEl.value
  const container = grid?.parentElement
  if (!grid || !container) return

  const gridWidth = grid.clientWidth
  const cols = store.cols
  // 每格宽度（含 1px gap 单元计算）
  const cellSize = (gridWidth - (cols - 1)) / cols
  const cellTop    = row * (cellSize + 1)
  const cellBottom = cellTop + cellSize

  const scrollTop  = container.scrollTop
  const viewHeight = container.clientHeight
  const edge       = viewHeight * 0.2

  if (cellBottom > scrollTop + viewHeight - edge) {
    // 格子在可见区底部 20%，向下滚让格子到约 60% 处
    container.scrollTo({ top: cellBottom - viewHeight * 0.6, behavior: 'smooth' })
  } else if (cellTop < scrollTop + edge) {
    // 格子在可见区顶部 20%，向上滚让格子到约 40% 处
    container.scrollTo({ top: cellTop - viewHeight * 0.4, behavior: 'smooth' })
  }
}
</script>

<style scoped>
.mine-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--cols, 20), 1fr);
  gap: 1px;
  background: #111;
  width: 100%;
}

/* 深度 HUD 标签：左侧小标签，不遮挡点击 */
.depth-hud-label {
  position: absolute;
  left: 0;
  transform: translateY(-50%);
  padding: 1px 5px;
  font-size: 14px;
  font-weight: bold;
  color: #fff;
  background: rgba(0, 0, 0, 0.75);
  pointer-events: none;
  z-index: 2;
  line-height: 1.6;
  border-radius: 0 3px 3px 0;
  border-left: 3px solid rgba(255, 255, 255, 0.4);
  white-space: nowrap;
}

.mine-cell {
  aspect-ratio: 1;
  cursor: default;
  transition: filter 0.1s;
  min-width: 0;
}

.mine-cell--dug {
  background: #0a0a0a !important;
  cursor: default;
}

/* 纯黑，不可见，不透出任何颜色信息 */
.mine-cell--invisible {
  background: #000 !important;
  cursor: default;
}

/* 矿透模式：显示真实颜色但加暗色半透明遮罩以示区分 */
.mine-cell--revealed {
  opacity: 0.55;
}

.mine-cell--diggable {
  cursor: pointer;
}
.mine-cell--diggable:hover {
  filter: brightness(1.5);
  outline: 1px solid rgba(255,255,255,0.3);
}

/* 工具不足：正常显示颜色，仅改变鼠标样式 */
.mine-cell--locked {
  cursor: not-allowed;
}

.mine-cell--prospector-ping {
  outline: 2px solid var(--warn) !important;
  animation: mine-ping 0.8s ease-in-out infinite alternate;
}

@keyframes mine-ping {
  from { outline-color: var(--warn); }
  to   { outline-color: transparent; }
}
</style>
