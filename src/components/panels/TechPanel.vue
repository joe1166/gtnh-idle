<template>
  <div class="tech-panel">
    <div v-if="visibleTrees.length === 0" class="empty-hint">{{ t('empty.no_techs') }}</div>

    <div
      v-else
      ref="wrapEl"
      class="canvas-area"
      :class="{ 'is-dragging': isDragging }"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    >
      <!-- 树 Tab 栏（仅多棵可见树时显示，浮于画布顶部居中） -->
      <div class="tree-tabs" v-if="visibleTrees.length > 1">
        <button
          v-for="tree in visibleTrees"
          :key="tree.id"
          class="tree-tab"
          :class="{ active: activeTreeId === tree.id }"
          @click.stop="switchTree(tree.id)"
        >
          {{ t(tree.locKey) }}
        </button>
      </div>

      <!-- 科技树画布 -->
      <div
        v-if="activeTreeId"
        class="canvas-inner"
        :style="{
          width: canvasWidth + 'px',
          height: canvasHeight + 'px',
          transform: `translate(${offsetX}px, ${offsetY}px)`,
        }"
      >
        <!-- SVG 连线层 -->
        <svg
          class="conn-layer"
          :width="canvasWidth"
          :height="canvasHeight"
        >
          <path
            v-for="edge in edges"
            :key="edge.key"
            :d="edge.d"
            :stroke="edge.color"
            :stroke-dasharray="edge.dashed ? '5 4' : 'none'"
            stroke-width="1.5"
            fill="none"
          />
        </svg>

        <!-- 节点卡片 -->
        <div
          v-for="node in currentTreeNodes"
          :key="node.id"
          class="node-card"
          :class="{
            'node-researched': node.researched,
            'node-available':  node.available,
            'node-locked':     !node.researched && !node.available,
          }"
          :style="{ left: node.col * CELL_W + 'px', top: node.row * CELL_H + 'px' }"
          @click="openDetail(node.id)"
        >
          <span class="node-icon">
            {{ node.researched ? '✅' : node.available ? '🔬' : '🔒' }}
          </span>
          <span class="node-name">{{ t(node.locKey) }}</span>
        </div>
      </div>
    </div>

    <!-- 详情 Modal -->
    <Teleport to="body">
      <div v-if="detailTechId" class="modal-overlay" @click.self="detailTechId = null">
        <div class="modal-box" v-if="detailNode">
          <!-- 标题 -->
          <div class="detail-header">
            <span class="detail-icon">
              {{ detailNode.researched ? '✅' : detailNode.available ? '🔬' : '🔒' }}
            </span>
            <span class="detail-name">{{ t(detailNode.locKey) }}</span>
            <span class="detail-status-badge" :class="detailStatusClass">
              {{ detailStatusLabel }}
            </span>
          </div>

          <!-- 描述 -->
          <div class="detail-desc">{{ t(detailNode.descLocKey) }}</div>

          <!-- 前置 -->
          <div v-if="detailNode.prerequisites.length > 0" class="detail-section">
            <div class="detail-label">{{ t('tech.detail.prereq_label') }}</div>
            <div class="prereq-chips">
              <span
                v-for="p in explicitPrereqs"
                :key="p.techId"
                class="prereq-chip"
                :class="isResearched(p.techId) ? 'chip-ok' : 'chip-missing'"
              >
                {{ t('tech.' + p.techId + '.name') || p.techId }}
                {{ isResearched(p.techId) ? '✓' : '✗' }}
              </span>
            </div>
            <div v-if="detailNode.hasUnmetImplicit" class="implicit-hint">
              ⚠ {{ t('tech.prereq.implicit_unmet') }}
            </div>
          </div>

          <!-- unlockCondition 未满足提示 -->
          <div
            v-if="detailNode.unlockCondition && !evalUnlockCond(detailNode)"
            class="detail-section unlock-cond-warn"
          >
            ⚠ {{ t('tech.detail.unlock_cond_unmet') }}
          </div>

          <!-- 研究消耗 -->
          <div v-if="!detailNode.researched" class="detail-section">
            <div class="detail-label">{{ t('tech.detail.cost_label') }}</div>
            <div class="cost-list">
              <div
                v-for="c in detailNode.cost"
                :key="c.resourceId"
                class="cost-row"
                :class="canAffordItem(c) ? 'cost-ok' : 'cost-missing'"
              >
                <span class="cost-name">{{ db.name('resources', c.resourceId) }}</span>
                <span class="cost-amount">
                  {{ Math.floor(inventoryStore.getAmount(c.resourceId)) }} / {{ c.amount }}
                </span>
              </div>
            </div>
          </div>

          <!-- 解锁内容 -->
          <div v-if="hasUnlocks" class="detail-section">
            <div class="detail-label">{{ t('tech.unlocks.label') }}</div>
            <div class="unlocks-grid">
              <span v-for="f in detailNode.unlocks.features" :key="f" class="unlock-tag">
                {{ t('feature.' + f) }}
              </span>
              <span v-for="id in detailNode.unlocks.machineDefIds" :key="id" class="unlock-tag">
                {{ db.name('machines', id) }}
              </span>
              <span v-for="id in detailNode.unlocks.recipeIds" :key="id" class="unlock-tag">
                {{ db.name('recipes', id) }}
              </span>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="detail-footer">
            <button
              v-if="!detailNode.researched"
              class="btn-research"
              :disabled="!detailNode.available || !canAffordAll"
              @click="doResearch"
            >
              {{ t('btn.research') }}
            </button>
            <button class="btn-close" @click="detailTechId = null">
              {{ t('tech.detail.close') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useTechStore } from '../../stores/techStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import type { TechNodeStatus } from '../../stores/techStore'
import type { ResourceAmount, TechPrereq, TechTreeDef } from '../../data/types'

// ─── 布局常量 ────────────────────────────────────────────────
const CELL_W = 200   // 节点宽 160 + 间距 40
const CELL_H = 130   // 节点高 90  + 间距 40
const NODE_W = 160
const NODE_H = 90

// ─── Store ───────────────────────────────────────────────────
const techStore      = useTechStore()
const inventoryStore = useInventoryStore()

// ─── 树 Tab ──────────────────────────────────────────────────
const activeTreeId = ref('')

const visibleTrees = computed(() =>
  db.table('tech_trees')
    .filter((tree: TechTreeDef) => techStore.isTreeVisible(tree.id))
    .sort((a: TechTreeDef, b: TechTreeDef) => a.order - b.order)
)

watch(visibleTrees, () => {
  if (!visibleTrees.value.find((tree: TechTreeDef) => tree.id === activeTreeId.value)) {
    activeTreeId.value = visibleTrees.value[0]?.id ?? ''
  }
}, { immediate: true })

function switchTree(treeId: string) {
  activeTreeId.value = treeId
}

// ─── 当前树节点 ──────────────────────────────────────────────
const currentTreeNodes = computed<TechNodeStatus[]>(() =>
  techStore.visibleTechsWithStatus.filter((n: TechNodeStatus) => n.treeId === activeTreeId.value)
)

// ─── 画布尺寸 ────────────────────────────────────────────────
const canvasWidth = computed(() => {
  const maxCol = currentTreeNodes.value.reduce((m: number, n: TechNodeStatus) => Math.max(m, n.col), 0)
  return (maxCol + 1) * CELL_W + 40
})

const canvasHeight = computed(() => {
  const maxRow = currentTreeNodes.value.reduce((m: number, n: TechNodeStatus) => Math.max(m, n.row), 0)
  return (maxRow + 1) * CELL_H + 40
})

// ─── 拖拽平移 ────────────────────────────────────────────────
const wrapEl  = ref<HTMLElement | null>(null)
const offsetX = ref(0)
const offsetY = ref(0)
const isDragging = ref(false)
const didDrag    = ref(false)

let dragStartX  = 0
let dragStartY  = 0
let dragOriginX = 0
let dragOriginY = 0

function onMouseDown(e: MouseEvent) {
  if ((e.target as Element).closest('.tree-tabs')) return
  isDragging.value = true
  didDrag.value    = false
  dragStartX  = e.clientX
  dragStartY  = e.clientY
  dragOriginX = offsetX.value
  dragOriginY = offsetY.value
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.value = true
  offsetX.value = dragOriginX + dx
  offsetY.value = dragOriginY + dy
}

function onMouseUp() {
  isDragging.value = false
}

// ─── 自动居中最深节点 ────────────────────────────────────────
/**
 * 找到当前树中从根走层数最多（row 最大）的节点，
 * 有多个时取居中列的那个，将其显示在区域中央。
 */
function centerOnDeepestNode() {
  const nodes = currentTreeNodes.value
  if (!nodes.length || !wrapEl.value) return

  const maxRow   = nodes.reduce((m: number, n: TechNodeStatus) => Math.max(m, n.row), 0)
  const deepest  = [...nodes.filter(n => n.row === maxRow)].sort((a, b) => a.col - b.col)
  const target   = deepest[Math.floor((deepest.length - 1) / 2)]

  const wrapW = wrapEl.value.clientWidth
  const wrapH = wrapEl.value.clientHeight

  // 目标节点中心在画布内的坐标
  const nodeX = target.col * CELL_W + NODE_W / 2
  const nodeY = target.row * CELL_H + NODE_H / 2

  offsetX.value = wrapW / 2 - nodeX
  offsetY.value = wrapH / 2 - nodeY
}

// 切换树时重新居中
watch(activeTreeId, () => {
  nextTick(centerOnDeepestNode)
})

onMounted(() => {
  nextTick(centerOnDeepestNode)
})

// ─── SVG 连线 ────────────────────────────────────────────────
interface Edge {
  key: string
  d: string
  color: string
  dashed: boolean
}

const edges = computed<Edge[]>(() => {
  const result: Edge[] = []
  const nodeMap = new Map<string, TechNodeStatus>(
    currentTreeNodes.value.map((n: TechNodeStatus) => [n.id, n] as [string, TechNodeStatus])
  )

  for (const child of currentTreeNodes.value) {
    for (const prereq of child.prerequisites) {
      if (prereq.kind !== 'explicit') continue
      const parent = nodeMap.get(prereq.techId)
      if (!parent) continue

      const px = parent.col * CELL_W + NODE_W
      const py = parent.row * CELL_H + NODE_H / 2
      const cx = child.col * CELL_W
      const cy = child.row * CELL_H + NODE_H / 2
      const mx = (px + cx) / 2

      const d = `M ${px} ${py} L ${mx} ${py} L ${mx} ${cy} L ${cx} ${cy}`

      const bothResearched = child.researched
      const parentResearched = parent.researched
      const color = bothResearched
        ? 'var(--accent)'
        : parentResearched
          ? 'var(--warn)'
          : '#444'
      const dashed = !parentResearched

      result.push({ key: `${parent.id}->${child.id}`, d, color, dashed })
    }
  }
  return result
})

// ─── 详情 Modal ──────────────────────────────────────────────
const detailTechId = ref<string | null>(null)

const detailNode = computed<TechNodeStatus | null>(() => {
  if (!detailTechId.value) return null
  return techStore.visibleTechsWithStatus.find((n: TechNodeStatus) => n.id === detailTechId.value) ?? null
})

function openDetail(techId: string) {
  if (didDrag.value) return
  detailTechId.value = techId
}

const explicitPrereqs = computed(() =>
  detailNode.value?.prerequisites.filter((p: TechPrereq) => p.kind === 'explicit') ?? []
)

const hasUnlocks = computed(() => {
  const u = detailNode.value?.unlocks
  return (u?.features?.length ?? 0) + (u?.machineDefIds?.length ?? 0) + (u?.recipeIds?.length ?? 0) > 0
})

const detailStatusClass = computed(() => {
  if (!detailNode.value) return ''
  if (detailNode.value.researched) return 'status-researched'
  if (detailNode.value.available)  return 'status-available'
  return 'status-locked'
})

const detailStatusLabel = computed(() => {
  if (!detailNode.value) return ''
  if (detailNode.value.researched) return t('tech.node.researched')
  if (detailNode.value.available)  return t('tech.node.available')
  return t('tech.node.locked')
})

function isResearched(techId: string): boolean {
  return techStore.isResearched(techId)
}

function evalUnlockCond(node: TechNodeStatus): boolean {
  if (!node.unlockCondition) return true
  return techStore.canResearch(node.id) || node.researched
}

function canAffordItem(c: ResourceAmount): boolean {
  return inventoryStore.getAmount(c.resourceId) >= c.amount
}

const canAffordAll = computed(() =>
  detailNode.value?.cost.every((c: ResourceAmount) => canAffordItem(c)) ?? false
)

function doResearch() {
  if (!detailTechId.value) return
  const ok = techStore.research(detailTechId.value)
  if (ok) detailTechId.value = null
}
</script>

<style scoped>
.tech-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.empty-hint {
  padding: 32px;
  color: #555;
  font-size: 13px;
  text-align: center;
}

/* ── Canvas Area（拖拽容器）── */
.canvas-area {
  position: relative;
  flex: 1 1 auto;
  overflow: hidden;
  cursor: grab;
  user-select: none;
}

.canvas-area.is-dragging {
  cursor: grabbing;
}

/* ── Tree Tabs（浮于画布顶部居中）── */
.tree-tabs {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 2px;
  pointer-events: auto;
}

.tree-tab {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  color: #888;
  padding: 5px 16px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.tree-tab:hover {
  color: var(--text-primary);
}

.tree-tab.active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent);
}

