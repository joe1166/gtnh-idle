import { defineStore } from 'pinia'
import { db } from '../data/db'
import { useInventoryStore } from './inventoryStore'
import { EQUIP_SLOT_ORDER } from '../data/equipmentConstants'
import type { EquipItemDef, EquipSetDef, EquipSlot, PlayerAttrId, PlayerEquipState, ResourceAmount } from '../data/types'

function parseAttrBonus(raw: string | undefined): Array<{ attrId: PlayerAttrId; value: number }> {
  if (!raw) return []
  return raw
    .split('|')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const [attrIdRaw, valueRaw] = part.split(':')
      const attrId = (attrIdRaw ?? '').trim() as PlayerAttrId
      const value = Number((valueRaw ?? '').trim())
      return { attrId, value }
    })
    .filter(pair => {
      if (!pair.attrId || !Number.isFinite(pair.value)) {
        console.warn('[equipmentStore] invalid attr bonus entry ignored')
        return false
      }
      return true
    })
}

function emptyEquippedState(): Record<EquipSlot, string | null> {
  return {
    weapon: null,
    head: null,
    chest: null,
    legs: null,
    accessory1: null,
    accessory2: null,
  }
}

export const useEquipmentStore = defineStore('equipment', {
  state: (): PlayerEquipState => ({
    owned: {},
    equipped: emptyEquippedState(),
  }),

  getters: {
    allItems(): EquipItemDef[] {
      return db.table('equip_items')
    },
    allSets(): EquipSetDef[] {
      return db.table('equip_sets')
    },
    ownedCount: (state) => (itemId: string): number => state.owned[itemId] ?? 0,
    isOwned(): (itemId: string) => boolean {
      return itemId => (this.ownedCount(itemId) > 0)
    },
    getItemDef(): (itemId: string) => EquipItemDef | undefined {
      return itemId => db.get('equip_items', itemId)
    },
    equippedItems(state): EquipItemDef[] {
      return EQUIP_SLOT_ORDER
        .map(slot => state.equipped[slot])
        .filter((id): id is string => !!id)
        .map(id => db.get('equip_items', id))
        .filter((item): item is EquipItemDef => !!item)
    },
    equipAttrBonuses(): Record<string, number> {
      const out: Record<string, number> = {}
      for (const item of this.equippedItems) {
        for (const pair of parseAttrBonus(item.attrBonus)) {
          out[pair.attrId] = (out[pair.attrId] ?? 0) + pair.value
        }
      }
      return out
    },
    setPieceCountBySetId(state): Record<string, number> {
      const out: Record<string, number> = {}
      for (const slot of EQUIP_SLOT_ORDER) {
        const itemId = state.equipped[slot]
        if (!itemId) continue
        const item = db.get('equip_items', itemId)
        if (!item?.setId) continue
        out[item.setId] = (out[item.setId] ?? 0) + 1
      }
      return out
    },
    setAttrBonuses(): Record<string, number> {
      const out: Record<string, number> = {}
      const pieceMap = this.setPieceCountBySetId
      for (const setDef of this.allSets) {
        const pieces = pieceMap[setDef.id] ?? 0
        if (pieces >= 2) {
          for (const pair of parseAttrBonus(setDef.bonus2)) {
            out[pair.attrId] = (out[pair.attrId] ?? 0) + pair.value
          }
        }
        if (pieces >= 4) {
          for (const pair of parseAttrBonus(setDef.bonus4)) {
            out[pair.attrId] = (out[pair.attrId] ?? 0) + pair.value
          }
        }
      }
      return out
    },
  },

  actions: {
    getSetStatus(setId: string): { pieces: number; active2: boolean; active4: boolean } {
      const pieces = this.setPieceCountBySetId[setId] ?? 0
      return {
        pieces,
        active2: pieces >= 2,
        active4: pieces >= 4,
      }
    },

    canCraft(itemId: string): boolean {
      const item = this.getItemDef(itemId)
      if (!item || item.obtainType !== 'craft') return false
      const cost = item.craftCost ?? []
      if (cost.length === 0) return false
      return useInventoryStore().canAfford(cost)
    },

    craftItem(itemId: string): boolean {
      const item = this.getItemDef(itemId)
      if (!item || item.obtainType !== 'craft') return false
      const cost: ResourceAmount[] = item.craftCost ?? []
      if (cost.length === 0) {
        console.warn(`[equipmentStore] craftCost invalid or empty for ${itemId}`)
        return false
      }
      const inv = useInventoryStore()
      if (!inv.spend(cost)) return false
      this.owned[itemId] = (this.owned[itemId] ?? 0) + 1
      return true
    },

    canEquip(itemId: string, slot?: EquipSlot): boolean {
      const item = this.getItemDef(itemId)
      if (!item) return false
      if ((this.owned[itemId] ?? 0) <= 0) return false
      if (slot && item.slot !== slot) return false
      return true
    },

    equipItem(itemId: string, forcedSlot?: EquipSlot): boolean {
      const item = this.getItemDef(itemId)
      if (!item) return false
      const targetSlot = forcedSlot ?? item.slot
      if (item.slot !== targetSlot) return false
      if (!this.canEquip(itemId, targetSlot)) return false

      const prevId = this.equipped[targetSlot]
      if (prevId) {
        this.owned[prevId] = (this.owned[prevId] ?? 0) + 1
      }

      this.owned[itemId] = Math.max(0, (this.owned[itemId] ?? 0) - 1)
      this.equipped[targetSlot] = itemId
      return true
    },

    unequip(slot: EquipSlot): boolean {
      const current = this.equipped[slot]
      if (!current) return false
      this.owned[current] = (this.owned[current] ?? 0) + 1
      this.equipped[slot] = null
      return true
    },

    grantItem(itemId: string, amount = 1): void {
      if (amount <= 0) return
      this.owned[itemId] = (this.owned[itemId] ?? 0) + amount
    },
  },
})
