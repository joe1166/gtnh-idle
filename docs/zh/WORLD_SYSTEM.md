# 探索系统

---

## 技术部分

### 三层配置结构

```
dimensions（维度）
  └── biomes（群系）
        └── biome_nodes（探索节点）
```

- `worldStore` 管理所有 runtime 状态（节点状态、timed 倒计时、已发现群系）
- 静态配置通过 `db.table('biome_nodes')` 读取

### 节点类型

| type | 行为 |
|------|------|
| `click` | 点击即给资源，内置 10ms 防连点 |
| `timed` | 启动倒计时，`done=true` 后用户主动领取才给资源 |
| `mine` | 消耗 `entryCost` 材料 + 倒计时准备，完成后调 `mineStore.enter()`，进入全屏矿洞小游戏 |

**mine 节点与 timed 节点的区别**：mine 节点完成时不给资源，而是进入矿洞游戏界面；矿洞产出通过挖掘行为单独结算。详见 [MINE_SYSTEM.md](./MINE_SYSTEM.md)。

### 隐藏节点

- `hidden: true` 的节点初始不可见
- SVG `<polygon>` 热区定义在 `hitArea`（如 `"30,50 45,45 55,52"`）
- 热区无 tooltip，点击后调用 `revealNode()` 显示节点按钮

### 能力门槛

节点有 `requiredAbility` + `requiredAbilityValue`，`clickNode()` 时检查 `toolStore.getAbility()`，不足时返回空对象并显示提示。

能力超出门槛时，click 节点有额外 fixed 产出加成：
```
额外产出 = floor((ability - requiredAbilityValue) / 10)
```

### 奖励系统

节点产出通过 `rewardId` 引用 `rewards.csv` 中的奖励定义，由 `applyReward(rewardId, fixedBonus?)` 统一处理：
- `fixed`：保底固定产出（格式 `resourceId:amount|...`）
- `pool`：随机池（格式 `resourceId:amount:weight|...`），每次随机抽取一个条目

### worldStore 接口

```typescript
// 状态
state: {
  currentDimensionId: string
  currentBiomeId: string
  discoveredBiomeIds: string[]
  lastClickTime: Record<string, number>
  timedNodes: Record<string, TimedNodeState>
  revealedNodeIds: string[]
}

interface TimedNodeState {
  startAt: number   // 开始时间戳（ms）
  endAt: number     // 结束时间戳（ms）
  done: boolean     // true = 计时完毕，等待玩家点击领取
}

// getter
exploreFoodRequired: number   // 当前维度探索所需食物点数
explorePool: { biomeId: string; weight: number }[]

// actions
clickNode(nodeId): Record<string, number>    // 返回获得字典（空=能力不足/防连点）
startTimedNode(nodeId): boolean              // 启动倒计时（mine 类型先消耗 entryCost）
claimTimedNode(nodeId): Record<string, number>  // 领取：timed 给资源；mine 调 mineStore.enter()
revealNode(nodeId): void                     // 揭露隐藏节点
switchBiome(biomeId): boolean                // 切换到已发现的群系
exploreBiome(foodCommit: Record<string, number>): { success: boolean; biomeId: string; isNew: boolean }
tick(): void                                 // 每秒：更新 timed 节点 done 状态
```

---

## 策划部分

### 食物点数探索系统

探索新群系需要消耗食物点数，而非固定资源。

**点数计算**：`sum(食物数量 × foodPoints)`，每种食物的 `foodPoints` 值在 `resources.csv` 中定义（仅带 `food` 标签的资源有值）。

**当前 overworld 配置**：需要 30 食物点，参考：
- 苹果（foodPoints=5）：需 6 个
- 蘑菇（foodPoints=10）：需 3 个
- 仙人掌果（foodPoints=8）：需 4 个

**UI 流程（BiomeSwitchPanel.vue）**：
1. 探索区显示进度条（已选点数/所需点数）
2. 点击「选择食物」弹出选择器，列出背包中所有 food 标签资源
3. 每种食物可用 +/- 调整数量（受库存上限约束）
4. 「确认」后进度条更新，凑够点数后「探索」按钮变绿
5. 点击「探索」消耗食物，按权重随机抽取群系

### 群系发现与切换

- `discoveredBiomeIds`：已发现群系列表，初始仅含 `plains`
- 探索时按 `explorePool` 权重随机，新群系加入列表
- 可通过左侧群系列表一键切换到已发现的任意群系

### 当前群系列表（overworld）

| 群系 ID | 名称 | 特色资源 | explorePool 权重 |
|---------|------|---------|----------------|
| plains | 平原 | 原木、石头、苹果、铁矿 | 60 |
| forest | 森林 | 原木、铁矿、铜矿 | 50 |
| desert | 沙漠 | 仙人掌果、燧石 | 40 |
| swamp | 沼泽 | 原木、蘑菇、芦苇 | 35 |
| mountain | 山地 | 鹅卵石、煤炭、燧石（极低概率金矿） | 30 |

### biome_nodes.csv 配置说明

| 字段 | 说明 |
|------|------|
| `id` | 节点唯一 ID |
| `locKey` | 悬浮提示 i18n key |
| `actionLocKey` | 按钮文字 i18n key |
| `type` | `click`/`timed`/`mine` |
| `rewardId` | 引用 rewards.csv 的奖励 ID（mine 节点填 0/空） |
| `durationSec` | 倒计时秒数（仅 `timed`/`mine`） |
| `posX` / `posY` | 面板内位置（0-100，百分比） |
| `hidden` | `true`=隐藏节点，需热区点击揭示 |
| `hitArea` | SVG polygon 坐标（仅 `hidden=true`） |
| `requiredAbility` | `wood_ability` / `mining_ability` |
| `requiredAbilityValue` | 门槛值，能力 < 此值无法采集 |
| `entryCost` | mine 类型进入消耗（格式 `resourceId:amount\|...`） |
| `caveId` | mine 类型进入的矿洞 ID（引用 mine_caves.id） |

### timed 节点流程

1. 玩家点击"开始" → `startTimedNode()`，记录开始/结束时间戳
2. 每秒 `tick()` 检查是否到达 `endAt`，设 `done=true`
3. 玩家点击"领取" → `claimTimedNode()`，给资源并清除状态
4. 可重复触发

### 配置示例

| id | type | rewardId | durationSec | requiredAbility | entryCost | caveId |
|----|------|----------|-------------|-----------------|-----------|--------|
| oak_tree_1 | click | 1 | 0 | wood_ability≥1 | — | — |
| plains_mine_entrance | mine | 0 | 30 | mining_ability≥1 | cobblestone:5 | plains_cave |
| desert_ruins | timed | 16 | 60 | — | — | — |
| mountain_cave_entrance | mine | 0 | 30 | mining_ability≥2 | torch:20 | large_cave |
