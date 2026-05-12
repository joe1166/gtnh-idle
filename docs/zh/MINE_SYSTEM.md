# 矿洞探索系统

> 独立全屏小游戏。通过探索面板的 `mine` 类型节点进入，不属于面板系统（不在 panels.csv 中）。

---

## 架构定位

矿洞是**完全独立的全屏界面**，覆盖整个网页（包括 TopBar 和 SideNav）。

```
App.vue
  ├── 主界面（TopBar + SideNav + 面板区）
  └── <MineOverlay v-if="mineStore.entered" />  ← z-index:1000，覆盖一切
```

与主程序的唯一通信：

| 方向 | 触发 | 内容 |
|------|------|------|
| 进入 | worldStore 处理 mine 节点完成 → `mineStore.enter(caveId)` | 读 cave config、生成地图、重置体力 |
| 产出 | 挖掘时 | `inventoryStore.addItem()` |
| 退出 | 玩家确认离开弹窗 | `mineStore.confirmExit()` → `entered = false` |

---

## 进入流程

### 世界节点配置

在 `biome_nodes.csv` 中配置 `type=mine` 的节点，需要 `caveId` 字段绑定洞穴：

```
plains_mine_entrance, mine.node.entrance, mine.node.enter_btn, mine,
  , 0, 30, 50, 20, false, , mining_ability, 1, cobblestone:5, plains_cave
```

- `durationSec`：准备时间（玩家等待倒计时）
- `entryCost`：进入消耗（格式 `resourceId:amount|...`，由 worldStore 解析）
- `caveId`：绑定的洞穴 ID（引用 mine_caves.id），完成后传给 `mineStore.enter()`
- `resourceId` / `amount`：留空，mine 节点不给资源奖励

### worldStore 处理

```typescript
// startTimedNode() — mine 类型：消耗 entryCost，启动倒计时
if (def.type === 'mine') {
  const costs = parseEntryCost(def.entryCost)
  if (!inv.canAfford(costs)) return false
  inv.spend(costs)
  // 启动倒计时（复用 timed 逻辑）
}

// claimTimedNode() — mine 类型完成：直接进入矿洞
if (def.type === 'mine') {
  useMineStore().enter(node.caveId ?? '')
  return -1  // 不给资源
}
```

---

## 洞穴配置（mine_caves.csv）

每个洞穴独立定义其几何参数、矿脉列表和地质分层。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 洞穴唯一 ID |
| `locKey` | string | 本地化 key |
| `rows` | number | 网格行数（总深度） |
| `cols` | number | 网格列数（每行格子数） |
| `maxStamina` | number | 进入时体力上限 |
| `tunnelCountMin/Max` | number | 废弃通道数量范围 |
| `veinIds` | string[] | 该洞穴可出现的矿脉 ID 列表（管道分隔） |
| `strata` | 对象数组 | 深度分层（见下文），管道分隔，格式 `depthMin:depthMax:blockId` |

**strata 重叠过渡**：相邻层的深度范围允许重叠，重叠区域自动成为过渡带。例如：

```
0.00:0.15:dirt|0.10:0.60:stone|0.50:1.00:deep_stone
```

dirt 到 0.15，stone 从 0.10 开始，两者在 10%~15% 深度重叠，该区间内按位置概率渐变。

---

## 矿脉配置（mine_veins.csv）

矿脉类型独立定义，与洞穴解耦（可被多个洞穴引用）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 矿脉类型 ID |
| `blockId` | string | 矿脉填充的方块（引用 mine_blocks.id） |
| `depthMin/Max` | number | 出现深度范围（0-1 比例） |
| `spawnRate` | number | 每行触发该矿脉的概率（各矿脉独立 roll，可同行多种） |
| `veinSizeMin/Max` | number | BFS 膨胀格数范围 |

当前配置（plains_cave 可用矿脉）：

| id | 方块 | 深度范围 | 概率 | 脉体大小 |
|----|------|---------|------|---------|
| coal_vein | coal_vein | 10%~80% | 20% | 3~5 格 |
| iron_vein | iron_vein | 15%~100% | 12% | 3~6 格 |
| copper_vein | copper_vein | 33%~100% | 12% | 3~6 格 |
| tin_vein | tin_vein | 50%~100% | 15% | 4~7 格 |

