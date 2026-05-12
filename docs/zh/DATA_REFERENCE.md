# 配表参考

> 所有配置表的字段说明。技术部分为开发者视角，策划部分为配置字段说明。
> UI 颜色与主题规范见 [THEMING.md](./THEMING.md)。

---

## 技术部分

### db.ts 数据访问

```typescript
import { db } from '../data/db'

db.table('resources')                 // → ResourceDef[]
db.get('machines', 'furnace')         // → 单条 | undefined
db.filter('machines', m => m.category === 2)  // → 数组
db.name('resources', 'iron_ore')      // → '铁矿石'（自动 t()）
db.toolsByType()                      // → { type: ToolDef[] }
```

**支持的表名**：resources | recipes | machines | tasks | chapters | techs | tech_trees | panels | dimensions | biomes | biome_nodes | tools | mine_blocks | mine_veins | mine_caves | rewards | explore_maps | explore_rooms | explore_enemies | explore_events

### types.ts 接口定义

所有接口定义在 `src/data/types.ts`，包括：
- `ResourceDef`、`MachineDef`、`RecipeDef`、`TaskDef`、`ChapterDef`
- `TechDef`、`DimensionDef`、`BiomeDef`、`BiomeNodeDef`、`PanelDef`
- `ToolDef`（含 `showCond` 字段）
- `Condition`（中心化条件类型）

### showCond 在 db.ts 中的处理

`buildShowCond()` 在 `db.ts` 加载时将 CSV 的 `showCondType + showCondPara` 合并为 `Condition | undefined`，所有配置对象直接带 `showCond` 字段，无需每次都解析字符串。

---

## 策划部分

### 资源表 — resources.csv

| 列名                | 说明                                               | 示例                                          |
| ------------------- | -------------------------------------------------- | --------------------------------------------- |
| `id`                | 唯一 ID，其他表通过此 ID 引用                      | `iron_ore`                                    |
| `locKey`            | 显示名称 i18n key                                  | `res.iron_ore`                                |
| `defaultCap`        | 仓库容量上限（整数）                               | `100`                                         |
| `category`          | 资源分类，格式 `大类.小类`                         | `raw.wood`、`mat.metal`、`prod.basic_circuit` |
| `tags`              | 标签列表（逗号分隔）                               | `ore,metal`、`organic`、`food`                |
| `unlockedByChapter` | 所属章节（暂时未用，由 showCond 控制显示）         | `1`                                           |
| `foodPoints`        | 食物点数，仅 `food` 标签资源填写，用于探索消耗计算 | `5`（苹果）、`8`（仙人掌果）、`10`（蘑菇）    |

**category 分类**：
- `raw.*` — 自然资源（raw.wood、raw.ore、raw.stone、raw.organic）
- `mat.*` — 工业材料（mat.metal）
- `prod.*` — 工业产品（prod.wrench、prod.basic_circuit）
- `misc.*` — 杂项

**tags 标签**：ore、metal、organic、flammable、craftable、food 等，用于筛选功能（如探索系统筛选 food 标签资源）。

---

### 配方表 — recipes.csv

| 列名            | 说明                                        | 示例                                          |
| --------------- | ------------------------------------------- | --------------------------------------------- |
| `id`            | 唯一 ID                                     | `smelt_iron`                                  |
| `locKey`        | 显示名称 i18n key                           | `recipe.smelt_iron`                           |
| `inputs`        | 格式 `resourceId:amount                     | resourceId:amount`，空=无需材料               | `iron_ore:2` |
| `outputs`       | 同 inputs                                   | `iron_ingot:1`                                |
| `durationSec`   | 完成时间（秒）                              | `10`                                          |
| `euPerSec`      | 每秒 EU 消耗（0=不耗电）                    | `8`                                           |
| `voltage`       | 所需最低电压等级（0=ULV/蒸汽，-1=无需能源） | `0`、`1`、`-1`                                |
| `overclock`     | 是否可超频（0=不可，1=有损，2=无损）        | `0`                                           |
| `requiredRole`  | 配方所需机器类型                            | `furnace`、`assembler`                        |
| `requiredLevel` | 配方所需最低机器等级                        | `1`                                           |
| `showCondType`  | 解锁条件类型（空=无条件）                   | `chapter`、`resource_ever`、`voltage`         |
| `showCondPara`  | 解锁条件参数                                | `1`、`weeds`、`1`（voltage=最低全局电压等级） |

