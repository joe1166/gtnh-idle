<template>
  <div class="inventory-panel">
    <div class="panel-card">
      <div class="card-header">
        <span class="card-title">{{ t('inventory.title') }}</span>
      </div>

      <div v-for="group in resourceGroups" :key="group.category" class="resource-group">
        <div class="group-header">{{ group.label }}</div>
        <div class="resource-list">
          <div
            v-for="item in group.items"
            :key="item.id"
            class="resource-row"
          >
            <span class="res-name">{{ item.name }}</span>
            <span class="res-amount">
              {{ fmt(item.amount) }} / {{ fmt(item.cap) }}
            </span>
            <div class="res-bar-wrap">
              <div
                class="res-bar-fill"
                :class="barColorClass(item.pct)"
                :style="{ width: item.pct + '%' }"
              ></div>
            </div>
            <span class="res-pct" :class="barColorClass(item.pct)">
              {{ Math.round(item.pct) }}%
            </span>
          </div>
        </div>
      </div>

      <div v-if="totalItems === 0" class="empty-hint">
        {{ t('inventory.empty') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useInventoryStore } from '../../stores/inventoryStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import { fmt } from '../../utils/format'

const inventoryStore = useInventoryStore()

/** 仓库面板显示的大类顺序 */
const CATEGORY_ORDER = ['raw', 'mat', 'prod', 'special', 'misc']

/** 已知的大类（不在上面的归为未分类） */
const KNOWN_CATS = new Set(['raw', 'mat', 'prod', 'special', 'misc'])

interface ResourceRow {
  id: string
  name: string
  amount: number
  cap: number
  pct: number
}

interface ResourceGroup {
  category: string
  label: string
  items: ResourceRow[]
}

/** 从 category 字段（如 'raw.wood'）提取顶层大类 */
function topCategory(category: string): string {
  return category.split('.')[0]
}

const resourceGroups = computed((): ResourceGroup[] => {
  const groups: ResourceGroup[] = []

  for (const cat of CATEGORY_ORDER) {
    const resources = db.table('resources').filter((r) => topCategory(r.category) === cat)
    if (resources.length === 0) continue

    const items: ResourceRow[] = resources
      .filter((r) => (inventoryStore.getAmount(r.id) > 0) || (inventoryStore.totalProduced[r.id] ?? 0) > 0)
      .map((r) => {
        const amount = inventoryStore.getAmount(r.id)
        const cap = inventoryStore.getCap(r.id) || r.defaultCap
        const pct = cap > 0 ? Math.min(100, (amount / cap) * 100) : 0
        return { id: r.id, name: t(r.locKey), amount, cap, pct }
      })

    if (items.length === 0) continue

    groups.push({ category: cat, label: t(`category.${cat}`), items })
  }

  // 未分类：不在 KNOWN_CATS 的所有资源
  const uncategorized = db.table('resources')
    .filter((r) => !KNOWN_CATS.has(topCategory(r.category)))
    .filter((r) => (inventoryStore.getAmount(r.id) > 0) || (inventoryStore.totalProduced[r.id] ?? 0) > 0)
    .map((r) => {
      const amount = inventoryStore.getAmount(r.id)
      const cap = inventoryStore.getCap(r.id) || r.defaultCap
      const pct = cap > 0 ? Math.min(100, (amount / cap) * 100) : 0
      return { id: r.id, name: t(r.locKey), amount, cap, pct }
    })

  if (uncategorized.length > 0) {
    groups.push({ category: 'uncategorized', label: t('category.uncategorized'), items: uncategorized })
  }

  return groups
})

const totalItems = computed(() =>
  db.table('resources').reduce((sum, r) => sum + inventoryStore.getAmount(r.id), 0)
)

function barColorClass(pct: number): string {
  if (pct >= 100) return 'bar-red'
  if (pct >= 90) return 'bar-yellow'
  return 'bar-green'
}
</script>

<style scoped>
.inventory-panel {
  font-family: 'Consolas', 'Courier New', monospace;
  color: var(--text-primary);
}

.panel-card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  padding: 14px 16px;
}

.card-header {
  margin-bottom: 14px;
}

.card-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
}

.resource-group {
  margin-bottom: 16px;
}

.resource-group:last-child {
  margin-bottom: 0;
}

.group-header {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding-bottom: 4px;
  border-bottom: 1px solid #333;
  margin-bottom: 6px;
}

.resource-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.resource-row {
  display: grid;
  grid-template-columns: 90px 130px 1fr 36px;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.res-name {
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.res-amount {
  color: #aaa;
  text-align: right;
  font-size: 11px;
  white-space: nowrap;
}

.res-bar-wrap {
  height: 6px;
  background: #2e2e2e;
  border: 1px solid #3a3a3a;
  overflow: hidden;
}

.res-bar-fill {
  height: 100%;
  transition: width 0.4s ease;
}

.res-pct {
  font-size: 10px;
  text-align: right;
  white-space: nowrap;
}

/* Bar colors */
.bar-green {
  background-color: var(--accent);
  color: var(--accent);
}

.bar-yellow {
  background-color: var(--warn);
  color: var(--warn);
}

.bar-red {
  background-color: var(--danger);
  color: var(--danger);
}

/* Text-only classes for pct label */
.res-pct.bar-green { background-color: transparent; }
.res-pct.bar-yellow { background-color: transparent; }
.res-pct.bar-red { background-color: transparent; }

.empty-hint {
  color: #555;
  font-size: 12px;
  padding: 8px 0;
}
</style>
