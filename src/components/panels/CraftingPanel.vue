<template>
  <div class="crafting-panel" ref="panelEl">
    <div class="panel-header">
      <span class="panel-title">{{ t('panel.crafting.title') }}</span>
      <span class="panel-hint">{{ t('panel.crafting.hint') }}</span>
    </div>

    <!-- 每种机器类型一个块 -->
    <div
      v-for="def in availableMachineDefs"
      :key="def.id"
      class="machine-block"
    >
      <!-- 机器标题行 -->
      <div class="machine-header">
        <!-- 第一行：图标 + 名称 + 数量 -->
        <div class="machine-title-row">
          <span class="machine-icon">{{ machineIcon(def.role ?? '') }}</span>
          <span class="machine-name">{{ t(def.locKey) }}</span>
          <span
            v-if="def.maxCount > 1"
            class="built-count"
            :class="instancesOf(def.id).length >= def.maxCount ? 'built-count--max' : ''"
          >
            {{ instancesOf(def.id).length >= def.maxCount ? 'MAX' : '×' + instancesOf(def.id).length }}
          </span>
        </div>

        <!-- 第二行：建造按钮 + 成本（未达上限时才显示） -->
        <div v-if="instancesOf(def.id).length < def.maxCount" class="build-row">
          <button
            class="build-btn"
            :class="canBuild(def.id) ? 'build-btn--ok' : 'build-btn--lack'"
            :disabled="!canBuild(def.id)"
            @click="handleBuild(def.id, def.locKey)"
          >
            {{ t('btn.build') }}
          </button>
          <div class="build-cost-row">
            <span v-if="def.buildCost.length === 0" class="cost-chip cost-chip--ok">免费</span>
            <template v-else>
              <span class="cost-label">{{ t('btn.needs') }}</span>
              <span
                v-for="c in def.buildCost"
                :key="c.resourceId"
                class="cost-chip"
                :class="inventoryStore.getAmount(c.resourceId) >= c.amount ? 'cost-chip--ok' : 'cost-chip--lack'"
              >
                {{ getResName(c.resourceId) }}×{{ c.amount }}
                <span class="cost-have">({{ fmt(inventoryStore.getAmount(c.resourceId)) }})</span>
              </span>
            </template>
          </div>
        </div>
      </div>

      <!-- 无实例提示 -->
      <div v-if="instancesOf(def.id).length === 0" class="no-instance">
        {{ t('hint.no_machine') }}
      </div>

      <!-- 实例列表 -->
      <div v-else class="instance-list">
        <div
          v-for="(inst, idx) in instancesOf(def.id)"
          :key="inst.instanceId"
          class="instance-row"
          :class="'instance-row--' + inst.status"
        >
          <!-- 序号 -->
          <span class="inst-index">#{{ idx + 1 }}</span>

          <!-- 配方选择 -->
          <div class="inst-recipe">
            <select
              class="recipe-select"
              :value="inst.selectedRecipeId ?? ''"
              @change="onRecipeChange(inst.instanceId, ($event.target as any).value)"
            >
              <option
                v-for="recipe in getAllowedRecipes(def.id)"
                :key="recipe.id"
                :value="recipe.id"
              >
                {{ recipeShortLabel(recipe) }}
              </option>
            </select>
            <!-- 配方材料预览 -->
            <div v-if="inst.selectedRecipeId" class="recipe-preview">
              <span
                v-for="inp in getRecipe(inst.selectedRecipeId)?.inputs ?? []"
                :key="inp.resourceId"
                class="preview-item"
                :class="inventoryStore.getAmount(inp.resourceId) >= inp.amount ? 'preview-ok' : 'preview-lack'"
              >
                {{ getResName(inp.resourceId) }}×{{ inp.amount }}
                <span class="preview-have">({{ fmt(inventoryStore.getAmount(inp.resourceId)) }})</span>
              </span>
              <span v-if="(getRecipe(inst.selectedRecipeId)?.inputs ?? []).length === 0" class="preview-ok">{{ t('crafting.no_inputs') }}</span>
              <span class="preview-arrow">→</span>
              <span
                v-for="out in getRecipe(inst.selectedRecipeId)?.outputs ?? []"
                :key="out.resourceId"
                class="preview-output"
              >
                {{ getResName(out.resourceId) }}×{{ out.amount }}
              </span>
            </div>
          </div>

          <!-- 进度 / 状态 -->
          <div class="inst-progress">
            <!-- 瞬时机器（instantMode=1）：缺材料时显示 -->
            <template v-if="isInstantMachine(inst)">
              <span
                v-if="!canAffordInstant(inst)"
                class="status-badge status--no_material"
              >
                {{ t('status.no_material') }}
              </span>
            </template>
            <!-- 普通机器：进度条 + 状态 -->
            <template v-else-if="inst.status === 'running' && inst.selectedRecipeId">
              <div class="prog-bar-wrap">
                <div
                  class="prog-bar-fill"
                  :style="{ width: progressPct(inst) + '%' }"
                ></div>
              </div>
              <span class="prog-text">
                {{ Math.round(progressPct(inst)) }}%
                <span class="prog-remaining">{{ t('crafting.time_prefix') }}{{ Math.ceil(getRecipeDuration(inst.selectedRecipeId) - inst.progressSec) }}{{ t('crafting.time_suffix') }}</span>
              </span>
            </template>
            <template v-else>
              <span class="status-badge" :class="'status--' + inst.status">
                {{ statusLabel(inst.status) }}
              </span>
            </template>
          </div>

          <!-- EU/s -->
          <span class="inst-eu">
            {{ getRecipeEU(inst.selectedRecipeId) > 0 ? getRecipeEU(inst.selectedRecipeId) + ' EU/s' : '' }}
          </span>

          <!-- 开/关 + 超频 -->
          <div class="inst-controls">
            <!-- 瞬时机器：显示制作按钮 -->
            <template v-if="isInstantMachine(inst)">
              <button
                class="craft-btn"
                :class="canAffordInstant(inst) ? 'craft-btn--ok' : 'craft-btn--lack'"
                :disabled="!canAffordInstant(inst)"
                @click="handleCraft($event, inst)"
              >
                {{ t('btn.craft') }}
              </button>
            </template>
            <!-- 普通机器 -->
            <template v-else>
              <!-- 运行状态指示（仅在全局电压 >= LV 时显示） -->
              <span v-if="inst.isRunning && showVoltageIndicator()" class="run-indicator">
                {{ getVoltageDisplay(inst.selectedVoltage) }}
                {{ inst.status === 'running' ? t('overclock.indicator.normal') : '' }}
              </span>
              <!-- 开启/停止按钮 -->
              <button
                class="toggle-btn"
                :class="inst.isRunning ? 'toggle-btn--on' : 'toggle-btn--off'"
                @click="onToggleClick(inst)"
              >
                {{ inst.isRunning ? t('btn.stop') : t('btn.start') }}
              </button>
              <!-- 电压选择器（需解锁超频科技） -->
              <template v-if="techStore.hasFeature('overclock') && canOverclock(inst.defId)">
                <select
                  class="voltage-select"
                  :value="inst.selectedVoltage"
                  @change="onVoltageChange(inst.instanceId, $event)"
                >
                  <option
                    v-for="v in getAvailableVoltages(inst)"
                    :key="v"
                    :value="v"
                  >{{ getVoltTierName(v) }}</option>
                </select>
              </template>
            </template>
          </div>
        </div>
      </div>
    </div>
    <!-- 浮动文字 -->
    <div class="float-container" ref="floatContainer" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMachineStore } from '../../stores/machineStore'
