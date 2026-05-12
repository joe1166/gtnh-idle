# Pinia Stores

---

## Store 依赖关系

```
machineStore ──toggleMachine──→ powerStore（充/放电）
                              ↓
inventoryStore（物品消耗/产出）←taskStore ← progressionStore
techStore（独立，只依赖 inventoryStore）
gameStore（独立，只管时间）
worldStore（独立，探索系统）
toolStore（独立，工具升级）
mineStore（独立，矿洞小游戏）
exploreStore（独立，遗迹探索小游戏）
```

---

## 各 Store 职责

| Store              | state                                                                                                           | 关键 action                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `gameStore`        | `tick`, `savedAt`, `secondsSinceLastSave`                                                                       | `tick()` 时间+1                                                                                                                                 |
| `inventoryStore`   | `items`, `caps`, `totalProduced`                                                                                | `addItem()`, `spend()`, `canAfford()`, `everHad()`                                                                                              |
| `powerStore`       | `batteryCurrentEU`, `batteryCapacityEU`, `globalMaxVoltage`                                                     | `consumeEU()`, `addEU()`, `charge()`, `tick()` 过载检测                                                                                         |
| `steamStore`       | `steamMb`, `steamCapacityMb`                                                                                    | `addSteam()`, `consumeSteam()`, `beginTick()`, `tick()`                                                                                         |
| `machineStore`     | `instances[]`                                                                                                   | `buildMachine()`, `giveFreeMachine()`, `setRecipe()`, `setVoltage()`, `toggleMachine()`, `syncCounters()`, `removeInvalidInstances()`, `tick()` |
| `taskStore`        | `completedIds[]`                                                                                                | `checkAndComplete()`, `isComplete()`                                                                                                            |
| `progressionStore` | `currentChapterId`, `era`                                                                                       | `tick()` 任务检查+章节解锁；`advanceToNextChapter()` 同步推进游戏时代                                                                           |
| `techStore`        | `researchedIds[]`                                                                                               | `research()`, `isResearched()`, `hasFeature()`                                                                                                  |
| `worldStore`       | `nodes{}`, `timedNodeStates{}`                                                                                  | `clickNode()`, `startTimedNode()`, `claimTimedNode()`, `revealNode()`, `tick()`                                                                 |
| `toolStore`        | `levels{}`                                                                                                      | `upgradeTool()`, `getAbility()`, `getNextUpgradeCost()`, `getLevelDef()`                                                                        |
| `mineStore`        | `grid`, `stamina`, `entered`, `prospectorCooldown`, `sessionLoot`, `exitDialogOpen`                             | `enter()`, `digCell()`, `openExitDialog()`, `confirmExit()`, `useProspector()`, `tick()`                                                        |
| `exploreStore`     | `mapId`, `rooms[]`, `connections[]`, `cellRoomMap`, `currentRoomId`, `entered`, `mode`, `hp`, `sessionLoot`, `exitDialogOpen` | `enter(mapId)`, `moveToRoom()`, `lootRoom()`, `advanceEvent()`, `chooseEventOption()`, `startCombat()`, `tick()`                                                     |

---

## inventoryStore

```typescript
state: {
  items: Record<string, number>,           // resourceId → 当前数量
  caps: Record<string, number>,            // resourceId → 上限
  totalProduced: Record<string, number>,  // resourceId → 累计产出（用于 resource_ever）
}

getters: {
  getAmount: (id) => items[id] ?? 0
  getCap: (id) => caps[id] ?? 0
  everHad: (id) => (totalProduced[id] ?? 0) > 0
}

actions: {
  initResource(id, defaultCap)        // 初始化槽位
  canAfford(costs: Cost[])            // 能否负担
  spend(costs: Cost[]): boolean      // 消耗，成功返回true
  addItem(resourceId, amount)         // 增加，自动clamp到上限
  setCap(resourceId, cap)             // 设置上限
  spend(costs)                        // 扣除材料（不退还）
}
```

---

## powerStore

```typescript
state: {
  batteryCurrentEU: number     // 当前电量
  batteryCapacityEU: number    // 电池容量
  globalMaxVoltage: number    // 全局最大电压等级（所有运行中发电机的最高电压）
}

getters: {
  batteryPercent: batteryCurrentEU / batteryCapacityEU
  hasPower: batteryCurrentEU > 0
}

actions: {
  consumeEU(amount): boolean  // 消耗 EU，返回是否成功（电量不足返回false）
  addEU(amount)               // 增加 EU
  charge()                   // 从发电机充电
  tick()                     // 每秒过载检测
}
```

