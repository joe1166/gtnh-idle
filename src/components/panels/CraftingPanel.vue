<template>
  <div class="crafting-panel">
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
        <!-- 左：图标 + 名称 + 建造按钮 -->
        <div class="machine-title-row">
          <span class="machine-icon">{{ machineIcon(def.role ?? '') }}</span>
          <span class="machine-name">{{ t(def.locKey) }}</span>
          <span class="built-count" v-if="instancesOf(def.id).length > 0">
            ×{{ instancesOf(def.id).length }}
          </span>
          <button
            class="build-btn"
            :class="{ 'build-btn--ok': canBuild(def.id), 'build-btn--lack': !canBuild(def.id) }"
            @click="handleBuild(def.id, def.locKey)"
          >
            {{ t('btn.build') }}
          </button>
        </div>

        <!-- 右：建造成本 -->
        <div class="build-cost-row">
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
              <option value="">── 选择配方 ──</option>
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
              <span v-if="(getRecipe(inst.selectedRecipeId)?.inputs ?? []).length === 0" class="preview-ok">无材料需求</span>
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
            <template v-if="inst.status === 'running' && inst.selectedRecipeId">
              <div class="prog-bar-wrap">
                <div
                  class="prog-bar-fill"
                  :style="{ width: progressPct(inst) + '%' }"
                ></div>
              </div>
              <span class="prog-text">
                {{ Math.round(progressPct(inst)) }}%
                <span class="prog-remaining">剩{{ getRecipeDuration(inst.selectedRecipeId) - inst.progressSec }}s</span>
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
            <!-- 运行状态指示 -->
            <span v-if="inst.isRunning" class="run-indicator">
              {{ getVoltTierName(inst.selectedVoltage) }}
              {{ inst.status === 'running' ? t('overclock.indicator.normal') : '' }}
            </span>
            <!-- 开启/停止按钮 -->
            <button
              class="toggle-btn"
              :class="inst.isRunning ? 'toggle-btn--on' : 'toggle-btn--off'"
              @click="machineStore.toggleMachine(inst.instanceId)"
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMachineStore } from '../../stores/machineStore'
import { usePowerStore } from '../../stores/powerStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useTechStore } from '../../stores/techStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import { fmt } from '../../utils/format'
import { useToast } from '../../composables/useToast'
import { VoltTierName } from '../../data/types'
import type { RecipeDef } from '../../data/types'
import type { MachineInstance, MachineStatus } from '../../stores/machineStore'

const machineStore   = useMachineStore()
const powerStore     = usePowerStore()
const inventoryStore = useInventoryStore()
const techStore      = useTechStore()
const { show }       = useToast()

const availableMachineDefs = computed(() =>
  db.filter('machines', (d) => d.category === 1 && d.role !== 'miner')
)

function instancesOf(defId: string): MachineInstance[] {
  return machineStore.instances.filter((m) => m.defId === defId)
}

function canBuild(defId: string): boolean {
  const def = db.get('machines', defId)
  if (!def) return false
  return inventoryStore.canAfford(def.buildCost)
}

function handleBuild(defId: string, defLocKey: string) {
  const ok = machineStore.buildMachine(defId)
  if (ok) show(`${t('toast.build.success')} ${t(defLocKey)}`, 'var(--accent-green)')
  else show(t('toast.build.fail'), 'var(--accent-red)')
}

function getAllowedRecipes(defId: string): RecipeDef[] {
  const def = db.get('machines', defId)
  if (!def) return []
  return def.allowedRecipeIds.map((id) => db.get('recipes', id)).filter(Boolean) as RecipeDef[]
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

function progressPct(inst: MachineInstance): number {
  if (!inst.selectedRecipeId) return 0
  const recipe = db.get('recipes', inst.selectedRecipeId)
  if (!recipe || recipe.durationSec <= 0) return 0
  return Math.min(100, (inst.progressSec / recipe.durationSec) * 100)
}

function getRecipeDuration(recipeId: string | null): number {
  return recipeId ? (db.get('recipes', recipeId)?.durationSec ?? 0) : 0
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

/** 获取当前可选的电压列表（recipe.voltage ～ min(machine.maxVoltage, globalMaxVoltage)） */
function getAvailableVoltages(inst: MachineInstance): number[] {
  const def = getMachineDef(inst.defId)
  if (!def) return []
  const recipe = inst.selectedRecipeId ? db.get('recipes', inst.selectedRecipeId) : null
  const minV = recipe?.voltage ?? 0
  const maxV = Math.min(def.maxVoltage, Math.max(powerStore.globalMaxVoltage, minV))
  const result: number[] = []
  for (let v = minV; v <= maxV; v++) result.push(v)
  return result
}

function getVoltTierName(v: number): string {
  return VoltTierName[v] ?? `V${v}`
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
  border: 1px solid var(--border-color);
  background: var(--bg-panel);
  overflow: hidden;
}

/* 标题行：两行布局 */
.machine-header {
  padding: 8px 14px;
  background: #262626;
  border-bottom: 1px solid var(--border-color);
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
  color: var(--accent-green);
  font-weight: bold;
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
  background: #1e3a1e;
  border-color: var(--accent-green);
  color: var(--accent-green);
}
.build-btn--ok:hover { background: #254a25; }

.build-btn--lack {
  background: #2a2020;
  border-color: #4a3030;
  color: #774444;
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
.cost-chip--ok   { color: var(--accent-green);  border-color: #2a4a2a; }
.cost-chip--lack { color: var(--accent-red);    border-color: #4a2a2a; }

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

.instance-row--running { background: rgba(76,175,80,0.04); }
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
.recipe-select:focus { border-color: var(--accent-green); }
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
.preview-ok   { color: #5a9; border-color: #2a4a3a; }
.preview-lack { color: var(--accent-red); border-color: #4a2a2a; }

.preview-have {
  opacity: 0.6;
  margin-left: 1px;
}

.preview-arrow { color: #666; font-size: 11px; }

.preview-output {
  font-size: 10px;
  color: var(--accent-yellow);
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
  background: var(--accent-green);
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
.status--running   { color: var(--accent-green);  border-color: var(--accent-green); }
.status--paused    { color: #666;                  border-color: #444; }
.status--no_recipe { color: var(--accent-yellow); border-color: #554400; }
.status--no_material { color: var(--accent-yellow); border-color: #554400; }
.status--no_power  { color: var(--accent-red);    border-color: #552222; }

/* EU/s */
.inst-eu {
  font-size: 11px;
  color: var(--accent-yellow);
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
  color: var(--accent-green);
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
  border-color: var(--accent-red);
  color: var(--accent-red);
}
.toggle-btn--on:hover { background: #3a2525; }
.toggle-btn--off {
  background: #1e3a1e;
  border-color: var(--accent-green);
  color: var(--accent-green);
}
.toggle-btn--off:hover { background: #254a25; }

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
  background: #2a2a10;
  border-color: var(--accent-yellow);
  color: var(--accent-yellow);
}
.oc-btn--up:hover { background: #3a3a18; }
.oc-btn--down {
  background: #252525;
  border-color: #666;
  color: #999;
}
.oc-btn--down:hover { background: #2e2e2e; }

.voltage-select {
  background: #1e1e2a;
  border: 1px solid var(--accent-yellow);
  color: var(--accent-yellow);
  font-family: inherit;
  font-size: 10px;
  padding: 2px 4px;
  cursor: pointer;
}
.voltage-select:focus { outline: none; }
</style>