---

## 地图生成

### LCG 伪随机数生成器

```typescript
function makePRNG(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0xFFFFFFFF
  }
}
```

相同 seed 产生完全相同的地图。

### 生成步骤（配置驱动）

1. **读取配置**：从 `mine_caves` 读 caveDef（strata、veinIds），从 `mine_veins` 读各矿脉定义
2. **分层填充底色石头**：遍历每格，按 `row/rows` 找所在 strata 层，重叠区 LCG 概率渐变
3. **底部基岩过渡**：最后 5 行按深度概率覆盖基岩（见下文），覆盖 strata 结果；此步在矿脉生成前执行，基岩格不会再被矿脉覆盖
4. **起始格**：`(0, cols/2)` 设为 `dug=true, reachable=true`
5. **矿脉生成**：逐行遍历 cave 的 veinIds，在深度范围内各自独立 roll `spawnRate`，触发则 BFS 膨胀并替换底色石头；基岩格自动跳过
6. **废弃通道**：`tunnelCountMin~Max` 处横向预挖，`dug=true, reachable=false`

### 底部基岩过渡

最后 5 行强制向基岩过渡，越靠近底部概率越高：

| 距底距离 | 基岩概率 |
|---------|---------|
| 0（最后一行） | 100%（必然基岩） |
| 1 | 80% |
| 2 | 60% |
| 3 | 40% |
| 4 | 20% |

基岩格 `requiredMiningAbility=999`，`canDig()` 永远返回 false，不可挖掘。矿脉 BFS 遇到基岩格直接跳过，因此基岩区域无矿物生成。

### 深度分层过渡算法

```typescript
const matching = strata.filter(s => depthRatio >= s.depthMin && depthRatio < s.depthMax)
if (matching.length >= 2) {
  // 重叠过渡带：上层(upper) vs 下层(lower)
  const prob = (depthRatio - overlapStart) / (overlapEnd - overlapStart)
  // prob=0 → 取上层，prob=1 → 取下层
  blockId = rand() < prob ? lower.blockId : upper.blockId
}
```

---

## 可达性系统

### reachable 字段

`MineCell.reachable: boolean` 表示该格是否可从入口到达：

| 状态 | dug | reachable | 含义 |
|------|-----|-----------|------|
| 初始化 | false | false | 未挖的实心格 |
| 起始格 | true | true | 入口，可见 |
| 废弃通道（未连通） | true | false | 不可见、不可借用 |
| 废弃通道（已连通） | true | true | 玩家挖通后变为可见 |
| 玩家挖开 | true | true | 正常已挖格 |

`isAdjacent` 只认 `dug && reachable` 的邻格。`digCell()` 内 BFS 传播 reachability，打通废弃通道时自动连通。

---

## 可见性规则

```
① cell.dug && cell.reachable  → 黑色空洞（已挖）
② isAdjacent(row, col)        → 显示方块色（可挖或工具不足）
③ 其余                        → 纯黑 #000，完全不可见
```

**矿石格视觉**：`category === 'ore'` 的方块使用 `radial-gradient`：底色取当前深度 strata 对应石头的颜色，上面叠加 2~3 个矿石色彩色圆点。效果为"石头背景 + 矿石圆点"，而非纯色块。

| CSS 类 | 触发条件 | 视觉效果 |
|--------|---------|---------|
| `--dug` | dug && reachable | 黑底 #0a0a0a |
| `--invisible` | 非相邻 && !mineReveal | 纯黑 #000 |
| `--diggable` | 相邻 && canDig | 方块色 + hover 亮化 |
| `--locked` | 相邻 && !canDig | 方块色 + cursor:not-allowed |
| `--prospector-ping` | 探矿仪最近目标 | 黄边闪烁动画 |
| `--revealed` | 非相邻 && mineReveal（开发模式） | 方块色 + opacity:0.55，与真实可见格区分 |

---

## 深度 HUD

深度标记以**绝对定位浮层**的形式叠于网格上，不占用独立列宽。每 10 行一个标签（10m、20m…），半透明黑底白字，`pointer-events: none` 不阻挡点击。