---

## steamStore

```typescript
state: {
  steamMb: number           // 当前蒸汽量（mb）
  steamCapacityMb: number  // 容量上限
}

actions: {
  addSteam(mb)              // 增加蒸汽
  consumeSteam(mb): boolean // 消耗蒸汽，返回是否成功
  beginTick()               // tick 开始时重置蒸汽池（Phase 1 发生器会往里注入）
  tick()                    // 每秒蒸汽消耗（目前主要来自 Phase 3 ULV 配方）
}
```

---

## machineStore

```typescript
state: {
  instances: MachineInstance[]
}

interface MachineInstance {
  instanceId: string
  defId: string
  isRunning: boolean
  selectedRecipeId: string | null
  progressSec: number        // 当前进度秒数
  status: MachineStatus
  selectedVoltage: number    // 玩家选择的电压等级（-1=无发电机时）
}

type MachineStatus =
  | 'running' | 'paused' | 'no_recipe'
  | 'no_material' | 'no_power' | 'no_steam'
```

### tick 三个阶段

1. **Phase 1 — 蒸汽发生器**（category=3）：消耗燃料，产出蒸汽到 steamStore
2. **Phase 2 — EU 发电机**（category=2）：消耗燃料，产出 EU 到 powerStore
3. **Phase 3 — 合成机器**（category=1）：分三种模式
   - `instantMode=1` 的机器：**完全跳过**，由 UI 层 handleCraft 直接处理
   - 普通机器：消耗能源+材料，推进 progressSec，满后产出

### instanceId 规范与 ID 生成

`instanceId` 格式为 `${defId}_${counter}`，例如 `hand_assembly_1`、`plate_press_1`。每个 `defId` 有独立计数器，避免全局序号在 HMR 重置后与 localStorage 中的旧 ID 冲突。

**启动时同步**：`load()` 后调用 `syncCounters(instances)` 从已恢复实例中提取最大序号，使新生成 ID 永远不与旧数据重叠。

**旧存档清理**：`load()` 后调用 `removeInvalidInstances()` 过滤配置中已不存在的机器实例（如删除了某机器类型）。

### 关键方法

```typescript
buildMachine(defId): boolean       // 消耗材料建造，返回是否成功
giveFreeMachine(defId)             // 开局赠送机器（不消耗材料）
setRecipe(instanceId, recipeId)    // 设置配方
setVoltage(instanceId, voltage)    // 设置电压
toggleMachine(instanceId)          // 开启/停止
tick()                             // 每秒推进（三个阶段）
```

---

## toolStore

```typescript
state: {
  levels: Record<string, number>  // toolType → 等级
  // stone_axe: 0（待制作）、1、2
  // stone_pickaxe: 0、1、2
  // prospector: 1、2、3（由 showCond 控制显示）
}

getters: {
  getLevelDef(toolType): ToolDef | null   // 当前等级的完整定义
  getAbility(abilityId): number          // 某 ability 的当前总能力值
  getNextUpgradeCost(toolType): Cost[]   // 下一级升级消耗
  isMaxLevel(toolType): boolean
  getNextLevelDef(toolType): ToolDef | null
}

actions: {
  upgradeTool(toolType): boolean  // 消耗材料升级，返回是否成功
}
```

### 工具类型与 ability 对应

| toolType      | abilityId          | 说明                       |
| ------------- | ------------------ | -------------------------- |
| stone_axe     | wood_ability       | 伐木能力                   |
| stone_pickaxe | mining_ability     | 采矿能力                   |
| prospector    | prospector_ability | 探矿能力（显示在矿洞界面） |

---

## worldStore

```typescript
state: {
  currentDimensionId: string
  currentBiomeId: string
  discoveredBiomeIds: string[]
  lastClickTime: Record<string, number>   // 节点 ID → 最后点击时间（ms，防连点）
  timedNodes: Record<string, TimedNodeState>
  revealedNodeIds: string[]
}

interface TimedNodeState {
  startAt: number   // 开始时间戳（ms）
  endAt: number     // 结束时间戳（ms）
  done: boolean     // true = 计时完毕，等待玩家点击领取
}

getters: {
  exploreFoodRequired: number   // 当前维度探索所需食物点数
  explorePool: { biomeId: string; weight: number }[]
  currentNodes: BiomeNodeDef[]  // 当前群系全部节点
  visibleNodes: BiomeNodeDef[]  // 当前群系可见节点（含已揭露隐藏节点）
  hiddenNodes: BiomeNodeDef[]   // 当前群系未揭露的隐藏节点
}

actions: {
  clickNode(nodeId): Record<string, number>     // 即时节点，返回获得字典（空=不可采）
  startTimedNode(nodeId): boolean               // 启动倒计时，mine 类型先消耗 entryCost
  claimTimedNode(nodeId): Record<string, number>  // 领取：timed 给资源；mine 进矿洞
  revealNode(nodeId): void                      // 揭露隐藏节点
  switchBiome(biomeId): boolean                 // 切换到已发现群系
  exploreBiome(foodCommit: Record<string, number>): { success: boolean; biomeId: string; isNew: boolean }
  tick(): void                                  // 每秒：更新 timed 节点 done 状态
}
```

