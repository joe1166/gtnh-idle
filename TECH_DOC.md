# GTNH Idle — 技术文档

> 本文档是项目架构索引。配表细节和 i18n 文档见 [配置指南.md](./配置指南.md)。
> 最后更新：2026-04-30

---

## 目录

1. [项目概览](#1-项目概览)
2. [目录结构](#2-目录结构)
3. [CSV 工具链](#3-csv-工具链)
4. [Pinia Stores](#4-pinia-stores)
5. [游戏主循环](#5-游戏主循环)
6. [Vue 组件结构](#6-vue-组件结构)
7. [关键设计约定](#7-关键设计约定)
8. [配表详情](#8-配表详情)

---

## 1. 项目概览

**技术栈**：Vue 3 (`<script setup lang="ts">`) + Pinia + TypeScript + Vite

**玩法循环**：探索采集 → 冶炼/加工 → 制作机器 → 发电 → 自动化生产 → 推进章节

**核心数值**：`EU/s` 体现电力成长，`batteryCurrentEU` 管理充放电

**存档**：`localStorage`，key `gtnh_idle_save`，版本 `4.0.0`

---

## 2. 目录结构

```
tables/                    # 配置源（CSV，用表格编辑器编辑）
schemas/                   # CSV→JSON schema + csv-manifest.json
  csv-manifest.json        # 新增表只需改这里

src/
├── config/               # 由 CSV 生成（勿手动编辑）
│   └── locales/          # zh.json / en.json
├── data/
│   ├── types.ts          # 所有接口定义
│   ├── db.ts             # 统一数据访问
│   ├── conditions.ts      # 中心化条件系统（evaluateCondition）
│   ├── panelConfig.ts    # 面板定义（复用 Condition 类型）
│   └── i18n.ts           # t() 运行时
├── stores/               # Pinia store
│   ├── gameStore.ts     # 时间 / 存档
│   ├── inventoryStore.ts # 仓库
│   ├── powerStore.ts    # 电池
│   ├── machineStore.ts  # 机器+发电机实例
│   ├── taskStore.ts     # 任务系统
│   ├── progressionStore.ts  # 章节进度
│   ├── techStore.ts     # 科技系统
│   ├── worldStore.ts    # 探索系统
│   └── toolStore.ts     # 工具系统（采集能力属性）
├── composables/
│   ├── useGameLoop.ts    # initGame + tick 循环
│   ├── useSaveLoad.ts    # 存档/读档
│   ├── useOfflineProgress.ts  # 100x 离线模拟
│   ├── useToast.ts       # Toast 通知
│   └── useDevConsole.ts  # 开发者后台
└── components/
    ├── layout/           # TopBar / SideNav
    ├── modals/          # OfflineModal / SaveModal / StatsModal / DevConsole
    └── panels/          # WorldPanel / SteamPanel / PowerPanel / MiningPanel /
                         # CraftingPanel / InventoryPanel / ChapterPanel / TechPanel
```

---

## 3. CSV 工具链

```bash
npm run csv              # 一键导出全部 12 张表
npm run csv -- <表名>     # 导出单表（前缀匹配）
```

**新增配置表**：在 `schemas/csv-manifest.json` 加一行，运行 `npm run csv`。

**所有游戏内容必须通过 CSV 配置，禁止在 `src/config/` 下手动编辑 JSON。**

详情见 [配置指南.md](./配置指南.md)。

---

## 4. Pinia Stores

### 依赖关系

```
machineStore ──toggleMachine──→ powerStore（充/放电）
                              ↓
inventoryStore（物品消耗/产出）←taskStore ← progressionStore
                                                   ↑
                                             taskStore
techStore（独立，只依赖 inventoryStore）
gameStore（独立，只管时间）
worldStore（独立，探索系统）
```

### 各 Store 职责

| Store | 职责 |
|---|---|
| `gameStore` | 游戏时间、tick 计数、存档时间 |
| `inventoryStore` | 物品数量、上限、累计产出 |
| `powerStore` | 电池充放电、EU 读写 |
| `machineStore` | 机器/发电机实例、配方进度、超频、`giveFreeMachine()` 开局赠送 |
| `taskStore` | 任务条件判断、完成追踪 |
| `progressionStore` | 章节进度（委托 taskStore） |
| `techStore` | 科技研究、特性解锁 |
| `worldStore` | 探索节点、timed 节点状态、隐藏节点揭露 |
| `toolStore` | 工具等级、采集能力属性、升级逻辑 |

### worldStore 特别说明

timed 节点 **不自动给资源**：`tick()` 只设 `done: true`，用户点领取才给资源（防止中途退出丢进度）。

### toolStore 特别说明

工具提供**采集能力属性**（如 `wood_ability`、`mining_ability`），节点有**所需能力门槛**。能力不足时无法采集，超出门槛越多产出越多。详见配置指南.md 工具系统章节。

### conditions.ts 特别说明

中心化条件系统，所有"是否满足条件"统一调用 `evaluateCondition(cond)`：
- `chapter` / `task` / `tech` / `resource` / `tool`
- 面板解锁、机器显示、配方可见性等均调用此函数
- 新增条件类型只需改 `conditions.ts` 一处

---

## 5. 游戏主循环

### 初始化（onMounted）

```
initGame() → load() → start() → (离线>10s? simulate() → OfflineModal)
```

### tick 执行顺序（每秒）

```
1. gameStore.tick()          时间+1
2. worldStore.tick()          timed 节点进度更新
3. machineStore.tick()        发电（+EU）+ 消耗（-EU）+ 配方推进
4. powerStore.tick()          过载检测
5. progressionStore.tick()    任务检查 + 章节解锁
6. (每30秒) save()            自动存档
```

### 存档格式

```json
{ "version": "4.0.0", "savedAt": 1748000000000,
  "state": { "game": {}, "inventory": {}, "power": {},
             "machines": {}, "progression": {}, "tasks": {},
             "tech": {}, "world": {}, "tools": {} } }
```

v3.0.0 → v4.0.0：新增工具系统字段，`tools` 由 store 默认状态初始化。

---

## 6. Vue 组件结构

### App.vue

- `activePanel`（ref）：当前激活面板 id
- `defaultPanelId`：由 `PANEL_DEFS` 取 `order` 最小者动态决定（不硬编码 `'world'`）
- `isPanelFullBleed`：`activePanel === 'world'` 时面板区域无内边距

### SideNav.vue

- 计算 `navItems`（可见面板列表，两遍 pass 解决 `panel` 类型条件循环依赖）
- `v-model` 双向绑定 `activePanel`
- 条件判断走 `evaluateCondition`（来自 `conditions.ts`）

### 中心化条件系统（conditions.ts）

- 唯一入口 `evaluateCondition(cond: Condition | undefined | null): boolean`
- 支持类型：`chapter` / `task` / `tech` / `resource` / `tool`
- 新增条件类型只需改一处，所有使用方自动生效

### 合成面板（CraftingPanel.vue）

- 配方匹配：`machine.role === recipe.requiredRole && machine.tier >= recipe.requiredLevel`
- `availableMachineDefs` 过滤：category=1 且 `evaluateCondition({ type: 'chapter', para })` 通过
- `canBuild` 条件：`maxCount > 0` && `当前实例数 < maxCount` && 背包负担得起
- 开局赠送：hand_assembly（徒手组装）由 `machineStore.giveFreeMachine()` 赠送，不消耗材料
- 默认电压：新建机器时设为 `min(machine.maxVoltage, globalMaxVoltage)`

### 探索面板（WorldPanel.vue）

- 三层配置：dimensions → biomes → biome_nodes
- 隐藏节点：SVG `<polygon>` 热区（无 tooltip），点击揭露按钮
- timed 节点：倒计时进度条（`nowMs` 500ms 更新保证响应式）

---

## 7. 关键设计约定

1. **静态数据不进 store**：`db.ts` 统一访问配置，store 只存运行时状态
2. **发电机是机器**：共用 `machineStore`，通过 `category: 2` 区分
3. **所有用户可见文字走 `t()` i18n**：禁止硬编码字符串
4. **所有游戏内容走 CSV 配置**：禁止在 `src/config/` 手动编辑 JSON
5. **数字格式化**：`fmt()`（`1000→1k, 1e6→1M`）
6. **存档版本管理**：当前 `4.0.0`，`migrate()` 处理版本迁移
7. **timed 节点不自动给资源**：用户主动领取，确保退出安全
8. **条件判断统一入口**：`evaluateCondition()`（`conditions.ts`），所有解锁条件统一用 `showCondType + showCondPara`，各表共用
9. **配方匹配由 role + tier 决定**：机器 tier >= 配方 requiredLevel 即可执行，无需列举配方 ID

---

## 8. 配表详情

全部配置表字段说明 → [配置指南.md](./配置指南.md)

**快速索引**：

| 配置内容 | CSV 文件 | 生成 JSON |
|---|---|---|
| 资源 | `resources.csv` | `config/resources.json` |
| 配方 | `recipes.csv` | `config/recipes.json` |
| 机器/发电机 | `machines.csv` | `config/machines.json` |
| 任务 | `tasks.csv` | `config/tasks.json` |
| 章节 | `chapters.csv` | `config/chapters.json` |
| 科技 | `techs.csv` | `config/techs.json` |
| 科技树 | `tech_trees.csv` | `config/tech_trees.json` |
| 面板 | `panels.csv` | `config/panels.json` |
| 维度 | `dimensions.csv` | `config/dimensions.json` |
| 群系 | `biomes.csv` | `config/biomes.json` |
| 探索节点 | `biome_nodes.csv` | `config/biome_nodes.json` |
| 本地化 | `locale.csv` | `config/locales/zh.json + en.json` |