**配方匹配规则**：`machine.role === recipe.requiredRole && machine.tier >= recipe.requiredLevel`

**voltage 说明**：
- `-1` = 无需能源，直接运行（如 make_coarse_rope）
- `0` = ULV/蒸汽驱动（消耗蒸汽 mb/s）
- `>=1` = EU 消耗，LV/MV/HV...

---

### 机器表 — machines.csv

**机器 ID 命名规范**：`{role}_{等级}`

- 同类型多级机器用 `role_tier` 格式，如 `plate_press_1`、`assembler_2`
- 单级机器直接用 role 或简化名，如 `furnace`、`hand_assembly`
- 显示名称（`locKey`）与 ID 解耦，可独立命名

| 列名             | 说明                                              | 示例                                  |
| ---------------- | ------------------------------------------------- | ------------------------------------- |
| `id`             | 唯一 ID，命名遵循 `role_tier` 规范                | `furnace`、`plate_press_1`            |
| `locKey`         | 显示名称 i18n key，与 ID 解耦                     | `machine.furnace`                     |
| `category`       | `1`=合成机器，`2`=EU发电机，`3`=蒸汽发生器        | `1`                                   |
| `role`           | 机器类型，用于匹配配方                            | `furnace`、`assembler`、`plate_press` |
| `tier`           | 机器等级（决定能做哪些配方）                      | `1`、`2`                              |
| `euPerSec`       | 基础 EU 消耗（发电机=发电量）                     | `8`                                   |
| `fuelResourceId` | 燃料资源 ID（发电机/蒸汽发生器填写）              | `coal`                                |
| `fuelPerSec`     | 每秒燃料消耗                                      | `0.5`                                 |
| `buildCost`      | 格式 `resourceId:amount                           | ...`，空=免费                         | `iron_plate:4` |
| `maxCount`       | 最大可建造数量，0=不可建造                        | `5`                                   |
| `showCondType`   | 解锁条件类型（空=无条件）                         | `chapter`                             |
| `showCondPara`   | 解锁条件参数                                      | `99`                                  |
| `instantMode`    | `1`=瞬时机器（点击制作），`0`=普通机器            | `1`（hand_assembly）                  |
| `maxVoltage`     | 最高承受电压：`-1`=不耗电，`0`=蒸汽机器，`≥1`=LV+ | `-1`（hand_assembly）                 |

**特殊机器**：`hand_assembly`（徒手组装）buildCost 为空数组，`instantMode=1`，开局由 `giveFreeMachine()` 赠送，maxCount=1。

**机器 category 说明**：
- `category=1`：合成机器，消耗 EU 或蒸汽运行配方
- `category=2`：EU 发电机，消耗燃料产出 EU
- `category=3`：蒸汽发生器，消耗燃料产出蒸汽

---

### 任务表 — tasks.csv

| 列名           | 说明                                                        | 示例                           |
| -------------- | ----------------------------------------------------------- | ------------------------------ |
| `id`           | 全局唯一字符串 ID，格式 `verb_noun`                         | `build_furnace`、`gather_coal` |
| `locKey`       | 任务描述 i18n key                                           | `task.build_furnace`           |
| `type`         | 任务类型代码                                                | 见下表                         |
| `para1`        | 参数1（含义由 type 决定）                                   | `furnace`                      |
| `para2`        | 参数2（可选）                                               | `1`                            |
| `rewardId`     | 奖励 ID（引用 rewards.csv，0=无奖励）                       | `5`                            |
| `prereqTaskId` | 前置任务 ID（逗号分隔多前置，只有前置完成后才会显示和检测） | `gather_stone`                 |