---

## mineStore

```typescript
state: {
  caveId: string          // 当前洞穴 ID（引用 mine_caves.id）
  grid: MineCell[]        // row-major 一维数组，length = rows × cols
  rows: number            // 由 cave config 决定（plains_cave = 20）
  cols: number            // 由 cave config 决定（plains_cave = 20）
  stamina: number
  maxStamina: number      // 由 cave config 决定（plains_cave = 50）
  entered: boolean        // 是否正处于矿洞界面
  seed: number            // LCG 伪随机种子（每次进入 = Date.now()）
  prospectorResult: ProspectorResult | null
  prospectorCooldown: number   // 秒，tick 递减
  sessionLoot: Record<string, number>  // 本局收获（resourceId → 数量）
  exitDialogOpen: boolean      // 是否显示结算弹窗
}

interface MineCell {
  blockId: string
  dug: boolean
  veinId: string | null   // 同一矿脉共享 ID（探矿仪统计用）
  reachable: boolean       // 是否可从入口到达（废弃通道初始 false）
}

getters: {
  getCell(row, col): MineCell | null
  isAdjacent(row, col): boolean   // 检查四邻中是否有 dug && reachable 的格
  canDig(blockId): boolean        // toolStore.mining_ability >= requiredMiningAbility
  dugCells: { row, col }[]        // 所有 dug && reachable 格（探矿仪用）
}

actions: {
  enter(caveId)           // 从 cave config 读参数，生成新地图，重置体力/loot/弹窗
  exit()                  // 直接退出（不经弹窗）
  openExitDialog()        // 打开结算弹窗
  cancelExitDialog()      // 关闭弹窗但不离开
  confirmExit()           // 确认离开（entered = false）
  generateMap()           // 配置驱动：分层填充底色 + 独立 roll 矿脉 + 废弃通道
  digCell(row, col)       // 挖掘：验证相邻/工具/体力 → 挖开 → BFS传播可达性 → 记录loot
  useStaminaItem(resourceId, restoreAmount)  // 消耗道具回体
  useProspector()         // 探矿仪扫描（消耗 1 体力，设 cooldown=3）
  tick()                  // 每秒：prospectorCooldown--
}
```

详见 [MINE_SYSTEM.md](./MINE_SYSTEM.md)。

---

## exploreStore

```typescript
state: {
  mapId: string            // 当前地图 ID（引用 explore_maps.id）
  rows: number             // 地图行数
  cols: number             // 地图列数
  rooms: ExploreRoom[]     // 所有房间实例
  connections: ExploreConnection[]  // 房间间的连接（门）
  cellRoomMap: Record<string, string>  // "row,col" → instanceId
  currentRoomId: string | null  // 玩家当前所在房间
  entered: boolean         // 是否正处于遗迹探索界面
  seed: number             // 地图生成种子（Date.now()）
  visitedRoomIds: string[] // 已访问的房间 instanceId 列表
  sessionLoot: Record<string, number>  // 本局收获
  exitDialogOpen: boolean  // 是否显示离开确认弹窗
}

getters: {
  currentRoom: ExploreRoom | undefined     // 当前所在房间
  adjacentRoomIds: string[]                // 与当前房间相连的相邻房间 ID 列表
  hasLoot: boolean
}

actions: {
  enter(mapId)         // 读地图配置，设 seed=Date.now()，generateMap()，entered=true
  generateMap()        // 四阶段算法（Phase0固定房间→Phase1连通图→Phase2合并→Phase3内容分配）
  moveToRoom(instanceId)  // 移动到相邻房间，标记 visited
  lootRoom(instanceId)    // 搜刮当前房间，给予奖励，标记 looted
  openExitDialog()
  cancelExitDialog()
  confirmExit()        // 将 sessionLoot 给予背包，entered=false
  tick()               // 战斗模式下按秒推进自动战斗
}
```

### 地图生成算法

