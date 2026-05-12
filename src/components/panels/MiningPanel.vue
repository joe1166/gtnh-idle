<template>
  <div class="mining-panel">
    <div class="panel-header">
      <span class="panel-title">{{ t('panel.mining.title') }}</span>
      <span class="panel-hint">{{ t('panel.mining.hint') }}</span>
    </div>

    <div class="resource-list">
      <div
        v-for="res in miningResources"
        :key="res.id"
        class="resource-row"
      >
        <!-- 左：名称 + 数量 + 进度条 -->
        <div class="res-info">
          <span class="res-name">{{ t(res.locKey) }}</span>
          <span class="res-amount">
            <span :class="{ 'amount-warn': isAlmostFull(res.id) }">
              {{ fmt(inventoryStore.getAmount(res.id)) }}
            </span>
            <span class="amount-sep">/</span>
            <span class="amount-cap">{{ fmt(inventoryStore.getCap(res.id)) }}</span>
          </span>
          <div class="mini-bar-wrap">
            <div
              class="mini-bar-fill"
              :class="barClass(res.id)"
              :style="{ width: fillPct(res.id) + '%' }"
            ></div>
          </div>
        </div>

        <!-- 中：手动采集 -->
        <button
          class="collect-btn"
          :disabled="isFull(res.id)"
          @click="manualCollect(res.id, res.locKey)"
        >
          ⛏ <span class="collect-plus">+5</span>
        </button>

        <!-- 右：矿机区域 -->
        <div class="miner-section">
          <!-- 已部署矿机实例（按当前配方筛选到此资源行） -->
          <div
            v-for="inst in getMinersForResource(res.id)"
            :key="inst.instanceId"
            class="miner-instance"
          >
            <!-- 机器名 -->
            <span class="miner-name">{{ db.name('machines', inst.defId) }}</span>
            <!-- 运行状态 -->
            <span v-if="inst.isRunning" class="miner-run-indicator">
              {{ inst.selectedVoltage > 1 ? getVoltTierName(inst.selectedVoltage) : t('status.running') }}
            </span>
            <!-- 异常状态 -->
            <span
              v-if="inst.status !== 'running' && inst.status !== 'paused'"
              class="miner-status-tag"
              :class="'status--' + inst.status"
            >{{ statusLabel(inst.status) }}</span>
            <!-- 换矿下拉 -->
            <select
              class="mine-select"
              :value="inst.selectedRecipeId ?? ''"
              @change="machineStore.setRecipe(inst.instanceId, ($event.target as any).value)"
            >
              <option
                v-for="r in getMinerAllowedRecipes(inst.defId)"
                :key="r.id"
                :value="r.id"
              >{{ t(r.locKey) }}</option>
            </select>
            <!-- 开关 -->
            <span
              class="miner-tag"
              :class="inst.isRunning ? 'miner-tag--running' : 'miner-tag--paused'"
              @click="machineStore.toggleMachine(inst.instanceId)"
            >{{ inst.isRunning ? t('btn.stop') : t('btn.start') }}</span>
            <!-- 电压选择器（需解锁超频科技，且非 ULV 机器） -->
            <template v-if="techStore.hasFeature('overclock') && canMinerOverclock(inst.defId)">
              <select
                class="mine-voltage-select"
                :value="inst.selectedVoltage"
                @change="onMinerVoltageChange(inst.instanceId, $event)"
              >
                <option
                  v-for="v in getMinerAvailableVoltages(inst)"
                  :key="v"
                  :value="v"
                >{{ getVoltTierName(v) }}</option>
              </select>
            </template>
          </div>

          <!-- 部署矿机入口（只有该资源有对应采矿配方时才显示） -->
          <template v-if="getMineRecipe(res.id)">
            <button class="deploy-btn" @click="togglePicker(res.id)">
              {{ t('btn.deploy_miner') }}
            </button>
            <!-- 矿机类型选择面板 -->
            <div v-if="deployingFor === res.id" class="deploy-picker">
              <div
                v-for="def in availableMinerDefs"
                :key="def.id"
                class="deploy-option"
                :class="{ 'deploy-option--lack': !canBuild(def) }"
                @click="deployMiner(def, res.id)"
              >
                <span class="option-name">{{ t(def.locKey) }}</span>
                <span class="option-cost">
                  <span
                    v-for="c in def.buildCost"
                    :key="c.resourceId"
                    class="cost-item"
                    :class="{ 'cost-red': inventoryStore.getAmount(c.resourceId) < c.amount }"
                  >{{ db.name('resources', c.resourceId) }}×{{ c.amount }}</span>
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMachineStore } from '../../stores/machineStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useTechStore } from '../../stores/techStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import { fmt } from '../../utils/format'
import { useToast } from '../../composables/useToast'
import type { MachineDef, RecipeDef } from '../../data/types'
import { usePowerStore } from '../../stores/powerStore'
import { VoltTierName } from '../../data/types'
import type { MachineStatus } from '../../stores/machineStore'

