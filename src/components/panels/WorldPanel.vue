<template>
  <div class="world-panel" ref="panelEl">

    <!-- ── 背景层 ── -->
    <img
      v-if="biome?.imagePath"
      class="world-bg"
      :src="biome.imagePath"
      draggable="false"
      alt=""
    />
    <div v-else class="world-bg-fallback" />

    <!-- ── SVG 热区层（隐藏节点的透明可点击多边形） ── -->
    <svg
      class="hit-overlay"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon
        v-for="node in hiddenNodes"
        :key="node.id"
        :points="node.hitArea ?? ''"
        :fill="highlightHitAreas ? 'rgba(255,200,0,0.08)' : 'transparent'"
        :stroke="highlightHitAreas ? 'rgba(255,200,0,0.6)' : 'transparent'"
        stroke-width="0.3"
        class="hit-zone"
        @click="worldStore.revealNode(node.id)"
      />
    </svg>

    <!-- ── 自定义 Tooltip ── -->
    <div
      v-if="tooltip.visible"
      class="world-tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      {{ tooltip.text }}
    </div>

    <!-- ── 节点按钮层 ── -->
    <template v-for="node in visibleNodes" :key="node.id">
      <!--
        .node-anchor 负责定位（position: absolute + transform），
        内部的按钮/进度条只负责视觉样式，不参与定位。
      -->
      <div
        class="node-anchor"
        :style="{ left: node.posX + '%', top: node.posY + '%' }"
      >

        <!-- click 节点 -->
        <button
          v-if="node.type === 'click'"
          class="action-btn"
          @click="handleClickNode($event, node)"
          @mouseenter="onBtnHover($event, node)"
          @mousemove="moveTooltip($event)"
          @mouseleave="hideTooltip()"
        >
          {{ t(node.actionLocKey) }}
        </button>

        <!-- timed 节点：三态 -->
        <template v-else-if="node.type === 'timed'">
          <!-- 未开始 -->
          <button
            v-if="!timedState(node.id)"
            class="action-btn"
            @click="worldStore.startTimedNode(node.id)"
            @mouseenter="onBtnHover($event, node)"
            @mousemove="moveTooltip($event)"
            @mouseleave="hideTooltip()"
          >
            {{ t(node.actionLocKey) }}
          </button>

          <!-- 进行中 -->
          <div
            v-else-if="timedState(node.id)?.done === false"
            class="timed-running"
            @mouseenter="onBtnHover($event, node)"
            @mousemove="moveTooltip($event)"
            @mouseleave="hideTooltip()"
          >
            <div class="timed-bar-bg">
              <div
                class="timed-bar-fill"
                :style="{ width: timedProgress(node.id) + '%' }"
              />
            </div>
            <span class="timed-label">{{ timedRemaining(node.id) }}s</span>
          </div>

          <!-- 完成，等待领取 -->
          <button
            v-else
            class="action-btn action-btn--ready"
            @click="handleClaim($event, node)"
            @mouseenter="onBtnHover($event, node)"
            @mousemove="moveTooltip($event)"
            @mouseleave="hideTooltip()"
          >
            {{ t('world.node.ready') }}
          </button>
        </template>

      </div>
    </template>

    <!-- ── 浮动文字挂载点 ── -->
    <div class="float-container" ref="floatContainer" />

    <!-- ── 群系名称 ── -->
    <div class="biome-label">{{ biome ? t(biome.locKey) : '' }}</div>

    <!-- ── 底部页签面板 ── -->
    <BottomPanel />

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useWorldStore } from '../../stores/worldStore'
import { useToolStore } from '../../stores/toolStore'
import { useDevConsole } from '../../composables/useDevConsole'
import { useToast } from '../../composables/useToast'
import { t } from '../../data/i18n'
import type { BiomeNodeDef } from '../../data/types'
import BottomPanel from './BottomPanel.vue'

const worldStore = useWorldStore()
const toolStore = useToolStore()
const { show } = useToast()
const { highlightHitAreas } = useDevConsole()

const panelEl        = ref<HTMLElement | null>(null)
const floatContainer = ref<HTMLElement | null>(null)

// ─── 自定义 Tooltip 状态 ───────────────────────────────────────

const tooltip = reactive({ visible: false, x: 0, y: 0, text: '' })

function onBtnHover(e: MouseEvent, node: BiomeNodeDef) {
  tooltip.visible = true
  tooltip.text    = t(node.locKey)
  moveTooltip(e)
}

function moveTooltip(e: MouseEvent) {
  const panel = panelEl.value
  if (!panel) return
  const rect = panel.getBoundingClientRect()
  tooltip.x = e.clientX - rect.left + 12
  tooltip.y = e.clientY - rect.top  - 36
}

function hideTooltip() {
  tooltip.visible = false
}

// ─── 响应式时钟（驱动倒计时显示，每 500ms 更新）────────────

const nowMs = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval>
onMounted(() => { clockTimer = setInterval(() => { nowMs.value = Date.now() }, 500) })
onUnmounted(() => clearInterval(clockTimer))

// ─── 群系 / 节点（直接使用 store getter）────────────────────

const biome       = computed(() => worldStore.currentBiome)
const visibleNodes = computed(() => worldStore.visibleNodes)
const hiddenNodes  = computed(() => worldStore.hiddenNodes)

// ─── timed 节点状态（nowMs 依赖使其响应式）──────────────────

function timedState(nodeId: string) {
  return worldStore.timedNodes[nodeId]
}

