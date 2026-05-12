# 数据 ID 命名规范

## 核心原则

ID 的类型和格式取决于它的**使用场景**，而非随意选择。

| 场景 | 推荐 ID 类型 | 理由 |
|------|-------------|------|
| 出现在人工编写的配置文本中（CSV、其他表的外键字段） | **字符串** | 可读性优先；写错立即发现 |
| 纯外键引用、永不出现在配置文字中 | **数字** | 稳定、无歧义 |

---

## 各表规范

### 字符串 ID 表

#### 任务（tasks）
- 格式：`动词_名词`，使用下划线，全小写
- 动词描述**达成方式**，名词是**目标对象**
- 示例：`build_furnace`、`gather_coal`、`reach_power`、`make_wire`

#### 工具（tools）
- 格式：`类型_等级数字`
- 类型来自 `type` 字段（如 `stone_axe`、`stone_pickaxe`、`prospector`）
- 等级从 0 开始（0 = 待制作/未解锁初始状态，1 = 基础，2 = 升级…）
- 示例：`stone_axe_0`、`stone_axe_1`、`prospector_1`、`prospector_2`

> **注意**：工具 ID 仅供数据库索引用，代码中工具统一通过 `toolsByType()[type]` 访问，
> 不直接 `db.get('tools', id)` 查询。等级编码进 ID 是为了让 CSV 一眼可读，
> 而非在代码里做字符串解析。

#### 其他字符串 ID 表
- 资源（resources）：`snake_case` 名词，如 `iron_ore`、`copper_wire`
- 配方（recipes）：`动词_名词`，如 `smelt_iron`、`make_copper_wire`
- 机器（machines）：`snake_case` 名词，如 `electric_furnace`、`steam_boiler`
- 科技（techs）：`snake_case` 描述，如 `basic_automation`、`machine_overclock`
- 群系节点（biome_nodes）：`群系_类型_序号`，如 `plains_oak_1`、`plains_mine_entrance`
- 矿洞（mine_caves）：`场景_cave`，如 `plains_cave`、`medium_cave`
- 矿脉（mine_veins）：`矿石类型_vein`，如 `coal_vein`、`iron_vein`
- 矿块（mine_blocks）：`snake_case` 名词，如 `coal_vein`、`deep_stone`

### 数字 ID 表

#### 奖励（rewards）
- 纯数字，按功能分段：
  - `10000–19999`：群系节点奖励
  - `20000–29999`：矿洞/矿块奖励
  - 预留更多段位给未来系统
- 理由：奖励 ID 只出现在 `rewardId` 外键字段，内容随时可能重构（如橡树改种类），
  字符串 ID 会随内容变化而失真，数字 ID 永远稳定。

#### 章节（chapters）
- 纯数字，顺序递增：`1`、`2`、`3`…
- 章节是线性进度轨道，数字顺序即语义，无需文字描述。

---

## 禁止事项

- **禁止"聪明 ID"**：不要把数据编码进 ID（如 `1001` 表示斧子1级）。
  这会把同一份数据存两遍，维护时两处都要改。
  工具 ID 的 `stone_axe_1` 是例外——这里类型和等级来自 `type`/`level` 列，
  ID 只是方便人类阅读，代码不解析 ID。
- **禁止随意缩写**：`gather_wood` 好于 `g_wood`；可读性比长度更重要。
- **禁止混用**：同一张表的 ID 类型必须统一，不能有的行用数字有的用字符串。

---

## 快速参考

```
tasks:       build_furnace | gather_coal | reach_power
tools:       stone_axe_0 | stone_axe_1 | prospector_1
resources:   iron_ore | copper_wire | basic_circuit
recipes:     smelt_iron | make_copper_wire
chapters:    1 | 2 | 3
rewards:     10001 | 20001
```
