<template>
  <div class="equip-panel">
    <section class="slots-pane">
      <div class="pane-title">{{ t('panel.role.equip_slots') }}</div>
      <button
        v-for="slot in slotOrder"
        :key="slot"
        class="slot-row"
        :class="{ 'slot-row--active': selectedSlot === slot }"
        @click="toggleSelectSlot(slot)"
      >
        <span class="slot-name">{{ t(`equip.slot.${slot}`) }}</span>
        <span class="slot-item">
          {{ equippedName(slot) }}
        </span>
      </button>
    </section>

    <section class="list-pane">
      <div class="list-head">
        <div class="pane-title">{{ t('panel.role.equip_list') }}</div>
        <div class="filter-row">
          <button
            v-for="f in filters"
            :key="f"
            class="filter-btn"
            :class="{ 'filter-btn--active': activeFilter === f }"
            @click="activeFilter = f"
          >
            {{ t(`panel.role.filter.${f}`) }}
          </button>
        </div>
      </div>

      <div class="item-list">
        <div
          v-for="item in filteredItems"
          :key="item.id"
          class="item-card"
        >
          <img class="item-icon" :src="item.iconPath" alt="" />
          <div class="item-main">
            <div class="item-name">{{ t(item.locKey) }}</div>
            <div class="item-meta">
              <span>{{ t(`equip.slot.${item.slot}`) }}</span>
              <span>{{ t(`equip.rarity.${item.rarity}`) }}</span>
              <span v-if="item.setId">{{ t('panel.role.set_tag') }} {{ t(setName(item.setId)) }}</span>
            </div>
            <div class="item-attrs">{{ renderAttrPairs(item.attrBonus) }}</div>
            <div v-if="item.obtainType === 'craft'" class="item-cost">
              {{ renderCraftCost(item.craftCost) }}
            </div>
          </div>

          <div class="item-actions">
            <button
              v-if="item.obtainType === 'craft'"
              class="mini-btn"
              :disabled="!equipmentStore.canCraft(item.id)"
              @click="craft(item.id)"
            >
              {{ t('btn.craft') }}
            </button>
            <button
              class="mini-btn mini-btn--equip"
              :disabled="!canEquip(item.id)"
              @click="equip(item.id)"
            >
              {{ t('panel.role.equip') }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="set-pane">
      <div class="pane-title">{{ t('panel.role.set_bonus') }}</div>
      <div v-for="setDef in allSets" :key="setDef.id" class="set-card">
        <div class="set-name">{{ t(setDef.locKey) }} ({{ setStatus(setDef.id).pieces }})</div>
        <div class="set-line" :class="{ 'set-line--on': setStatus(setDef.id).active2 }">
          2pc: {{ renderAttrPairs(setDef.bonus2) }}
        </div>
        <div class="set-line" :class="{ 'set-line--on': setStatus(setDef.id).active4 }">
          4pc: {{ renderAttrPairs(setDef.bonus4) }}
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { db } from '../../data/db'
import { t } from '../../data/i18n'
import { useEquipmentStore } from '../../stores/equipmentStore'
import { useToast } from '../../composables/useToast'
import { EQUIP_DEFAULT_FILTER, EQUIP_RARITY_ORDER, EQUIP_SLOT_ORDER } from '../../data/equipmentConstants'
import type { EquipSlot, ResourceAmount } from '../../data/types'

const equipmentStore = useEquipmentStore()
const { show } = useToast()
const slotOrder = EQUIP_SLOT_ORDER
const selectedSlot = ref<EquipSlot | null>(null)
const activeFilter = ref<'all' | 'craftable' | 'owned' | 'set' | 'equippable'>(EQUIP_DEFAULT_FILTER)
const filters: Array<'all' | 'craftable' | 'owned' | 'set' | 'equippable'> = ['all', 'craftable', 'owned', 'set', 'equippable']

const allSets = computed(() => equipmentStore.allSets)
const allItems = computed(() => equipmentStore.allItems)

function toggleSelectSlot(slot: EquipSlot): void {
  selectedSlot.value = selectedSlot.value === slot ? null : slot
}

function setName(setId: string): string {
  return db.get('equip_sets', setId)?.locKey ?? setId
}

function equippedName(slot: EquipSlot): string {
  const id = equipmentStore.equipped[slot]
  if (!id) return t('panel.role.empty_slot')
  const item = db.get('equip_items', id)
  return item ? t(item.locKey) : id
}

function parseAttrPairs(raw: string): Array<{ key: string; value: number }> {
  if (!raw) return []
  return raw
    .split('|')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const [k, v] = s.split(':')
      return { key: (k ?? '').trim(), value: Number((v ?? '').trim()) }
    })
    .filter(p => p.key && Number.isFinite(p.value))
}

