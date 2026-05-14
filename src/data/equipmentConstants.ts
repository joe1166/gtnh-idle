import type { EquipSlot, PlayerAttrId } from './types'

export const EQUIP_SLOT_ORDER: EquipSlot[] = [
  'weapon',
  'head',
  'chest',
  'legs',
  'accessory1',
  'accessory2',
]

export const EQUIP_ATTR_DISPLAY_ORDER: PlayerAttrId[] = [
  'combat_attack',
  'combat_defense',
  'combat_hp',
  'combat_speed',
]

export const EQUIP_RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const

export const EQUIP_DEFAULT_FILTER = 'all' as const