**type 含义**：

| type | 含义             | para1                                                  | para2                                                                |
| ---- | ---------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| `1`  | BUILD_MACHINE    | 机器 defId                                             | 目标数量                                                             |
| `2`  | PRODUCE_TOTAL    | 资源 ID（支持逗号分隔多资源）                          | 对应目标数量（逗号分隔）；追踪 `inventoryStore.totalProduced`        |
| `3`  | HAVE_ITEM        | 资源 ID                                                | 目标持有数量；追踪 `inventoryStore.items`                            |
| `4`  | REACH_EU_PER_SEC | 目标 EU/s；追踪 `powerStore.totalGenPerSec`            | —                                                                    |
| `5`  | HAVE_TOOL        | 工具类型（如 `pickaxe`）                               | 目标等级                                                             |
| `6`  | OWN_MACHINE      | 机器 defId                                             | 目标数量                                                             |
| `7`  | PRODUCE_STEAM    | 目标蒸汽 mb（累计）；追踪 `steamStore.totalProducedMb` | —                                                                    |
| `8`  | CRAFT_ITEM       | 资源 ID                                                | 目标制作数量；任务可见后玩家在制作地点完成的制作才计数，跨存档不重置 |

**PRODUCE_TOTAL 多资源写法**：`para1=copper_ore,tin_ore,coal`、`para2=5,5,5`

**prereqTaskId 支持多前置**：用逗号分隔，所有前置都完成后任务才会出现（如 `make_copper_ingot,make_tin_ingot`）

---

### 章节表 — chapters.csv

| 列名          | 说明                                            | 示例                                       |
| ------------- | ----------------------------------------------- | ------------------------------------------ |
| `id`          | 章节 ID                                         | `1`                                        |
| `locKey`      | 章节名称 i18n key                               | `chapter.1.name`                           |
| `descLocKey`  | 章节描述 i18n key                               | `chapter.1.desc`                           |
| `taskIds`     | 任务 ID 列表（竖线分隔）                        | `gather_wood\|gather_stone\|build_furnace` |
| `advancesEra` | 完成本章后推进到的游戏时代（可选，留空=不推进） | `steam` / `lv`                             |

**章节完成条件**：章节内所有 taskIds 全部完成后，章节标记为已完成，显示"进入下一章"按钮。玩家点击该按钮时，若 `advancesEra` 不为空且比当前时代更高，则先推进 `progressionStore.era`，再切换到下一章。时代只前进不倒退。

---

### 科技表 — techs.csv

| 列名              | 说明                                         | 示例                           |
| ----------------- | -------------------------------------------- | ------------------------------ |
| `id`              | 唯一 ID                                      | `overclock`                    |
| `treeId`          | 所属科技树 ID                                | `automation`                   |
| `locKey`          | 科技名称 i18n key                            | `tech.overclock.name`          |
| `descLocKey`      | 科技描述 i18n key                            | `tech.overclock.desc`          |
| `cost`            | 格式 `resourceId:amount                      | ...`                           | `iron_ingot:10`             |
| `col` / `row`     | 在科技树画布中的位置                         | `0` / `1`                      |
| `prerequisites`   | 格式 `techId:kind                            | ...`（kind=explicit/implicit） | `basic_automation:explicit` |
| `showCondition`   | 显示条件（原始字符串，如 `chapter:2`）       | `eu_per_sec:32`                |
| `unlockCondition` | 解锁条件（原始字符串）                       | `task:5`                       |
| `unlocks`         | JSON：`{features, machineDefIds, recipeIds}` | `{...}`                        |

**features 特性标志**：`overclock`（解锁超频）/ `auto_miner_eu` / `parallel_2x`

---

### 工具表 — tools.csv