function renderAttrPairs(raw: string): string {
  const pairs = parseAttrPairs(raw)
  if (pairs.length === 0) return '-'
  return pairs.map(p => `${t(`attr.${p.key}`)} +${p.value}`).join(' | ')
}

function renderCraftCost(cost: ResourceAmount[]): string {
  if (!cost || cost.length === 0) return t('panel.role.cannot_craft')
  return cost.map(c => `${db.name('resources', c.resourceId)} x${c.amount}`).join('  ')
}

function rarityRank(r: string): number {
  const idx = EQUIP_RARITY_ORDER.indexOf(r as (typeof EQUIP_RARITY_ORDER)[number])
  return idx < 0 ? -1 : idx
}

const filteredItems = computed(() => {
  let items = allItems.value
  if (selectedSlot.value) {
    items = items.filter(i => i.slot === selectedSlot.value)
  }

  if (activeFilter.value === 'craftable') {
    items = items.filter(i => i.obtainType === 'craft' && equipmentStore.canCraft(i.id))
  } else if (activeFilter.value === 'owned') {
    items = items.filter(i => equipmentStore.ownedCount(i.id) > 0)
  } else if (activeFilter.value === 'set') {
    items = items.filter(i => !!i.setId)
  } else if (activeFilter.value === 'equippable') {
    items = items.filter(i => canEquip(i.id))
  }

  return [...items].sort((a, b) => {
    const r = rarityRank(b.rarity) - rarityRank(a.rarity)
    if (r !== 0) return r
    const s = slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot)
    if (s !== 0) return s
    return t(a.locKey).localeCompare(t(b.locKey))
  })
})

function canEquip(itemId: string): boolean {
  const item = db.get('equip_items', itemId)
  if (!item) return false
  if (selectedSlot.value && selectedSlot.value !== item.slot) return false
  return equipmentStore.canEquip(itemId, selectedSlot.value ?? item.slot)
}

function craft(itemId: string): void {
  if (!equipmentStore.craftItem(itemId)) {
    show(t('toast.craft.fail'), 'var(--danger)')
    return
  }
  show(t('toast.craft.success'), 'var(--accent)')
}

function equip(itemId: string): void {
  const item = db.get('equip_items', itemId)
  if (!item) return
  const slot = selectedSlot.value ?? item.slot
  if (!equipmentStore.equipItem(itemId, slot)) {
    show(t('panel.role.equip_fail'), 'var(--danger)')
    return
  }
  show(t('panel.role.equip_success'), 'var(--accent)')
}

function setStatus(setId: string): { pieces: number; active2: boolean; active4: boolean } {
  return equipmentStore.getSetStatus(setId)
}
</script>

<style scoped>
.equip-panel {
  display: grid;
  grid-template-columns: 260px minmax(420px, 1fr) 300px;
  gap: 12px;
}

.slots-pane, .list-pane, .set-pane {
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.02);
  padding: 10px;
}

.pane-title {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
}

.slot-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--text-primary);
  padding: 6px 8px;
  margin-bottom: 6px;
  cursor: pointer;
}

.slot-row--active {
  border-color: var(--accent);
  background: var(--accent-bg);
}

.slot-name { font-size: 12px; }
.slot-item { font-size: 11px; color: var(--text-secondary); }

.list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.filter-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.filter-btn {
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-size: 11px;
  padding: 4px 6px;
  cursor: pointer;
}

.filter-btn--active {
  border-color: var(--accent);
  color: var(--accent);
}

.item-list {
  max-height: 520px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item-card {
  border: 1px solid var(--border-subtle);
  background: rgba(0, 0, 0, 0.2);
  padding: 8px;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.item-icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.04);
}

.item-name { font-size: 13px; font-weight: 700; }
.item-meta { font-size: 11px; color: var(--text-secondary); display: flex; gap: 8px; flex-wrap: wrap; }
.item-attrs { font-size: 11px; color: var(--accent); margin-top: 2px; }
.item-cost { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }

.item-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mini-btn {
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--text-primary);
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
}

.mini-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mini-btn--equip {
  border-color: var(--accent);
  color: var(--accent);
}

.set-card {
  border: 1px solid var(--border-subtle);
  padding: 8px;
  margin-bottom: 8px;
}

.set-name { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
.set-line { font-size: 11px; color: var(--text-secondary); margin-bottom: 3px; }
.set-line--on { color: var(--accent); }
</style>