| 阶段    | 说明                                                                                        |
| ------- | ------------------------------------------------------------------------------------------- |
| Phase 0 | 解析 `mapDef.fixedRooms`，将固定房间格标记为 `locked`，记录门朝向约束                       |
| Phase 1 | 随机 Prim 最小生成树 + 额外环路边（基于 `cycleEdgeRate`），跳过 void 格和门约束不满足的连接 |
| Phase 2 | Union-Find 合并相邻格（locked 格跳过），生成有机形状的房间                                  |
| Phase 3 | 优先分配 `requiredRoomIds`，剩余按权重随机分配 `generatableRoomIds`                         |

**数据表**：`explore_maps.csv`（地图配置）、`explore_rooms.csv`（房间类型库）
**节点类型**：`biome_nodes.csv` 中 `type=explore` 的节点，点击后直接调用 `exploreStore.enter(exploreMapId)`

---

### exploreStore（二阶段增量）

- 房间配置语义拆分为：`layoutType`（布局生成）+ `type`（玩法类型）。
- 新增玩法类型：`normal | combat | event`。
- 新增运行模式：`mode = 'explore' | 'event' | 'combat' | 'result'`。
- `tick()` 不再是预留；当 `mode='combat'` 时按秒推进自动战斗。
- `mode !== 'explore'` 时锁定地图移动。
- 玩家战败后强制退出遗迹并清空本局 `sessionLoot`。
- 新增配置表：`explore_enemies.csv`、`explore_events.csv`。

详情见 `EXPLORE_SYSTEM.md`。

---

## progressionStore

```typescript
state: {
  currentChapterId: number
  chapterCompleted: boolean
  era: Era  // 'stone' | 'steam' | 'lv'（只前进，持久化）
}

tick()                    // 每秒：任务检查 + 章节解锁判定
advanceToNextChapter()    // 点击"进入下一章"时调用；
                          // 若当前章节配置了 advancesEra，先推进游戏时代，再切到下一章
isChapterComplete()       // 当前章节所有任务是否全部完成
```

### 游戏时代（Era）系统

`era` 是全局进度里程碑，与章节配置解耦，持久化到存档。只前进不后退。

```typescript
// src/data/types.ts
type Era = 'stone' | 'steam' | 'lv'
const ERA_ORDER: Era[] = ['stone', 'steam', 'lv']
```

| 时代     | 值        | 含义                          |
| -------- | --------- | ----------------------------- |
| 石器时代 | `'stone'` | 初始状态，无蒸汽，无电力      |
| 蒸汽时代 | `'steam'` | 已建造蒸汽锅炉并完成第1章     |
| LV 时代  | `'lv'`    | 已进入低压电力时代，完成第2章 |

**推进方式**：`chapters.csv` 每行可配置 `advancesEra` 字段，玩家点击"进入下一章"按钮时自动执行：

```typescript
// advanceToNextChapter() 内部逻辑
if (chapter.advancesEra && ERA_ORDER.indexOf(next) > ERA_ORDER.indexOf(this.era)) {
  this.era = next  // 只前进，不允许倒退
}
```

**使用方式**：

```typescript
import { useProgressionStore } from '../../stores/progressionStore'
const progressionStore = useProgressionStore()

// 判断当前时代
progressionStore.era === 'steam'  // 是否蒸汽时代
progressionStore.era === 'lv'     // 是否进入电力时代

// 扩展新时代：在 types.ts 的 Era 联合类型末尾追加，ERA_ORDER 末尾追加，
// 在对应章节的 chapters.csv 的 advancesEra 字段填写新时代 ID
```

**已使用 era 的位置**：

| 组件/文件           | 用途                                                    |
| ------------------- | ------------------------------------------------------- |
| `TopBar.vue`        | `era==='steam'` 显示蒸汽产耗；`era==='lv'` 显示电力信息 |
| `CraftingPanel.vue` | `era==='lv'` 时才显示机器电压选择器                     |

---

## techStore

```typescript
state: {
  researchedIds: string[]
}

actions: {
  research(techId): boolean     // 消耗材料研究，返回是否成功
  isResearched(techId): boolean
  hasFeature(feature: string): boolean  // 是否解锁某功能特性
}
```

---

## taskStore

```typescript
state: {
  completedIds: string[]   // 任务 ID 为 string（如 "build_furnace"）
}

actions: {
  checkTasks(taskIds: string[])     // 检查指定任务是否完成
  completeTask(taskId: string)      // 标记任务完成
  isComplete(taskId: string): boolean
  getTasksWithStatus(taskIds: string[]): TaskWithStatus[]
}
```