const machineStore   = useMachineStore()
const powerStore     = usePowerStore()
const inventoryStore = useInventoryStore()
const techStore      = useTechStore()
const { show }       = useToast()

/** 当前展开部署选择器的资源 ID，null = 全部收起 */
const deployingFor = ref<string | null>(null)

/** 所有矿石/燃料资源 */
const miningResources = computed(() =>
  db.filter('resources', (r) => r.category === 'ore' || r.category === 'fuel')
)

/** 所有矿机类型定义 */
const availableMinerDefs = computed<MachineDef[]>(() =>
  db.filter('machines', (m) => m.role === 'miner')
)

/** 获取某资源对应的采矿配方（按产出匹配） */
function getMineRecipe(resourceId: string): RecipeDef | null {
  return db.filter('recipes', (r) =>
    r.requiredRole === 'miner' && r.outputs.some((o) => o.resourceId === resourceId)
  )[0] ?? null
}

/** 获取某矿机 def 的所有允许配方 */
function getMinerAllowedRecipes(defId: string): RecipeDef[] {
  const def = db.get('machines', defId)
  if (!def) return []
  return db.filter('recipes', (r) => r.requiredRole === 'miner' && r.requiredLevel <= def.tier)
}

/** 获取当前正在开采此资源的矿机实例（按 selectedRecipeId 的产出匹配） */
function getMinersForResource(resourceId: string) {
  const recipe = getMineRecipe(resourceId)
  if (!recipe) return []
  return machineStore.instances.filter((inst) => {
    const def = db.get('machines', inst.defId)
    return def?.role === 'miner' && inst.selectedRecipeId === recipe.id
  })
}

function canBuild(def: MachineDef): boolean {
  return inventoryStore.canAfford(def.buildCost)
}

function togglePicker(resourceId: string) {
  deployingFor.value = deployingFor.value === resourceId ? null : resourceId
}

function deployMiner(def: MachineDef, resourceId: string) {
  const recipe = getMineRecipe(resourceId)
  if (!recipe) return
  const ok = machineStore.buildMachine(def.id, recipe.id)
  if (ok) {
    show(`${t('toast.deploy.success')} ${t(def.locKey)} → ${t(recipe.locKey)}`, 'var(--warn)')
    deployingFor.value = null
  } else {
    show(t('toast.deploy.fail'), 'var(--danger)')
  }
}

// ── 辅助函数 ─────────────────────────────────────────────────

function fillPct(id: string): number {
  const cap = inventoryStore.getCap(id)
  if (!cap) return 0
  return Math.min(100, (inventoryStore.getAmount(id) / cap) * 100)
}
function isFull(id: string): boolean {
  return inventoryStore.getAmount(id) >= inventoryStore.getCap(id)
}
function isAlmostFull(id: string): boolean {
  return fillPct(id) >= 90
}
function barClass(id: string): string {
  const p = fillPct(id)
  if (p >= 100) return 'bar-red'
  if (p >= 90)  return 'bar-yellow'
  return 'bar-green'
}
function manualCollect(resourceId: string, locKey: string) {
  inventoryStore.addItem(resourceId, 5)
  show(`+5 ${t(locKey)}`)
}
function statusLabel(status: MachineStatus): string {
  return t(`status.${status}`)
}

function getVoltTierName(v: number): string {
  return VoltTierName[v] ?? `V${v}`
}

function canMinerOverclock(defId: string): boolean {
  return (db.get('machines', defId)?.maxVoltage ?? 0) > 0
}

function getMinerAvailableVoltages(inst: { defId: string; selectedVoltage: number; selectedRecipeId: string | null }): number[] {
  const def = db.get('machines', inst.defId)
  if (!def) return []
  const recipe = inst.selectedRecipeId ? db.get('recipes', inst.selectedRecipeId) : null
  const minV = recipe?.voltage ?? 0
  const maxV = Math.min(def.maxVoltage ?? 0, Math.max(powerStore.globalMaxVoltage, minV))
  const result: number[] = []
  for (let v = minV; v <= maxV; v++) result.push(v)
  return result
}

function onMinerVoltageChange(instanceId: string, event: Event): void {
  machineStore.setVoltage(instanceId, Number((event.target as any).value))
}
</script>

<style scoped>
.mining-panel {
  font-family: 'Consolas', 'Courier New', monospace;
  color: var(--text-primary);
}