| 列名                | 说明                                     | 示例                                                   |
| ------------------- | ---------------------------------------- | ------------------------------------------------------ |
| `id`                | 唯一字符串 ID，格式 `type_level`         | `stone_axe_0`、`prospector_2`                          |
| `type`              | 工具类型（如 `axe`、`pickaxe`、`prospector`）         | `axe`                                              |
| `level`             | 等级（0=待制作，1=初级，2=进阶...）      | `0`、`1`、`2`                                          |
| `abilityId`         | 能力 ID                                  | `wood_ability`、`mining_ability`、`prospector_ability` |
| `abilityValue`      | 能力值                                   | `1`、`2`、`3`                                          |
| `upgradeCost`       | 格式 `resourceId:amount                  | ...`，空=满级                                          | `log_wood:5\|coarse_rope:2` |
| `locKey`            | 显示名称 i18n key                        | `tool.stone_axe.level_0`                               |
| `unlockedByChapter` | 所属章节                                 | `1`                                                    |
| `showCondType`      | 显示条件类型（空=无条件）                | `resource_ever`、`tool`                                |
| `showCondPara`      | 显示条件参数                             | `basic_circuit`、`prospector:1`                        |

**探矿仪解锁逻辑**：
- 初级（level=1）：需制作过 `basic_circuit`（resource_ever:basic_circuit）
- 进阶（level=2）：需先拥有初级探矿仪（tool:prospector:1）
- 精密（level=3）：需先拥有进阶探矿仪（tool:prospector:2）

**abilityId 类型**：`wood_ability`（伐木）、`mining_ability`（采矿）、`prospector_ability`（探矿）

---

### 维度表 — dimensions.csv

| 列名              | 说明                                           | 示例                              |
| ----------------- | ---------------------------------------------- | --------------------------------- |
| `id`              | 维度唯一 ID                                    | `overworld`                       |
| `locKey`          | 维度名称 i18n key                              | `dimension.overworld`             |
| `descLocKey`      | 描述 i18n key                                  | `dimension.overworld.desc`        |
| `biomeIds`        | 包含的群系 ID 列表（竖线分隔）                 | `plains\|forest\|desert`          |
| `startBiomeId`    | 进入该维度时的默认群系 ID                      | `plains`                          |
| `unlockCondition` | 解锁条件字符串（空=无条件）                    | —                                 |
| `exploreFoodCost` | 探索新群系所需的食物点数总量                   | `30`                              |
| `explorePool`     | 可探索群系及权重（格式 `biomeId:weight\|...`） | `plains:60\|forest:50\|desert:40` |

---

### 群系表 — biomes.csv

| 列名           | 说明                           | 示例                      |
| -------------- | ------------------------------ | ------------------------- |
| `id`           | 群系唯一 ID                    | `plains`                  |
| `locKey`       | 群系名称 i18n key              | `biome.plains`            |
| `imagePath`    | 背景图片路径（放入 `public/`） | `biomes/plains.png`       |
| `ambientColor` | CSS filter 色调调整（可选）    | `hue-rotate(30deg)`       |
| `nodeIds`      | 包含的节点 ID 列表（逗号分隔） | `oak_tree_1,stone_rock_1` |

---

### 探索节点表 — biome_nodes.csv

| 列名                   | 说明                                                 | 示例                             |
| ---------------------- | ---------------------------------------------------- | -------------------------------- |
| `id`                   | 节点唯一 ID                                          | `oak_tree_1`                     |
| `locKey`               | 节点名称 i18n key（悬浮提示）                        | `world.node.oak_tree`            |
| `actionLocKey`         | 按钮文字 i18n key                                    | `world.action.chop_tree`         |
| `type`                 | `click`（即时）或 `timed`（倒计时）或 `mine`（矿洞） | `click`                          |
| `rewardId`             | 引用 rewards.csv 的奖励 ID（mine 节点填 0）          | `1`、`14`                        |
| `durationSec`          | 倒计时秒数（仅 `timed`/`mine`）                      | `30`                             |
| `posX` / `posY`        | 面板内位置（0-100，百分比）                          | `30` / `50`                      |
| `hidden`               | `true`=隐藏节点，需点击热区才显示                    | `false`                          |
| `hitArea`              | SVG polygon 坐标（仅 hidden=true）                   | `70,25 95,25 95,65 70,65`        |
| `requiredAbility`      | 所需采集能力类型                                     | `wood_ability`、`mining_ability` |
| `requiredAbilityValue` | 所需采集能力门槛值                                   | `1`                              |
| `entryCost`            | mine 类型进入消耗（格式 `resourceId:amount\|...`）   | `torch:3`                        |
| `caveId`               | mine 类型进入的矿洞 ID（引用 mine_caves.id）         | `medium_cave`、`large_cave`      |