import { usePowerStore } from '../../stores/powerStore'
import { useProgressionStore } from '../../stores/progressionStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useTechStore } from '../../stores/techStore'
import { useTaskStore } from '../../stores/taskStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import { fmt } from '../../utils/format'
import { checkCondition } from '../../data/conditions'
import { useToast } from '../../composables/useToast'
import { VoltTierName } from '../../data/types'
import type { RecipeDef } from '../../data/types'
import type { MachineInstance, MachineStatus } from '../../stores/machineStore'

const machineStore      = useMachineStore()
const powerStore        = usePowerStore()
const inventoryStore    = useInventoryStore()
const progressionStore  = useProgressionStore()
const techStore      = useTechStore()
const { show }       = useToast()
const floatContainer = ref<HTMLElement | null>(null)
const panelEl        = ref<HTMLElement | null>(null)

const availableMachineDefs = computed(() =>
  db.filter('machines', (d) =>
    d.category === 1 &&
    d.role !== 'miner' &&
    checkCondition(d.showCond)
  ).sort((a, b) => {
    const ma = a.maxVoltage ?? 0
    const mb = b.maxVoltage ?? 0
    if (ma !== mb) {
      // -1（不耗电）排最后，其余按电压降序
      if (ma === -1) return 1
      if (mb === -1) return -1
      return mb - ma
    }
    return (a.order ?? 0) - (b.order ?? 0)
  })
)