function timedProgress(nodeId: string): number {
  const s = worldStore.timedNodes[nodeId]
  if (!s || s.done) return 0
  return Math.min(100, (nowMs.value - s.startAt) / (s.endAt - s.startAt) * 100)
}

function timedRemaining(nodeId: string): number {
  const s = worldStore.timedNodes[nodeId]
  if (!s || s.done) return 0
  return Math.max(0, Math.ceil((s.endAt - nowMs.value) / 1000))
}

// ─── 浮动文字 ────────────────────────────────────────────────

function spawnFloat(e: MouseEvent, text: string) {
  const container = floatContainer.value
  const panel     = panelEl.value
  if (!container || !panel) return
  const rect = panel.getBoundingClientRect()
  const el   = document.createElement('span')
  el.className    = 'float-text'
  el.textContent  = text
  el.style.left   = (e.clientX - rect.left) + 'px'
  el.style.top    = (e.clientY - rect.top)  + 'px'
  container.appendChild(el)
  setTimeout(() => el.remove(), 900)
}

// ─── 事件处理 ────────────────────────────────────────────────

function handleClickNode(e: MouseEvent, node: BiomeNodeDef) {
  // 检查能力门槛
  if (node.requiredAbility && node.requiredAbilityValue !== undefined) {
    const playerAbility = toolStore.getAbility(node.requiredAbility)
    if (playerAbility < node.requiredAbilityValue) {
      show(t('hint.tool.not_enough_ability'), 'var(--accent-red)')
      return
    }
  }
  const got = worldStore.clickNode(node.id)
  if (got > 0) spawnFloat(e, `+${got} ${t('res.' + node.resourceId)}`)
}

function handleClaim(e: MouseEvent, node: BiomeNodeDef) {
  const got = worldStore.claimTimedNode(node.id)
  if (got > 0) spawnFloat(e, `+${got} ${t('res.' + node.resourceId)}`)
}
</script>

<style scoped>
.world-panel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  user-select: none;
  font-family: 'Consolas', 'Courier New', monospace;
}

/* ── 背景 ── */
.world-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.world-bg-fallback {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg,
    #3a6ea8 0%, #6aafe0 35%,
    #87c96a 55%, #5c8a3c 68%,
    #4a6b28 80%, #3d4a1e 100%
  );
}

/* ── SVG 热区 ── */
.hit-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}

.hit-zone {
  pointer-events: all;
  cursor: default;
}

/* ── 定位锚点：负责把节点放到正确坐标 ── */
.node-anchor {
  position: absolute;
  /* 以按钮水平中心对齐坐标点 */
  transform: translateX(-50%);
  z-index: 10;
  /* 内部按钮正常流排列 */
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── 动作按钮（纯视觉，不参与定位） ── */
.action-btn {
  padding: 5px 14px;
  background: rgba(15, 15, 15, 0.75);
  border: 1px solid rgba(210, 210, 210, 0.5);
  border-radius: 3px;
  color: #e8e8e8;
  font-family: inherit;
  font-size: 13px;
  cursor: default;
  white-space: nowrap;
  backdrop-filter: blur(3px);
  transition: background 0.12s, border-color 0.12s;
}

.action-btn:hover {
  background: rgba(40, 40, 40, 0.9);
  border-color: rgba(255, 255, 255, 0.75);
}

.action-btn:active {
  transform: scale(0.93);
}

.action-btn--ready {
  border-color: var(--accent-green, #4caf50);
  color: var(--accent-green, #4caf50);
  animation: pulse-ready 1.2s ease-in-out infinite;
}

@keyframes pulse-ready {
  0%, 100% { box-shadow: 0 0 0 0 rgba(76,175,80,0); }
  50%       { box-shadow: 0 0 8px 2px rgba(76,175,80,0.5); }
}

/* ── timed 进行中状态 ── */
.timed-running {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 5px 10px;
  background: rgba(15, 15, 15, 0.75);
  border: 1px solid rgba(210, 210, 210, 0.35);
  border-radius: 3px;
  backdrop-filter: blur(3px);
}

.timed-bar-bg {
  width: 72px;
  height: 6px;
  background: #2a2a2a;
  border-radius: 3px;
  overflow: hidden;
}

.timed-bar-fill {
  height: 100%;
  background: var(--accent-green, #4caf50);
  border-radius: 3px;
  transition: width 0.5s linear;
}

.timed-label {
  font-size: 11px;
  color: #ccc;
}

/* ── 浮动文字 ── */
.float-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 30;
}

:global(.float-text) {
  position: absolute;
  transform: translate(-50%, -100%);
  white-space: nowrap;
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
  pointer-events: none;
  animation: float-up 0.9s ease-out forwards;
}

@keyframes float-up {
  0%   { opacity: 1; transform: translate(-50%, -100%); }
  100% { opacity: 0; transform: translate(-50%, calc(-100% - 40px)); }
}

/* ── 自定义 Tooltip ── */
.world-tooltip {
  position: absolute;
  z-index: 50;
  background: rgba(10, 10, 10, 0.92);
  border: 1px solid rgba(180, 180, 180, 0.35);
  border-radius: 4px;
  padding: 5px 10px;
  color: #ddd;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

/* ── 群系名称 ── */
.biome-label {
  position: absolute;
  bottom: 50px;
  right: 14px;
  z-index: 10;
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  text-shadow: 0 1px 4px rgba(0,0,0,0.8);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  pointer-events: none;
}
</style>