/* ── Canvas Inner ── */
.canvas-inner {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
}

.conn-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
}

/* ── Node Card ── */
.node-card {
  position: absolute;
  width: 160px;
  height: 90px;
  border: 1px solid var(--border);
  background: var(--bg-panel);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  padding: 8px;
  box-sizing: border-box;
}

.node-card:hover {
  box-shadow: 0 0 8px rgba(255,255,255,0.1);
}

.node-researched {
  border-color: var(--accent);
  box-shadow: 0 0 6px var(--accent-soft);
}

.node-available {
  border-color: var(--warn);
}

.node-locked {
  border-color: #333;
  opacity: 0.6;
}

.node-icon {
  font-size: 18px;
}

.node-name {
  font-size: 12px;
  color: var(--text-primary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

/* ── Detail Modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  font-family: 'Consolas', 'Courier New', monospace;
}

.modal-box {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  padding: 20px 24px;
  min-width: 340px;
  max-width: 460px;
  width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-icon {
  font-size: 20px;
}

.detail-name {
  flex: 1;
  font-size: 16px;
  font-weight: bold;
}

.detail-status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid;
}

.status-researched { color: var(--accent); border-color: var(--accent); }
.status-available  { color: var(--warn); border-color: var(--warn); }
.status-locked     { color: #666; border-color: #444; }

.detail-desc {
  font-size: 12px;
  color: #aaa;
  line-height: 1.5;
}

.detail-section {
  border-top: 1px solid #2a2a2a;
  padding-top: 10px;
}

.detail-label {
  font-size: 11px;
  color: #666;
  margin-bottom: 6px;
}

.prereq-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.prereq-chip {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid;
}

.chip-ok      { color: var(--accent); border-color: var(--accent); }
.chip-missing { color: #f44336; border-color: #f44336; }

.implicit-hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--warn);
}

.unlock-cond-warn {
  font-size: 12px;
  color: var(--warn);
}

.cost-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cost-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.cost-ok      { color: var(--accent); }
.cost-missing { color: #f44336; }

.unlocks-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.unlock-tag {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid #444;
  color: #ccc;
}

.detail-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  border-top: 1px solid #2a2a2a;
  padding-top: 12px;
}

.btn-research {
  background: var(--accent);
  border: none;
  color: #111;
  padding: 6px 20px;
  font-family: inherit;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
}

.btn-research:disabled {
  background: #333;
  color: #555;
  cursor: not-allowed;
}

.btn-research:not(:disabled):hover {
  background: var(--accent);
}

.btn-close {
  background: none;
  border: 1px solid var(--border);
  color: #888;
  padding: 6px 16px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.btn-close:hover {
  color: var(--text-primary);
  border-color: #666;
}
</style>