.panel-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-title {
  font-size: 15px;
  font-weight: bold;
}

.panel-hint {
  font-size: 11px;
  color: #666;
}

/* 每行资源 */
.resource-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.resource-row {
  display: grid;
  grid-template-columns: 260px 80px 1fr;
  align-items: start;
  gap: 10px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  padding: 8px 14px;
  transition: border-color 0.15s;
}

.resource-row:hover {
  border-color: #555;
}

/* 左侧信息 */
.res-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 4px;
}

.res-name {
  font-size: 13px;
  font-weight: bold;
  min-width: 70px;
  color: #d0d0d0;
}

.res-amount {
  font-size: 12px;
  white-space: nowrap;
}

.amount-warn { color: var(--warn); }
.amount-sep  { color: #555; margin: 0 2px; }
.amount-cap  { color: #666; }

.mini-bar-wrap {
  flex: 1 1 60px;
  height: 4px;
  background: #333;
  min-width: 40px;
  max-width: 100px;
  margin-top: 1px;
}

.mini-bar-fill {
  height: 100%;
  transition: width 0.4s;
}
.bar-green  { background: var(--accent); }
.bar-yellow { background: var(--warn); }
.bar-red    { background: var(--danger); }

/* 手动采集 */
.collect-btn {
  background: var(--accent-bg);
  border: 1px solid #3a5a3a;
  color: var(--text-primary);
  padding: 5px 14px;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  white-space: nowrap;
  align-self: start;
  margin-top: 1px;
}
.collect-btn:hover:not(:disabled) {
  background: var(--accent-bg-hover);
  border-color: var(--accent);
}
.collect-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.collect-plus {
  color: var(--accent);
  font-weight: bold;
}

/* 矿机区域 */
.miner-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}

/* 矿机实例行 */
.miner-instance {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  padding: 2px 0;
}

.miner-name {
  font-size: 11px;
  color: #aaa;
  margin-right: 2px;
}

.miner-run-indicator {
  font-size: 10px;
  color: var(--accent);
  white-space: nowrap;
}

.miner-status-tag {
  font-size: 10px;
  padding: 1px 4px;
  border: 1px solid;
}
.status--no_power   { color: var(--danger);    border-color: var(--danger); }
.status--no_fuel    { color: var(--warn);  border-color: var(--warn); }
.status--no_recipe  { color: var(--warn);  border-color: var(--warn); }
.status--no_material { color: var(--warn); border-color: var(--warn); }

/* 换矿下拉 */
.mine-select {
  background: #222;
  border: 1px solid #555;
  color: #ccc;
  font-family: inherit;
  font-size: 10px;
  padding: 1px 4px;
  cursor: pointer;
  max-width: 120px;
}
.mine-select:focus {
  outline: none;
  border-color: var(--warn);
}

/* 开关标签 */
.miner-tag {
  font-size: 11px;
  padding: 2px 7px;
  border: 1px solid;
  cursor: pointer;
  transition: opacity 0.12s;
  user-select: none;
  white-space: nowrap;
}
.miner-tag:hover { opacity: 0.75; }
.miner-tag--running {
  color: var(--danger);
  border-color: var(--danger);
  background: var(--danger-subtle);
}
.miner-tag--paused {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-subtle);
}

/* 超频按钮 */
.miner-oc-btn {
  font-size: 11px;
  padding: 1px 5px;
  border: 1px solid;
  cursor: pointer;
  user-select: none;
  transition: opacity 0.12s;
}
.mine-voltage-select {
  background: #1e1e2a;
  border: 1px solid var(--warn);
  color: var(--warn);
  font-family: inherit;
  font-size: 10px;
  padding: 1px 4px;
  cursor: pointer;
}
.mine-voltage-select:focus { outline: none; }

/* 部署按钮 */
.deploy-btn {
  background: #252525;
  border: 1px solid #555;
  color: #bbb;
  padding: 3px 10px;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.deploy-btn:hover {
  background: #2e2e2e;
  border-color: var(--warn);
  color: var(--warn);
}

/* 矿机类型选择器 */
.deploy-picker {
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: #1e1e1e;
  border: 1px solid #444;
  padding: 6px 8px;
  min-width: 200px;
}

.deploy-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 6px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.1s, border-color 0.1s;
}
.deploy-option:hover:not(.deploy-option--lack) {
  background: #2a2a2a;
  border-color: var(--warn);
}
.deploy-option--lack {
  opacity: 0.45;
  cursor: not-allowed;
}

.option-name {
  font-size: 12px;
  color: var(--text-primary);
}

.option-cost {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.cost-item {
  font-size: 10px;
  color: #888;
}
.cost-red {
  color: var(--danger) !important;
}
</style>
