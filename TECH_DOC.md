# GTNH Idle — 技术文档

> 本文档供 AI 和开发者查阅，记录完整架构、配置规范与扩展方法。
> 最后更新：2026-04-01

---

## 目录

1. [项目概览](#1-项目概览)
2. [目录结构](#2-目录结构)
3. [配置系统（JSON 配置表）](#3-配置系统json-配置表)
4. [本地化系统（i18n）](#4-本地化系统i18n)
5. [数据访问层（db.ts）](#5-数据访问层dbts)
6. [Pinia Stores](#6-pinia-stores)
7. [游戏主循环](#7-游戏主循环)
8. [Vue 组件结构](#8-vue-组件结构)
9. [关键机制说明](#9-关键机制说明)
10. [扩展指南：如何添加新内容](#10-扩展指南如何添加新内容)
11. [已知设计约定](#11-已知设计约定)

---

## 1. 项目概览

**技术栈**：Vue 3 (Composition API `<script setup lang="ts">`) + Pinia + TypeScript + Vite

**核心玩法循环**：
```
采集矿石 → 冶炼/加工 → 制作机器/发电机 → 发电 → 为机器供电 → 自动化生产 → 完成章节目标
```

**核心数值**：`EU/s`（欧陆/秒）是最核心的成长数值，体现电压时代的进展。

**离线进度**：以 100 倍速快速模拟（最多 12 小时），恢复后展示离线报告。

---

## 2. 目录结构

```
src/
├── config/                     # ★ 所有游戏配置表（用户可编辑）
│   ├── resources.json          # 资源定义
│   ├── recipes.json            # 配方定义
│   ├── machines.json           # 机器定义（含发电机，category 字段区分）
│   ├── tasks.json              # 任务定义（独立表，供章节/科技等引用）
│   ├── chapters.json           # 章节定义
│   ├── techs.json              # 科技树定义
│   └── locales/
│       ├── zh.json             # 中文本地化
│       └── en.json             # 英文本地化
│
├── data/
│   ├── types.ts                # 所有接口定义（不要随意改）
│   ├── db.ts                   # 配置数据统一入口（不要随意改）
│   └── i18n.ts                 # 多语言运行时（不要随意改）
│
├── stores/
│   ├── gameStore.ts            # 游戏时间、离线模拟状态
│   ├── inventoryStore.ts       # 玩家仓库（物品数量/上限/总产出统计）
│   ├── powerStore.ts           # 电力系统（电池充放电）
│   ├── machineStore.ts         # 机器实例（含发电机，配方进度、超频）
│   ├── taskStore.ts            # 任务系统（独立，供章节/科技等引用）
│   ├── progressionStore.ts     # 章节进度（委托 taskStore 检查任务）
│   └── techStore.ts            # 科技研究进度
│
├── composables/
│   ├── useGameLoop.ts          # 主循环（initGame + tick + start）
│   ├── useSaveLoad.ts          # 存档/读档（localStorage，当前版本 2.0.0）
│   ├── useOfflineProgress.ts   # 100倍速离线模拟
│   └── useToast.ts             # Toast 通知系统
│
├── components/
│   ├── layout/
│   │   ├── TopBar.vue          # 顶栏（标题、EU/s 显示、电池、存档按钮）
│   │   └── SideNav.vue         # 左侧导航栏
│   ├── modals/
│   │   ├── OfflineModal.vue    # 离线进度报告弹窗
│   │   └── SaveModal.vue       # 存档管理弹窗
│   ├── panels/
│   │   ├── PowerPanel.vue      # 电力面板（发电机建造/管理）
│   │   ├── MiningPanel.vue     # 采集面板
│   │   ├── CraftingPanel.vue   # 合成面板
│   │   ├── InventoryPanel.vue  # 仓库面板
│   │   ├── ChapterPanel.vue    # 任务/章节面板
│   │   └── TechPanel.vue       # 科技树面板
│   └── ToastContainer.vue      # Toast 容器
│
├── utils/
│   └── format.ts               # 数字格式化（fmt: 1000→1k，1e6→1M）
│
├── styles/
│   └── global.css              # 全局 CSS 变量（主题色、字体）
│
└── App.vue                     # 根组件（面板切换、生命周期）
```

---

## 3. 配置系统（JSON 配置表）

所有游戏内容均由 `src/config/` 下的 JSON 文件驱动，**用户无需修改任何 TypeScript 代码**即可调整游戏数值、添加内容。

### 3.1 resources.json — 资源定义

```jsonc
// 格式：ResourceDef[]
[
  {
    "id": "iron_ore",          // 全局唯一 ID，在其他配置中通过此 ID 引用
    "locKey": "res.iron_ore",  // 本地化键，在 zh.json/en.json 中配置显示名称
    "defaultCap": 1000,        // 玩家仓库上限（整数）
    "category": "ore",         // 分类：ore / ingot / component / circuit / fuel
    "unlockedByChapter": 1     // 哪章解锁（目前仅用于初始化，实际解锁由 chapters.json 控制）
  }
]
```

**category 取值**（影响仓库面板分组）：
| 值 | 含义 |
|---|---|
| `ore` | 矿石 |
| `ingot` | 金属锭 |
| `component` | 零件 |
| `circuit` | 电路 |
| `fuel` | 燃料 |

---

### 3.2 recipes.json — 配方定义

```jsonc
[
  {
    "id": "smelt_iron",               // 唯一 ID
    "locKey": "recipe.smelt_iron",    // 本地化键
    "inputs": [                        // 原材料（空数组 = 无需材料，如采矿配方）
      { "resourceId": "iron_ore", "amount": 2 }
    ],
    "outputs": [                       // 产出物品
      { "resourceId": "iron_ingot", "amount": 1 }
    ],
    "durationSec": 10,                // 完成一次配方需要的时间（秒）
    "euPerSec": 8,                    // 每秒 EU 消耗（0 = 不耗电）
    "requiredRole": "furnace",        // 必须与 MachineDef.role 匹配
    "unlockedByChapter": 1
  }
]
```

**特殊规则**：
- `requiredRole: "miner"` 的配方为矿机专用，在采集面板显示为自动化选项
- 矿机配方 `inputs` 应为 `[]`（无需材料），EU 消耗从配方 `euPerSec` 字段读取

---

### 3.3 machines.json — 机器与发电机定义

**发电机和普通机器统一存放在此表**，通过 `category` 字段区分：

```jsonc
[
  // category=1：处理型机器
  {
    "id": "furnace",
    "locKey": "machine.furnace",
    "category": 1,                                   // 1=处理机器，2=发电机
    "role": "furnace",                               // 配方匹配用，发电机留空
    "euPerSec": 8,                                   // 机器基础EU消耗（实际由配方覆盖）
    "allowedRecipeIds": ["smelt_iron", "smelt_copper", "smelt_tin"],
    "buildCost": [
      { "resourceId": "iron_plate", "amount": 4 }
    ],
    "unlockedByChapter": 1
  },
  // category=2：发电机
  {
    "id": "steam_boiler",
    "locKey": "machine.steam_boiler",
    "category": 2,
    "role": "",                                      // 发电机无 role
    "euPerSec": 16,                                  // 基础发电量
    "allowedRecipeIds": [],
    "fuelResourceId": "coal",                        // 燃料资源 ID
    "fuelPerSec": 0.5,                               // 每秒燃料消耗（支持小数）
    "buildCost": [
      { "resourceId": "iron_plate", "amount": 8 },
      { "resourceId": "wrench", "amount": 1 }
    ],
    "unlockedByChapter": 1
  }
]
```

**category 取值**：
| 值 | 含义 |
|---|---|
| `1` | 处理机器（消耗 EU，执行配方） |
| `2` | 发电机（消耗燃料，产出 EU） |

**注意**：
- `role` 对于发电机留空字符串，处理机器填写与配方 `requiredRole` 对应的值
- `allowedRecipeIds` 只有 1 个时，建造后自动选中（矿机场景）
- 发电机超频公式：发电量 × overclock，燃料消耗 × overclock

---

### 3.4 tasks.json — 任务定义

任务是独立的配置表，可被章节、科技等任意系统引用。

```jsonc
// 格式：TaskDef[]
[
  {
    "id": 1,                          // 数字 ID（全局唯一）
    "locKey": "task.build_furnace",   // 本地化键（任务描述）
    "type": 1,                        // 任务类型（见下表）
    "para1": "furnace",               // 参数1（含义由 type 决定）
    "para2": "1",                     // 参数2（可选）
    "rewardResourceId": "",           // 完成奖励资源 ID（可选）
    "rewardAmount": 0                 // 奖励数量（可选）
  }
]
```

**task.type 取值**（对应 `TaskType` const enum）：
| type | 含义 | para1 | para2 |
|---|---|---|---|
| `1` | BUILD_MACHINE：建造 N 台某机器 | 机器 defId（含发电机） | 数量 |
| `2` | PRODUCE_TOTAL：某物品累计产出 N 个 | 资源 ID | 目标数量 |
| `3` | HAVE_ITEM：当前拥有 N 个某物品 | 资源 ID | 目标数量 |
| `4` | REACH_EU_PER_SEC：发电量达到 N EU/s | 目标 EU/s | — |

---

### 3.5 chapters.json — 章节定义

```jsonc
[
  {
    "id": 1,
    "locKey": "chapter.1.name",
    "descLocKey": "chapter.1.desc",
    "unlockCondition": {              // 解锁下一章的条件
      "type": "eu_per_sec",          // 条件类型（见下表）
      "value": 32
    },
    "taskIds": [1, 2, 3, 4, 5],      // 引用 tasks.json 中的任务 ID 列表
    "unlocks": {                      // 本章初始解锁的内容
      "resourceIds": ["coal", "iron_ore"],
      "recipeIds": ["smelt_iron", "mine_coal"],
      "machineDefIds": ["furnace", "steam_boiler"]
    }
  }
]
```

**unlockCondition.type 取值**：
| 类型 | 说明 | 额外字段 |
|---|---|---|
| `eu_per_sec` | 总发电量达到 N EU/s | `value` |
| `item_crafted` | 某物品总产出达到 N | `resourceId`, `value` |
| `manual` | 不自动解锁（保留） | — |

---

### 3.6 techs.json — 科技树定义

```jsonc
[
  {
    "id": "machine_overclock",
    "locKey": "tech.machine_overclock.name",
    "descLocKey": "tech.machine_overclock.desc",
    "cost": [
      { "resourceId": "iron_plate", "amount": 16 },
      { "resourceId": "basic_circuit", "amount": 2 }
    ],
    "prerequisites": ["basic_automation"],
    "unlocks": {
      "features": ["overclock"],    // 解锁特性标志（见下表）
      "machineDefIds": [],          // 额外解锁的机器/发电机
      "recipeIds": []               // 额外解锁的配方
    }
  }
]
```

**features 特性标志**（由 `techStore.hasFeature()` 检查）：
| 标志 | 效果 |
|---|---|
| `overclock` | 解锁机器/发电机的超频按钮（CraftingPanel、PowerPanel） |
| `auto_miner_eu` | 矿机运行时消耗 EU（预留） |
| `parallel_2x` | 预留特性，并行处理（功能待实现） |

---

## 4. 本地化系统（i18n）

### 权威来源与文件位置

- **权威来源**：`tables/locale.csv`
- **运行时读取**：`src/config/locales/*.json`（由 CSV 生成，勿手改）

```
tables/locale.csv
schemas/locale.schema.json
src/config/locales/
├── zh.json    # 中文（主语言，回退语言）
└── en.json    # 英文
```

### 使用方式

```typescript
import { t } from '../../data/i18n'

t('btn.start')       // → '▶ 开启'
t('res.iron_ore')    // → '铁矿石'
```

### 本地化键命名规范

| 前缀 | 用途 | 示例 |
|---|---|---|
| `panel.*` | 面板标题和提示 | `panel.power.title` |
| `nav.*` | 导航栏标签 | `nav.power` |
| `btn.*` | 按钮文本 | `btn.start`, `btn.stop` |
| `status.*` | 机器/系统状态 | `status.running`, `status.no_power` |
| `res.<id>` | 资源显示名称 | `res.iron_ore` → 铁矿石 |
| `recipe.<id>` | 配方显示名称 | `recipe.smelt_iron` → 冶炼铁锭 |
| `machine.<id>` | 机器/发电机显示名称 | `machine.furnace` → 冶炼炉 |
| `chapter.<n>.name` | 章节名称 | `chapter.1.name` |
| `chapter.<n>.desc` | 章节描述 | `chapter.1.desc` |
| `task.<id>` | 任务描述 | `task.build_furnace` |
| `tech.<id>.name` | 科技名称 | `tech.machine_overclock.name` |
| `tech.<id>.desc` | 科技描述 | `tech.machine_overclock.desc` |
| `feature.<id>` | 科技特性显示名 | `feature.overclock` → 超频 |
| `category.<c>` | 资源分类名 | `category.ore` → 矿石 |

### 工作流（新增 key / 查缺）

本项目以 **dev 运行时自动补 key** 为主：任何地方只要调用 `t(key)`，如果 key 不存在（最终会回退并显示 key），dev 环境会自动把该 key 写入 `tables/locale.csv`（zh/en 留空，方便你在表格里补翻译）。

1. `npm run dev` 启动开发服务器
2. 在游戏里把相关界面/功能“走一遍”，触发 `t()` 调用
3. 打开 `tables/locale.csv`，把空的翻译补齐（可只补 zh 或先留空）
4. 生成运行时 JSON：
   - `npm run csv:locale`

可选开关（默认关闭）：如果你希望“**发生回退也记录**”（比如 en 缺失但 zh 有），在本机 `.env.local` 里加：

```
VITE_I18N_REPORT_MISSING_TRANSLATIONS=1
```

### 添加新语言

1. 在 `tables/locale.csv` 新增语言列（如 `ja`）并填充翻译（可逐步补齐）
2. 在 `schemas/locale.schema.json` 的 `outputs` 增加该语言输出路径（如 `src/config/locales/ja.json`）
3. 运行 `npm run csv:locale` 生成 JSON
4. 在 `src/data/i18n.ts` import 并注册到 `LOCALE_DATA`，并把语言代码加入 `SUPPORTED_LOCALES`

---

## 5. 数据访问层（db.ts）

所有配置数据通过 `db` 对象统一访问，**stores 和组件禁止直接 import JSON 文件**。

```typescript
import { db } from '../data/db'

// 获取整张表
db.table('resources')                    // → ResourceDef[]

// 按 ID 查单条
db.get('machines', 'furnace')            // → MachineDef | undefined

// 按条件过滤
db.filter('machines', m => m.category === 2)  // → 所有发电机定义

// 获取本地化名称
db.name('resources', 'iron_ore')         // → '铁矿石'（自动调用 t(locKey)）
db.desc('techs', 'machine_overclock')    // → '允许机器以2倍速运行...'
```

**支持的表名**：`resources` | `recipes` | `machines` | `tasks` | `chapters` | `techs`

**注意**：`db` 内部有索引缓存（按 id 哈希），多次调用 `db.get()` 不会重复遍历数组。

---

## 6. Pinia Stores

### 依赖关系图

```
inventoryStore ←── machineStore ←──────────────┐
       ↑               ↑                       │
powerStore ←── (addEU / consumeEU)            │
                                               │
taskStore ←── progressionStore ────────────────┘
                    ↑ reads from power/inventory/machine

techStore (独立，只依赖 inventoryStore)
gameStore (独立，只管时间)
```

---

### 6.1 inventoryStore

**职责**：管理玩家仓库（物品数量、上限、累计产出）

```typescript
// State
items: Record<string, number>          // { iron_ore: 105, coal: 170, ... }
caps: Record<string, number>           // { iron_ore: 1000, ... }
totalProduced: Record<string, number>  // 累计产出，用于 PRODUCE_TOTAL 任务

// 关键 Actions
initResource(id, cap)           // 初始化资源槽（游戏启动时调用）
addItem(id, amount)             // 增加物品（不超上限，更新 totalProduced）
spend(cost: ResourceAmount[])   // 扣除物品（失败返回 false）
canAfford(cost)                 // 检查是否足够（不扣除）
getAmount(id)                   // 获取当前数量

// 存档：完整 $state 序列化
```

---

### 6.2 powerStore

**职责**：管理电池充放电，提供 EU 存取接口

```typescript
// State
batteryCurrentEU: number          // 当前电池电量
batteryCapacityEU: number         // 电池容量（默认 100 EU）
overloadSeconds: number           // 连续过载秒数（预留爆炸判定）

// 关键 Getters
totalGenPerSec     // 委托 machineStore：所有运行发电机的 EU/s 总和
totalConsumePerSec // 委托 machineStore：所有运行机器的 EU/s 总消耗
netPerSec          // totalGenPerSec - totalConsumePerSec
batteryPercent     // 0-100

// 关键 Actions
addEU(amount)             // 充电（不超上限）
consumeEU(amount): boolean // 放电（余量不足返回 false，不扣除）

// tick() 逻辑（每秒）：
// 仅做过载检测（发电/消耗已由 machineStore.tick() 完成）
```

**注意**：powerStore 不再持有发电机实例。发电机建造、开关、超频均由 `machineStore` 管理。

---

### 6.3 machineStore

**职责**：统一管理所有机器实例，包括处理机器（category=1）和发电机（category=2）

```typescript
// State
instances: MachineInstance[]

// MachineInstance 结构
{
  instanceId: string
  defId: string
  isRunning: boolean
  selectedRecipeId: string | null   // 发电机此字段为 null
  progressSec: number               // 当前配方已运行秒数（发电机不用）
  status: MachineStatus             // 'running'|'paused'|'no_recipe'|'no_material'|'no_power'|'no_fuel'
  overclock: number                 // 1=正常, 2=2倍速
}

// 关键 Getters
totalGenPerSec     // 所有运行中发电机的 EU/s 总和（含超频）
totalConsumePerSec // 所有运行中处理机器的 EU/s 总消耗

// 关键 Actions
buildMachine(defId)             // 消耗材料，创建机器/发电机实例
toggleMachine(instanceId)       // 开/关（关机时重置进度）
setRecipe(instanceId, recipeId) // 换配方（重置进度）
setOverclock(instanceId, level) // 设置超频（需 overclock 特性）

// tick() 逻辑（每秒）：
// Phase 1 — 发电机（category=2）：
//   isRunning=false → status='paused', skip
//   燃料不足 → status='no_fuel', skip（isRunning 保持 true，等燃料恢复）
//   消耗燃料 → powerStore.addEU(euPerSec × overclock)
// Phase 2 — 处理机器（category=1）：
//   isRunning=false → status='paused', skip
//   无配方 → status='no_recipe', skip
//   powerStore.consumeEU() 失败 → status='no_power', skip
//   progressSec==0 → 检查材料，不足 → refund EU，status='no_material'
//   progressSec += overclock
//   progressSec >= durationSec → 产出，progressSec=0
```

**超频公式**：
- 发电机：发电量 × overclock，燃料消耗 × overclock
- 处理机器：速度 × overclock，EU 消耗 × overclock²

---

### 6.4 taskStore

**职责**：独立任务系统，负责任务条件判断、完成状态追踪、奖励发放。可被章节、科技等任意系统调用。

```typescript
// State
completedTaskIds: number[]   // 已完成任务 ID 列表

// 关键 Getters
isComplete(taskId): boolean  // 某任务是否已完成

// 关键 Actions
checkTasks(taskIds: number[])           // 批量检查并完成满足条件的任务（幂等）
evalTask(task: TaskDef): boolean        // 判断单个任务条件是否满足
completeTask(taskId): void              // 强制完成（发放奖励，幂等）
getTasksWithStatus(taskIds): TaskWithStatus[]  // 获取带完成状态的任务列表（供 UI）
```

**evalTask 判断逻辑（按 task.type）**：
- `BUILD_MACHINE(1)`：`machineStore.instances.filter(m => m.defId === para1).length >= Number(para2)`
- `PRODUCE_TOTAL(2)`：`inventoryStore.totalProduced[para1] >= Number(para2)`
- `HAVE_ITEM(3)`：`inventoryStore.getAmount(para1) >= Number(para2)`
- `REACH_EU_PER_SEC(4)`：`powerStore.totalGenPerSec >= Number(para1)`

---

### 6.5 progressionStore

**职责**：章节进度管理，委托 taskStore 检查任务

```typescript
// State
currentChapterId: number       // 当前章节 ID
chapterUnlocked: number[]      // 已解锁章节 ID 列表

// tick() 逻辑（每秒）：
// 1. useTaskStore().checkTasks(chapter.taskIds)  ← 委托任务检查
// 2. 检查章节解锁条件 → 满足 → unlockNextChapter()
```

**注意**：任务完成状态存放在 `taskStore`，不在 `progressionStore`。

---

### 6.6 techStore

**职责**：科技研究进度

```typescript
// State
researchedTechIds: string[]

// 关键 Getters
isResearched(techId)          // 是否已研究
hasFeature(featureId)         // 是否拥有某特性（如 'overclock'）
canResearch(techId)           // 前置满足且未研究
allTechsWithStatus            // 带状态的科技列表（供 TechPanel 渲染）

// Actions
research(techId)  // 即时扣除材料并解锁科技，返回 boolean
```

---

### 6.7 gameStore

**职责**：全局游戏时间状态

```typescript
// State
totalPlaytimeSec: number
tickCount: number
lastSaveTime: number          // Unix 时间戳（毫秒）
isSimulatingOffline: boolean  // 离线模拟进行中标志
offlineSimProgress: number    // 0-100，离线模拟进度百分比

// tick() 逻辑：totalPlaytimeSec++, tickCount++
// secondsSinceLastSave getter：用于自动存档判断
```

---

## 7. 游戏主循环

### 初始化流程（onMounted）

```
1. initGame()
   ├── 读取 chapters[1].unlocks.resourceIds
   ├── inventoryStore.initResource() 初始化所有资源槽
   └── 若无存档 → 发放初始物资（coal×200, iron_ore×100 等）

2. load()          ← 从 localStorage 恢复存档（含迁移逻辑）
3. start()         ← 启动 setInterval(tick, 1000)
4. (if 有存档 && 离线 > 10s) simulate() → 显示 OfflineModal
```

### tick 执行顺序（每秒）

```
1. gameStore.tick()          — 游戏时间 +1
2. machineStore.tick()       — Phase1: 发电机产EU；Phase2: 处理机器消耗EU+推进配方
3. powerStore.tick()         — 过载检测
4. progressionStore.tick()   — 委托 taskStore 检查任务；检查章节解锁条件
5. (每30秒) save()           — 自动存档
```

**重要**：machineStore.tick() 同时处理发电（产出 EU）和消耗（processEU），因此 powerStore.tick() 在其后执行仅做过载检测。

### 存档格式（localStorage key: `gtnh_idle_save`，版本 2.0.0）

```json
{
  "version": "2.0.0",
  "savedAt": 1748000000000,
  "state": {
    "game":        { "totalPlaytimeSec": 600, "lastSaveTime": 1748000000000 },
    "inventory":   { "items": {}, "caps": {}, "totalProduced": {} },
    "power":       { "batteryCurrentEU": 80, "batteryCapacityEU": 100, "overloadSeconds": 0 },
    "machines":    { "instances": [] },
    "progression": { "currentChapterId": 1, "chapterUnlocked": [1] },
    "tasks":       { "completedTaskIds": [] },
    "tech":        { "researchedTechIds": [] }
  }
}
```

**迁移**：v1.0.0 → v2.0.0 自动迁移（`useSaveLoad.ts/migrate()`）：
- 将 `power.generatorInstances` 移入 `machines.instances`
- 重置 `tasks.completedTaskIds`（旧字符串 ID 与新数字 ID 不兼容）

---

## 8. Vue 组件结构

### 面板导航（SideNav → App.vue）

`SideNav` 通过 `v-model` 双向绑定 `activePanel`（字符串），App.vue 根据值显示对应面板：

| activePanel 值 | 面板组件 |
|---|---|
| `power` | PowerPanel |
| `mining` | MiningPanel |
| `crafting` | CraftingPanel |
| `inventory` | InventoryPanel |
| `chapter` | ChapterPanel |
| `tech` | TechPanel |

### 机器/发电机开关按钮设计

```
停止状态：  [▶ 开启]
运行状态：  ● 运行中   [⚡ 超频]  [■ 停止]     （超频按钮仅 hasFeature('overclock') 时显示）
超频状态：  ⚡ 超频中 ×2  [▼ 降频]  [■ 停止]
```

`PowerPanel.vue` 管理发电机实例行，`CraftingPanel.vue` 管理处理机器实例行，开关/超频均调用 `machineStore` 方法。

### PowerPanel.vue 关键逻辑

```typescript
// 发电机定义列表（category=2）
const availableGeneratorDefs = db.filter('machines', m => m.category === 2)

// 已建造的发电机实例
const generatorInstances = machineStore.instances.filter(m =>
  db.get('machines', m.defId)?.category === 2
)

// 操作均调用 machineStore
machineStore.buildMachine(defId)
machineStore.toggleMachine(instanceId)
machineStore.setOverclock(instanceId, level)
```

### ChapterPanel.vue 关键逻辑

```typescript
// 任务列表通过 taskStore 获取
const currentTasks = taskStore.getTasksWithStatus(chapter.taskIds)

// 进度显示按 task.type 分支
switch (task.type) {
  case TaskType.HAVE_ITEM:      return inventoryStore.getAmount(task.para1)
  case TaskType.PRODUCE_TOTAL:  return inventoryStore.totalProduced[task.para1]
  case TaskType.BUILD_MACHINE:  return machineStore.instances.filter(m => m.defId === task.para1).length
  case TaskType.REACH_EU_PER_SEC: return powerStore.totalGenPerSec
}
```

### CSS 变量（src/styles/global.css）

```css
--bg-primary: #1a1a1a       /* 全局背景 */
--bg-panel: #242424         /* 面板/卡片背景 */
--border-color: #333        /* 边框 */
--text-primary: #e0e0e0     /* 主文字 */
--text-secondary: #888      /* 次要文字 */
--accent-green: #4CAF50     /* 强调绿（可用、运行中） */
--accent-red: #f44336       /* 强调红（不足、错误） */
--accent-yellow: #FFC107    /* 强调黄（进度、提示） */
--accent-orange: #FF9800    /* 强调橙（超频） */
```

---

## 9. 关键机制说明

### 9.1 超频（Overclock）

需要研究 `machine_overclock` 科技才能在 UI 上显示超频按钮。

**处理机器超频**（machineStore Phase 2）：
- `progressSec += overclock`（每 tick 推进更快）
- EU 消耗 = `recipe.euPerSec × overclock²`
- overclock=2 时：2倍速，4倍EU消耗

**发电机超频**（machineStore Phase 1）：
- 发电量 = `def.euPerSec × overclock`
- 燃料消耗 = `def.fuelPerSec × overclock`
- overclock=2 时：2倍发电，2倍燃料

### 9.2 矿机（Miner）

矿机是特殊角色机器（`role: "miner"`，`category: 1`）：
- 在 `MiningPanel.vue` 中展示，通过"部署矿机"按钮建造
- 每个资源对应一种矿机（iron_miner → mine_iron_ore）
- 建造后自动选中唯一配方（`allowedRecipeIds.length === 1` 时自动赋值）
- 矿机配方 `inputs: []`，无需材料，只消耗 EU

### 9.3 离线进度（useOfflineProgress）

- 最大模拟时长：12 小时（43200 秒）
- 模拟倍速：100 倍（每次 `tick()` 代表 100 秒）
- 每模拟 1000 秒让出浏览器控制权（`await new Promise(resolve => setTimeout(resolve, 0))`）
- 结果：`OfflineReport { offlineSec, produced: Record<string, number> }`

### 9.4 自动存档

- 每 **30 秒**自动存档（`gameStore.secondsSinceLastSave >= 30`）
- 离线模拟期间暂停自动存档（`isSimulatingOffline = true`）
- 组件卸载（页面关闭）时强制存档一次

### 9.5 Toast 通知

```typescript
import { useToast } from '../../composables/useToast'
const { show } = useToast()

show('已建造冶炼炉')                           // 默认绿色，1.8s 消失
show('材料不足！', 'var(--accent-red)')        // 自定义颜色
```

---

## 10. 扩展指南：如何添加新内容

### 添加新资源

1. `src/config/resources.json` 添加条目
2. **在 `tables/locale.csv` 添加/补齐**：`"res.<id>": "显示名称"`
   - 建议先跑 `npm run locale:audit` 自动补 key，再在 CSV 里填中文/英文
3. 如需在第一章可用，在 `chapters.json` 的 `chapter[0].unlocks.resourceIds` 中添加 ID
4. 运行 `npm run csv:locale` 生成 `src/config/locales/*.json`

### 添加新配方

1. `src/config/recipes.json` 添加条目
2. **在 `tables/locale.csv` 添加/补齐**：`"recipe.<id>": "配方名称"`
   - 建议先跑 `npm run locale:audit` 自动补 key，再在 CSV 里填中文/英文
3. 确保 `requiredRole` 与某机器的 `role` 匹配
4. 在对应机器的 `allowedRecipeIds` 中添加该配方 ID
5. 运行 `npm run csv:locale` 生成 `src/config/locales/*.json`

### 添加新处理机器

1. `src/config/machines.json` 添加条目（`category: 1`，填写 `role`）
2. **在 `tables/locale.csv` 添加/补齐**：`"machine.<id>": "机器名称"`
   - 建议先跑 `npm run locale:audit` 自动补 key，再在 CSV 里填中文/英文
3. 若需在某章节解锁，在 `chapters.json` 的 `unlocks.machineDefIds` 中添加
4. 运行 `npm run csv:locale` 生成 `src/config/locales/*.json`

### 添加新发电机

1. `src/config/machines.json` 添加条目（`category: 2`，`role: ""`，填写 `fuelResourceId`、`fuelPerSec`）
2. **在 `tables/locale.csv` 添加/补齐**：`"machine.<id>": "发电机名称"`
   - 建议先跑 `npm run locale:audit` 自动补 key，再在 CSV 里填中文/英文
3. 若需在某章节解锁，在 `chapters.json` 的 `unlocks.machineDefIds` 中添加
4. 运行 `npm run csv:locale` 生成 `src/config/locales/*.json`

### 添加新任务

1. `src/config/tasks.json` 添加条目（`id` 为全局唯一整数）
2. **在 `tables/locale.csv` 添加/补齐**：`"task.<id>": "任务描述"`
   - 建议先跑 `npm run locale:audit` 自动补 key，再在 CSV 里填中文/英文
3. 在需要引用该任务的 `chapters.json` 条目的 `taskIds` 数组中添加任务 ID
4. 运行 `npm run csv:locale` 生成 `src/config/locales/*.json`

### 添加新章节

1. `src/config/chapters.json` 添加章节对象（`id` 递增）
2. `src/config/tasks.json` 添加该章节需要的任务
3. **在 `tables/locale.csv` 添加/补齐**：章节名称/描述及任务描述对应的 key
   - 建议先跑 `npm run locale:audit` 自动补 key，再在 CSV 里填中文/英文
4. 上一章的 `unlockCondition` 会触发自动切换
5. 运行 `npm run csv:locale` 生成 `src/config/locales/*.json`

### 添加新科技

1. `src/config/techs.json` 添加科技对象
2. **在 `tables/locale.csv` 添加/补齐**：`tech.<id>.name` 和 `tech.<id>.desc`
   - 建议先跑 `npm run locale:audit` 自动补 key，再在 CSV 里填中文/英文
3. 若科技解锁新特性，在需要判断该特性的组件中调用 `techStore.hasFeature('xxx')`
4. 运行 `npm run csv:locale` 生成 `src/config/locales/*.json`

### 添加新语言

1. 在 `tables/locale.csv` 新增语言列（如 `ja`）并填充翻译（可逐步补齐）
2. 在 `schemas/locale.schema.json` 的 `outputs` 增加该语言输出路径（如 `src/config/locales/ja.json`）
3. 运行 `npm run csv:locale` 生成 JSON
4. 在 `src/data/i18n.ts` import 并注册到 `LOCALE_DATA`，并把语言代码加入 `SUPPORTED_LOCALES`

---

## 11. 已知设计约定

1. **静态数据不进 store**：所有配置数据通过 `db.ts` 访问，store 只存运行时状态（实例列表、数量等）

2. **发电机是机器**：发电机与处理机器共用 `machineStore` 和 `MachineInstance` 结构，通过 `category` 字段区分。没有独立的 generatorStore 或 generators.json。

3. **任务系统独立**：`taskStore` 不依赖 `progressionStore`，未来科技解锁等系统可直接调用 `taskStore.checkTasks()`，无需通过章节。

4. **机器 EU 消耗来自配方**：`MachineDef.euPerSec` 用于信息展示，实际 EU 消耗来自 `RecipeDef.euPerSec × overclock²`

5. **Vue 响应式**：所有 Pinia store 的 state 直接修改（`machine.isRunning = true`），Pinia 保证响应式更新

6. **数字格式化**：所有面向玩家的数字通过 `fmt()` 格式化（`1000→1k, 1e6→1M, 1e9→1G, 1e12→1T`）

7. **重置进度时机**：关机（toggleMachine）、换配方（setRecipe）时均会 `progressSec = 0`

8. **燃料不足不自动关机**：发电机燃料不足时，该 tick 跳过发电，但 `isRunning` 保持 true，等待燃料补充后自动恢复

9. **存档版本管理**：当前版本 `2.0.0`，`useSaveLoad.ts` 中 `migrate()` 函数处理版本迁移
