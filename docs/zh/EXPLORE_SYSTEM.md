# 遗迹探索小游戏（Explore System）

---

## 技术部分

### 入口与主循环

- 入口：`biome_nodes.csv` 中 `type=explore` 节点，点击后调用 `exploreStore.enter(exploreMapId)`。
- 主循环：`useGameLoop.tick()` 在 `exploreStore.entered===true` 时调用 `exploreStore.tick(1000)`。

### 核心状态机

`exploreStore.mode`：

- `explore`：正常探索/移动/搜刮
- `event`：剧情节点推进与选项分支
- `combat`：自动战斗推进
- `result`：战败结算态（强制退出）

入房后由 `enterCurrentRoomContext()` 决定模式：

1. `type=event` 且未完成 -> 进入 `event`
2. `type=combat` 且未完成 -> 进入 `combat`
3. 否则 -> `explore`

### 自动战斗（v1）

- 进入战斗房自动触发。
- 敌人由 `enemyPool + enemyCountMin/max` 采样生成。
- 先手按 `speed` 判定，伤害公式：`max(1, atk - def)`。
- 敌全灭：发放奖励到 `sessionLoot`，标记房间战斗完成。
- 我方 `hp<=0`：`handleDefeat()`，清空 `sessionLoot` 并退出遗迹。

### 剧情链（v1）

- 节点单表：`explore_events.csv`
- 无选项节点：
- 有 `autoNextId` -> 点击继续推进
- `isTerminal=true` -> 结束事件
- 有选项节点：点击后立即结算 `rewardId/hpDelta` 并跳转 `nextId`。

### UI 约束

- 左侧：角色/HP/本局收获。
- 中间：地图（迷雾 + 门洞 + 连通房形态）。
- 右侧：仅当前房间上下文面板（探索/剧情/战斗三态），不支持选中其他房间预览。

---

## 策划配置

### `explore_maps.csv`

定义地图网格、连通参数、入口、固定房锚点与必出/可生房间池。

金字塔当前关键配置：

- `entryPos=8:4`
- 固定法老墓室顶部居中（`burial_chamber:0:3`，房间形状 3 格宽）

### `explore_rooms.csv`

字段语义（当前版）：

- `layoutType`: `fixed | generatable`（只控制布局）
- `type`: `normal | combat | event`（只控制玩法）
- `eventStartNodeId`
- `enemyPool`
- `enemyCountMin` / `enemyCountMax`
- `rewardId` / `descLocKey`

### `explore_enemies.csv`

敌人数值与掉落：

- `hp`, `attack`, `defense`, `speed`
- `rewardId`

### `explore_events.csv`

剧情节点链：

- `textLocKey`, `autoNextId`, `isTerminal`
- 选项 A/B/C：`TextLocKey + NextId + RewardId + HpDelta`

---

## 验收要点（当前实现）

1. 法老墓室固定在金字塔顶端居中，且为剧情房。
2. 新增战斗房入房自动开战，战斗中不可移动。
3. 右侧面板仅展示当前房间上下文（探索/剧情/战斗）。
4. 战败会清空本局收获并强制退出遗迹。
5. 所有怪物/剧情内容均来自配置表而非硬编码。