**能力门槛逻辑**：
- 玩家 ability < requiredAbilityValue → 无法采集，显示"工具等级不足"
- 玩家 ability >= requiredAbilityValue → 可采集，且超出门槛时有额外产出加成

---

### 面板表 — panels.csv

| 列名           | 说明                        | 示例            |
| -------------- | --------------------------- | --------------- |
| `id`           | 面板唯一 ID                 | `crafting`      |
| `order`        | 导航排序（最小 = 默认激活） | `5`             |
| `icon`         | 导航图标 emoji              | `🔨`             |
| `labelKey`     | 导航标签 i18n key           | `nav.crafting`  |
| `showCondType` | 显示条件类型（空=始终显示） | `resource_ever` |
| `showCondPara` | 显示条件参数                | `*`（任意物品） |
| `hideCondType` | 隐藏条件（仅 `panel` 用）   | `tech`          |
| `hideCondPara` | 隐藏条件参数                | `electric_age`  |

**当前面板 showCond 用法**：仓库面板 `showCondType=resource_ever, showCondPara=*`，表示获得过任意物品后才显示。

---

### 矿洞方块表 — mine_blocks.json

| 字段                    | 说明                                                          | 示例               |
| ----------------------- | ------------------------------------------------------------- | ------------------ |
| `id`                    | 方块唯一 ID                                                   | `stone`            |
| `locKey`                | 显示名称 i18n key                                             | `mine.block.stone` |
| `category`              | `soft`（软土）/`hard`（硬石）/`ore`（矿石）/`special`（特殊） | `hard`             |
| `color`                 | CSS 颜色，用于格子背景                                        | `#888`             |
| `requiredMiningAbility` | 最低采矿能力值                                                | `1`                |
| `rewardId`              | 引用 rewards.csv 的奖励 ID（空=无产出）                       | `5`                |

---

### 奖励表 — rewards.csv

节点/方块产出的统一配置，由 `applyReward(rewardId, fixedBonus?)` 调用。

| 列名    | 说明                                                      | 示例                          |
| ------- | --------------------------------------------------------- | ----------------------------- |
| `id`    | 奖励 ID（整数，按功能分段）                               | `1`、`14`                     |
| `fixed` | 保底产出（格式 `resourceId:amount\|...`，空=无保底）      | `log_wood:1`                  |
| `pool`  | 随机池（格式 `resourceId:amount:weight\|...`，空=无随机） | `iron_ore:2:30\|nothing:1:70` |

**ID 分段惯例**（非强制）：
- 1–13：主世界平原/森林节点
- 14–16：沙漠节点
- 17–19：沼泽节点
- 20–23：山地节点
- 100+：矿洞方块

**pool 特殊条目**：`nothing:1:N` 表示权重为 N 的空产出（即此概率下什么都不给）。


---

### Explore 二阶段新增表

- `explore_maps.csv`：遗迹地图生成参数与固定房锚点
- `explore_rooms.csv`：房间定义（`layoutType + type`）
- `explore_enemies.csv`：战斗敌人属性与掉落
- `explore_events.csv`：剧情节点链与分支选项

详细结构与运行规则见：`EXPLORE_SYSTEM.md`
