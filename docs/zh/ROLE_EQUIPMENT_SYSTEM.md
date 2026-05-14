# 角色面板与装备系统

---

## 技术部分

### 总体目标
- 工具系统与装备系统统一到独立的角色面板中。
- 战斗层只读取玩家最终属性值，不关心属性来源。
- 属性来源统一在聚合层处理：基础 + 工具 + 装备 + 套装。

### 入口与面板结构
- 侧边导航新增 `role` 面板（`tables/panels.csv`）。
- `RolePanel.vue` 作为主容器，分两个页签：
  - `tools`：复用 `ToolPanel.vue`（工具升级逻辑不变）
  - `equip`：`EquipmentPanel.vue`（装备管理）
- 世界面板底部 `BottomPanel` 已移除工具页签，仅保留群系页签。

### 核心 Store
- `equipmentStore.ts`
  - 维护 `owned`（装备库存）与 `equipped`（槽位穿戴）
  - 提供 `craft / equip / unequip` 行为
  - 运行时计算：
    - 装备属性加成
    - 套装 2 件/4 件加成
- `playerAttrStore.ts`
  - 提供统一属性读取接口：
    - `getPlayerAttr(attrId)`
    - `getPlayerAttrs()`
  - 聚合顺序：
    1. 基础属性
    2. 工具属性
    3. 装备属性
    4. 套装属性

### 与探索战斗的接线
- `exploreStore` 在进入探索 / 开始战斗 / 战斗 tick 时，刷新并读取聚合属性：
  - `combat_attack`
  - `combat_defense`
  - `combat_speed`
  - `combat_hp`
- 伤害公式保持原规则：`max(1, attack - defense)`，仅替换属性来源。

### 与世界资源点的接线
- `worldStore` 的能力门槛判定与采集 bonus 计算，改为读取统一属性系统。
- 这样采集能力也纳入“单一属性真值”，避免工具和战斗两套独立数值体系。

---

## 配置与数据

### 新增配置表

1. `tables/equip_items.csv`
- 字段：
  - `id, slot, locKey, iconPath, rarity, setId, obtainType, craftCost, attrBonus`
- 规则：
  - `obtainType`：`craft | loot`
  - `craftCost`：`resourceId:amount|resourceId:amount`
  - `attrBonus`：`attrId:value|attrId:value`

2. `tables/equip_sets.csv`
- 字段：
  - `id, locKey, bonus2, bonus4`
- 规则：
  - `bonus2/bonus4`：`attrId:value|attrId:value`

### 新增 schema 与导出
- `schemas/equip_items.schema.json`
- `schemas/equip_sets.schema.json`
- `schemas/csv-manifest.json` 已接入两张新表
- 通过 `npm run csv` 导出：
  - `src/config/equip_items.json`
  - `src/config/equip_sets.json`

### 代码常量（不走全局杂项）
- `src/data/equipmentConstants.ts`
  - 槽位顺序
  - 属性展示顺序
  - 品质排序顺序
  - 默认筛选

---

## UI 交互约定

### 槽位
- 固定最小槽位集合：
  - `weapon, head, chest, legs, accessory1, accessory2`
- 同槽位互斥，装备新物品时自动替换旧物品。

### 右侧列表
- 未选槽位：默认全装备列表。
- 选槽位：自动过滤为该槽位候选装备。
- 支持筛选：
  - `all / craftable / owned / set / equippable`

### 合成与装备
- `craft` 装备可直接制造。
- `loot` 装备不提供制造按钮。
- 点击式主流程：制造、装备、卸下、替换。

### 套装显示
- 显示当前件数、2 件效果、4 件效果与激活状态。
- 套装激活状态运行时推导，不单独持久化。

---

## 存档

- `useSaveLoad` 已接入 `equipment` store 状态。
- 新增持久化内容：
  - 装备库存 `owned`
  - 槽位穿戴 `equipped`
- 本期不做旧存档兼容迁移脚本；缺失字段按默认值初始化。
