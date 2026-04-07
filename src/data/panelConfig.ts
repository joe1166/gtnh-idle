// ============================================================
// 面板配置 (panelConfig.ts)
// ============================================================
//
// 所有侧边栏面板的唯一配置来源。
// 新增面板时只需在此添加一条记录，无需修改 SideNav 逻辑。
//
// condition 字段说明：
//   undefined          → 始终显示
//   { type: 'tech', para: '<techId>' } → 指定科技研究完成后才显示
// ============================================================

export interface PanelCondition {
  type: 'tech'
  para: string  // techId，对应 techStore.isResearched(para)
}

export interface PanelDef {
  id: string
  order: number
  icon: string
  labelKey: string
  condition?: PanelCondition
}

export const PANEL_DEFS: PanelDef[] = [
  { id: 'chapter',   order: 1, icon: '📋', labelKey: 'nav.chapter'   },
  { id: 'steam',     order: 2, icon: '♨',  labelKey: 'nav.steam'     },
  { id: 'power',     order: 3, icon: '⚡', labelKey: 'nav.power',    condition: { type: 'tech', para: 'electric_age' } },
  { id: 'mining',    order: 4, icon: '⛏️', labelKey: 'nav.mining'    },
  { id: 'crafting',  order: 5, icon: '🔨', labelKey: 'nav.crafting'  },
  { id: 'inventory', order: 6, icon: '📦', labelKey: 'nav.inventory' },
  { id: 'tech',      order: 7, icon: '🔬', labelKey: 'nav.tech'      },
]