function instancesOf(defId: string): MachineInstance[] {
  return machineStore.instances.filter((m) => m.defId === defId)
}

function canBuild(defId: string): boolean {
  const def = db.get('machines', defId)
  if (!def) return false
  if (def.maxCount === 0) return false
  if (instancesOf(defId).length >= def.maxCount) return false
  return inventoryStore.canAfford(def.buildCost)
}

function handleBuild(defId: string, defLocKey: string) {
  const ok = machineStore.buildMachine(defId)
  if (ok) show(`${t('toast.build.success')} ${t(defLocKey)}`, 'var(--accent)')
  else show(t('toast.build.fail'), 'var(--danger)')
}

function handleCraft(e: MouseEvent, inst: MachineInstance): void {
  if (!inst.selectedRecipeId) return
  if (!canAffordInstant(inst)) return
  const recipe = db.get('recipes', inst.selectedRecipeId)
  if (!recipe) return
  // 直接消耗并产出
  inventoryStore.spend(recipe.inputs)
  for (const output of recipe.outputs) {
    inventoryStore.addItem(output.resourceId, output.amount)
    useTaskStore().onCraftComplete(output.resourceId, output.amount)
    spawnFloat(e, `+${output.amount} ${getResName(output.resourceId)}`)
  }
}

// ─── 浮动文字 ────────────────────────────────────────────────

function spawnFloat(e: MouseEvent, text: string) {
  const container = floatContainer.value
  const panel     = panelEl.value
  if (!container || !panel) return
  const rect = panel.getBoundingClientRect()
  const el   = document.createElement('span')
  el.className   = 'float-text'
  el.textContent = text
  el.style.left  = (e.clientX - rect.left) + 'px'
  el.style.top   = (e.clientY - rect.top)  + 'px'
  container.appendChild(el)
  setTimeout(() => el.remove(), 900)
}

function getAllowedRecipes(defId: string): RecipeDef[] {
  const def = db.get('machines', defId)
  if (!def) return []
  return db.filter('recipes', (r) =>
    r.requiredRole === def.role &&
    r.requiredLevel <= def.tier &&
    (r.maxRequiredLevel == null || r.maxRequiredLevel >= def.tier) &&
    checkCondition(r.showCond)
  )
}

function getRecipe(recipeId: string | null): RecipeDef | null {
  if (!recipeId) return null
  return db.get('recipes', recipeId) ?? null
}

function recipeShortLabel(recipe: RecipeDef): string {
  const out = recipe.outputs.map((o) => `${getResName(o.resourceId)}×${o.amount}`).join('+')
  return out
}

function onRecipeChange(instanceId: string, recipeId: string) {
  if (recipeId) machineStore.setRecipe(instanceId, recipeId)
}

function isInstantMachine(inst: MachineInstance): boolean {
  const def = getMachineDef(inst.defId)
  return (def?.instantMode ?? 0) === 1
}

function canAffordInstant(inst: MachineInstance): boolean {
  if (!inst.selectedRecipeId) return false
  const recipe = db.get('recipes', inst.selectedRecipeId)
  if (!recipe) return false
  return inventoryStore.canAfford(recipe.inputs)
}

function progressPct(inst: MachineInstance): number {
  if (!inst.selectedRecipeId) return 0
  const recipe = db.get('recipes', inst.selectedRecipeId)
  if (!recipe || recipe.durationSec <= 0) return 0
  if (typeof inst.progressSec !== 'number' || isNaN(inst.progressSec)) return 0
  return Math.min(100, (inst.progressSec / recipe.durationSec) * 100)
}

function getRecipeDuration(recipeId: string | null): number {
  if (!recipeId) return 0
  const recipe = db.get('recipes', recipeId)
  const d = recipe?.durationSec
  return typeof d === 'number' && !isNaN(d) ? d : 0
}

