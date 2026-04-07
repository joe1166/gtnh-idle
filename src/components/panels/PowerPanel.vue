<template>
  <div class="power-panel">
    <!-- 电力概览 -->
    <div class="panel-card">
      <div class="card-header">
        <span class="card-icon">⚡</span>
        <span class="card-title">{{ t('panel.power.title') }}</span>
      </div>

      <div class="power-stats">
        <div class="stat-row">
          <span class="stat-label">{{ t('label.output') }}</span>
          <span class="stat-value color-green">{{ fmt(powerStore.totalGenPerSec) }} EU/s</span>
          <span class="stat-sep">|</span>
          <span class="stat-label">{{ t('label.consume') }}</span>
          <span class="stat-value color-red">{{ fmt(powerStore.totalConsumePerSec) }} EU/s</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">{{ t('label.net') }}</span>
          <span
            class="stat-value"
            :class="powerStore.netPerSec >= 0 ? 'color-green' : 'color-red'"
          >
            {{ powerStore.netPerSec >= 0 ? '+' : '' }}{{ fmt(powerStore.netPerSec) }} EU/s
          </span>
        </div>
        <div class="stat-row battery-row">
          <span class="stat-label">{{ t('label.battery') }}</span>
          <div class="progress-bar-wrap">
            <div
              class="progress-bar-fill"
              :class="batteryColorClass"
              :style="{ width: powerStore.batteryPercent + '%' }"
            ></div>
          </div>
          <span class="battery-nums">
            {{ fmt(powerStore.batteryCurrentEU) }} / {{ fmt(powerStore.batteryCapacityEU) }} EU
          </span>
        </div>
      </div>
    </div>

    <!-- 发电机列表 -->
    <div class="panel-card">
      <div class="gen-section-header">
        <div class="gen-title-row">
          <span class="card-title">{{ t('label.generator') }}</span>
          <button
            v-for="def in availableGeneratorDefs"
            :key="def.id"
            class="build-btn"
            :class="canBuild(def) ? 'build-btn--ok' : 'build-btn--lack'"
            @click="machineStore.buildMachine(def.id)"
          >
            {{ t('btn.build') }} {{ t(def.locKey) }}
          </button>
        </div>
        <div class="gen-cost-row" v-for="def in availableGeneratorDefs" :key="'cost-' + def.id">
          <span class="cost-label">{{ t('btn.needs') }}</span>
          <span
            v-for="c in def.buildCost"
            :key="c.resourceId"
            class="cost-chip"
            :class="inventoryStore.getAmount(c.resourceId) >= c.amount ? 'cost-chip--ok' : 'cost-chip--lack'"
          >
            {{ db.name('resources', c.resourceId) }}×{{ c.amount }}
            <span class="cost-have">({{ fmt(inventoryStore.getAmount(c.resourceId)) }})</span>
          </span>
        </div>
      </div>

      <div v-if="generatorInstances.length === 0" class="empty-hint">
        {{ t('hint.no_generator') }}
      </div>

      <table v-else class="machine-table">
        <thead>
          <tr>
            <th>{{ t('label.name') }}</th>
            <th>{{ t('label.output') }}</th>
            <th>{{ t('label.fuel') }}</th>
            <th>{{ t('label.status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="gen in generatorInstances" :key="gen.instanceId">
            <td class="cell-name">
              {{ db.name('machines', gen.defId) }}
              <span v-if="getGenDef(gen.defId)?.voltage !== undefined" class="volt-badge">
                {{ getVoltTierName(getGenDef(gen.defId)?.voltage ?? 1) }}
              </span>
            </td>
            <td class="cell-eu color-green">{{ getGenDef(gen.defId)?.euPerSec ?? '?' }} EU/s</td>
            <td class="cell-fuel">
              <span v-if="getGenDef(gen.defId)">
                {{ db.name('resources', getGenDef(gen.defId)!.fuelResourceId!) }}
                {{ getGenDef(gen.defId)!.fuelPerSec }}/s
              </span>
            </td>
            <td class="cell-toggle">
              <span v-if="gen.isRunning && gen.status === 'running'" class="run-indicator">
                {{ t('status.running') }}
              </span>
              <span v-if="gen.status === 'no_fuel'" class="status-tag status--no_fuel">
                {{ t('status.no_fuel') }}
              </span>
              <button
                class="toggle-btn"
                :class="gen.isRunning ? 'toggle-btn--running' : 'toggle-btn--stopped'"
                @click="machineStore.toggleMachine(gen.instanceId)"
              >
                {{ gen.isRunning ? t('btn.stop') : t('btn.start') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePowerStore } from '../../stores/powerStore'
import { useMachineStore } from '../../stores/machineStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import { fmt } from '../../utils/format'
import { VoltTierName } from '../../data/types'
import type { MachineDef } from '../../data/types'

const powerStore     = usePowerStore()
const machineStore   = useMachineStore()
const inventoryStore = useInventoryStore()

const batteryColorClass = computed(() => {
  const pct = powerStore.batteryPercent
  if (pct >= 60) return 'fill-green'
  if (pct >= 25) return 'fill-yellow'
  return 'fill-red'
})

/** 可建造的发电机定义列表（category=2） */
const availableGeneratorDefs = computed<MachineDef[]>(() =>
  db.filter('machines', (m) => m.category === 2),
)

/** 已建造的发电机实例列表 */
const generatorInstances = computed(() =>
  machineStore.instances.filter((m) => {
    const def = db.get('machines', m.defId)
    return def?.category === 2
  }),
)

function getGenDef(defId: string): MachineDef | null {
  return db.get('machines', defId) ?? null
}

function canBuild(def: MachineDef): boolean {
  return inventoryStore.canAfford(def.buildCost)
}

function getVoltTierName(voltage: number): string {
  return VoltTierName[voltage] ?? String(voltage)
}
</script>

<style scoped>
.power-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: 'Consolas', 'Courier New', monospace;
  color: var(--text-primary);
}

.panel-card {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  padding: 14px 16px;
}

.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
}

.card-icon { font-size: 16px; }

.card-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
}

.gen-section-header {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 12px;
}

.gen-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.gen-cost-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.cost-label { font-size: 11px; color: #666; }

.cost-chip {
  font-size: 11px;
  padding: 1px 6px;
  border: 1px solid;
  white-space: nowrap;
}
.cost-chip--ok   { color: var(--accent-green); border-color: #2a4a2a; }
.cost-chip--lack { color: var(--accent-red);   border-color: #4a2a2a; }
.cost-have { font-size: 10px; opacity: 0.7; margin-left: 2px; }

.build-btn {
  padding: 3px 10px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid;
  transition: background 0.12s;
  white-space: nowrap;
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

.power-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.stat-label {
  color: #888;
  min-width: 30px;
}

.stat-value { font-weight: bold; }
.stat-sep { color: var(--border-color); }

.battery-row { gap: 8px; }

.progress-bar-wrap {
  flex: 0 0 120px;
  height: 8px;
  background: #333;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  transition: width 0.4s ease;
}

.battery-nums {
  font-size: 12px;
  color: #aaa;
  white-space: nowrap;
}

.fill-green  { background-color: var(--accent-green); }
.fill-yellow { background-color: var(--accent-yellow); }
.fill-red    { background-color: var(--accent-red); }

.color-green { color: var(--accent-green); }
.color-red   { color: var(--accent-red); }

.machine-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 12px;
}

.machine-table th {
  text-align: left;
  color: #666;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-color);
  font-weight: normal;
}

.machine-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #333;
  vertical-align: middle;
}

.machine-table tbody tr:last-child td { border-bottom: none; }

.cell-name  { color: var(--text-primary); width: 20%; }
.cell-eu    { width: 15%; }
.cell-fuel  { color: #aaa; width: 50%; }

.toggle-btn {
  background: #222;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 3px 10px;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: background 0.15s;
}

.toggle-btn:hover { background: #333; }

.toggle-btn--running { border-color: var(--accent-red);   color: var(--accent-red); }
.toggle-btn--running:hover { background: #3a2020; }
.toggle-btn--stopped { border-color: var(--accent-green); color: var(--accent-green); }
.toggle-btn--stopped:hover { background: #1e3a1e; }

.run-indicator {
  font-size: 10px;
  color: var(--accent-green);
  white-space: nowrap;
  margin-right: 4px;
}

.oc-btn {
  padding: 2px 8px;
  font-family: inherit;
  font-size: 10px;
  cursor: pointer;
  border: 1px solid;
  transition: background 0.12s;
  white-space: nowrap;
  margin-left: 4px;
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

.cell-toggle {
  text-align: right;
  width: 15%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  flex-wrap: wrap;
}

.empty-hint {
  color: #555;
  font-size: 12px;
  padding: 8px 0;
}

.volt-badge {
  font-size: 10px;
  padding: 1px 5px;
  border: 1px solid var(--accent-yellow);
  color: var(--accent-yellow);
  margin-left: 4px;
}

.status-tag {
  font-size: 10px;
  padding: 1px 5px;
  border: 1px solid;
  white-space: nowrap;
}
.status--no_fuel {
  color: var(--accent-yellow);
  border-color: var(--accent-yellow);
}
</style>