实现位置：`MineGrid.vue` 中 `position: relative` 容器内，`v-for depthMilestones`。

---

## 体力系统

| 行为 | 体力变化 |
|------|---------|
| 进入矿洞 | 重置为 `maxStamina`（由 cave config 决定） |
| 挖掘一格 | -1 |
| 探矿仪扫描 | -1 |
| 使用道具（粗绳） | +10 |

体力归零时，`digCell()` 自动设 `exitDialogOpen = true`，弹出结算弹窗。

---

## 探矿仪

由 `toolStore.levels['prospector']` 控制等级（1/2/3），等级 0 时功能不显示。

```typescript
// 扫描半径 = [0, 3, 5, 8][level]（曼哈顿距离）
// 以最深已挖格为中心，统计未挖 ore 类方块
// 返回：nearestBlockId, abundance, nearestRow, nearestCol
// 消耗：stamina-=1, cooldown=3s
```

---

## 结算弹窗

| 触发 | 方式 |
|------|------|
| 手动离开 | 顶栏"退出矿洞"→ `openExitDialog()` |
| 体力耗尽 | `digCell()` 内自动设 `exitDialogOpen=true` |

弹窗展示 `sessionLoot`，玩家确认后 `confirmExit()` 设 `entered=false`。

---

## UI 布局

```
┌──────────────────────────────── fixed inset:0, z-index:1000 ───┐
│ [退出]  体力 ████░░ 42/50  [扫描] 最近: 铁矿 中等              │  ← 顶栏
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│         MineGrid（20列×20行，CSS Grid）                         │  ← 可滚动
│         黑=已挖  圆点=矿石  纯色=石头/泥土  纯黑=不可见         │
│  ─────────────────── 10m ─────────────────────                  │  ← HUD 浮层
│                                                                 │
│  ─────────────────── 20m ─────────────────────                  │
├─────────────────────────────────────────────────────────────────┤
│ 道具：[粗绳 +10 (3)]                                            │  ← 底栏
└─────────────────────────────────────────────────────────────────┘
```

---

## 方块配置（mine_blocks.csv）

| id | category | color | requiredMiningAbility | 说明 |
|----|----------|-------|----------------------|------|
| dirt | soft | #8B6914 | 0 | 表层泥土 |
| stone | hard | #808080 | 1 | 普通石头 |
| coal_vein | ore | #2A2A2A | 1 | 煤矿矿脉 |
| iron_vein | ore | #C8A882 | 2 | 铁矿矿脉 |
| copper_vein | ore | #B87333 | 2 | 铜矿矿脉 |
| tin_vein | ore | #C0C0C0 | 2 | 锡矿矿脉 |
| deep_stone | hard | #4A4A4A | 3 | 深层坚硬岩石 |
| gold_vein | ore | #D4AF37 | 3 | 金矿矿脉 |
| abandoned_tunnel | special | #3A2A1A | 0 | 废弃通道（预挖空格） |
| **bedrock** | hard | #1A1018 | **999** | **底部基岩，不可挖掘，无矿物生成** |

> `requiredMiningAbility=999` 是约定的"永远不可挖"哨兵值，玩家工具等级永远无法达到。

---

## 文件索引

| 文件 | 职责 |
|------|------|
| `src/stores/mineStore.ts` | 全部状态与逻辑（地图生成、挖掘、探矿仪、弹窗） |
| `src/components/mine/MineOverlay.vue` | 全屏容器（顶栏 + 网格 + 底栏 + 弹窗） |
| `src/components/mine/MineGrid.vue` | 网格渲染、格子状态计算、深度 HUD 浮层、点击交互 |
| `src/components/mine/MineProspector.vue` | 探矿仪 UI（扫描按钮 + 结果展示） |
| `tables/mine_blocks.csv` | 方块类型配置 |
| `tables/mine_veins.csv` | 矿脉类型配置（含矿、概率、深度、大小） |
| `tables/mine_caves.csv` | 洞穴配置（尺寸、体力、矿脉列表、分层） |
| `schemas/mine_blocks.schema.json` | mine_blocks CSV schema |
| `schemas/mine_veins.schema.json` | mine_veins CSV schema |
| `schemas/mine_caves.schema.json` | mine_caves CSV schema |