function getRecipeEU(recipeId: string | null): number {
  return recipeId ? (db.get('recipes', recipeId)?.euPerSec ?? 0) : 0
}

function getResName(id: string): string {
  return db.name('resources', id)
}

function statusLabel(status: MachineStatus): string {
  return t(`status.${status}`)
}

function getMachineDef(defId: string) {
  return db.get('machines', defId) ?? null
}

/** 是否可超频（maxVoltage > 0，即非纯 ULV 机器） */
function canOverclock(defId: string): boolean {
  return (getMachineDef(defId)?.maxVoltage ?? 0) > 0
}

/** 获取当前可选的电压列表（0 ～ min(machine.maxVoltage, globalMaxVoltage)，默认选中最大） */
function getAvailableVoltages(inst: MachineInstance): number[] {
  const def = getMachineDef(inst.defId)
  if (!def) return []
  const maxV = Math.min(def.maxVoltage ?? 0, powerStore.globalMaxVoltage)
  const result: number[] = []
  for (let v = maxV; v >= 0; v--) result.push(v)
  return result
}

function getVoltTierName(v: number): string {
  return VoltTierName[v] ?? `V${v}`
}

/**
 * 电压指示器显示文本。
 * selectedVoltage = -1 → "不耗电"，否则显示对应电压名称。
 */
function getVoltageDisplay(v: number): string {
  return v === -1 ? t('voltage.no_consume') : getVoltTierName(v)
}

/** 是否显示电压指示器（进入 LV 时代后才显示） */
function showVoltageIndicator(): boolean {
  return progressionStore.era === 'lv'
}

function onToggleClick(inst: MachineInstance): void {
  machineStore.toggleMachine(inst.instanceId)
}

function onVoltageChange(instanceId: string, event: Event): void {
  machineStore.setVoltage(instanceId, Number((event.target as any).value))
}

function machineIcon(type: string): string {
  const icons: Record<string, string> = {
    furnace: '🔥',
    forge_hammer: '🔨',
    wire_cutter: '✂️',
    assembler: '⚙️',
    plate_press: '🔧',
  }
  return icons[type] ?? '🏭'
}
</script>

<style scoped>
.crafting-panel {
  font-family: 'Consolas', 'Courier New', monospace;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 4px;
}
.panel-title { font-size: 15px; font-weight: bold; }
.panel-hint  { font-size: 11px; color: #666; }

/* 每台机器块 */
.machine-block {
  border: 1px solid var(--border);
  background: var(--bg-panel);
  overflow: hidden;
}

/* 标题行：两行布局 */
.machine-header {
  padding: 8px 14px;
  background: #262626;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* 第一行：图标 + 名称 + 数量 + 建造按钮 */
.machine-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.machine-icon { font-size: 15px; }

.machine-name {
  font-size: 13px;
  font-weight: bold;
  color: #ddd;
}

.built-count {
  font-size: 12px;
  color: var(--accent);
  font-weight: bold;
}

.built-count--max {
  color: #888;
}

.build-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.max-label {
  font-size: 11px;
  color: #666;
  font-style: italic;
}

.build-btn {
  padding: 3px 10px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid;
  transition: background 0.12s;
  white-space: nowrap;
  margin-left: 4px;
}

.build-btn--ok {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
}
.build-btn--ok:hover { background: var(--accent-bg-hover); }

.build-btn--lack {
  background: var(--danger-bg);
  border-color: var(--danger-border);
  color: var(--danger-text);
  cursor: not-allowed;
}

/* 第二行：建造成本 */
.build-cost-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.cost-label {
  font-size: 11px;
  color: #666;
}

.cost-chip {
  font-size: 11px;
  padding: 1px 6px;
  border: 1px solid;
  white-space: nowrap;
}
.cost-chip--ok   { color: var(--accent);  border-color: var(--accent-bg-hover); }
.cost-chip--lack { color: var(--danger);    border-color: var(--danger-border); }

.cost-have {
  font-size: 10px;
  opacity: 0.7;
  margin-left: 2px;
}

/* 空提示 */
.no-instance {
  padding: 8px 14px;
  font-size: 11px;
  color: #555;
}

/* 实例列表 */
.instance-list {
  display: flex;
  flex-direction: column;
}

.instance-row {
  display: grid;
  grid-template-columns: 28px 1fr 160px 70px auto;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-top: 1px solid #303030;
  font-size: 12px;
  transition: background 0.1s;
}

.instance-row--running { background: var(--accent-subtle); }
.instance-row--no_power { background: rgba(244,67,54,0.04); }

.inst-index {
  font-size: 11px;
  color: #666;
  text-align: right;
}

/* 配方 */
.inst-recipe { min-width: 0; }

.recipe-select {
  background: #1e1e1e;
  border: 1px solid #444;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 11px;
  padding: 3px 6px;
  width: 100%;
  cursor: pointer;
  outline: none;
}
.recipe-select:focus { border-color: var(--accent); }
.recipe-select option { background: #1e1e1e; }

.recipe-preview {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
  flex-wrap: wrap;
}

.preview-item {
  font-size: 10px;
  padding: 1px 4px;
  border: 1px solid;
}
.preview-ok   { color: var(--accent); border-color: var(--accent-bg-hover); }
.preview-lack { color: var(--danger); border-color: var(--danger-border); }

.preview-have {
  opacity: 0.6;
  margin-left: 1px;
}

.preview-arrow { color: #666; font-size: 11px; }

.preview-output {
  font-size: 10px;
  color: var(--warn);
}

/* 进度 */
.inst-progress {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.prog-bar-wrap {
  height: 5px;
  background: #333;
  overflow: hidden;
}
.prog-bar-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.5s linear;
}
.prog-text {
  font-size: 10px;
  color: #aaa;
}
.prog-remaining { color: #777; margin-left: 4px; }

.status-badge {
  font-size: 11px;
  padding: 1px 6px;
  border: 1px solid;
}
.status--running   { color: var(--accent);  border-color: var(--accent); }
.status--paused    { color: #666;                  border-color: #444; }
.status--no_recipe { color: var(--warn); border-color: #554400; }
.status--no_material { color: var(--warn); border-color: #554400; }
.status--no_power  { color: var(--danger);    border-color: #552222; }
.status--instant   { color: var(--accent-cyan, #00bcd4); border-color: #004a5a; }

/* EU/s */
.inst-eu {
  font-size: 11px;
  color: var(--warn);
  text-align: right;
  white-space: nowrap;
}

/* 开关按钮 */
.inst-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.run-indicator {
  font-size: 10px;
  color: var(--accent);
  white-space: nowrap;
}

.toggle-btn {
  padding: 3px 8px;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  border: 1px solid;
  transition: background 0.12s;
  white-space: nowrap;
}
.toggle-btn--on {
  background: #2e2020;
  border-color: var(--danger);
  color: var(--danger);
}
.toggle-btn--on:hover { background: #3a2525; }
.toggle-btn--off {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
}
.toggle-btn--off:hover { background: var(--accent-bg-hover); }

/* 超频/降频按钮 */
.oc-btn {
  padding: 3px 8px;
  font-family: inherit;
  font-size: 10px;
  cursor: pointer;
  border: 1px solid;
  transition: background 0.12s;
  white-space: nowrap;
}
.oc-btn--up {
  background: var(--warn-bg);
  border-color: var(--warn);
  color: var(--warn);
}
.oc-btn--up:hover { background: var(--warn-bg-hover); }
.oc-btn--down {
  background: #252525;
  border-color: #666;
  color: #999;
}
.oc-btn--down:hover { background: #2e2e2e; }

.voltage-select {
  background: #1e1e2a;
  border: 1px solid var(--warn);
  color: var(--warn);
  font-family: inherit;
  font-size: 10px;
  padding: 2px 4px;
  cursor: pointer;
}
.voltage-select:focus { outline: none; }

/* 制作按钮（瞬时机器） */
.craft-btn {
  padding: 3px 10px;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  border: 1px solid;
  transition: background 0.12s;
  white-space: nowrap;
}
.craft-btn--ok {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
}
.craft-btn--ok:hover { background: var(--accent-bg-hover); }
.craft-btn--lack {
  background: var(--danger-bg);
  border-color: var(--danger-border);
  color: var(--danger-text);
  cursor: not-allowed;
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
</style>
