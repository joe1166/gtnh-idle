# 制作系统

---

## 技术部分

### 配方匹配规则

```
machine.role === recipe.requiredRole && machine.tier >= recipe.requiredLevel
```

- 机器的 `role` + `tier` 决定它能执行哪些配方
- 不依赖枚举 ID，扩展时无需修改已有配置

### availableMachineDefs

```typescript
const availableMachineDefs = computed(() =>
  db.filter('machines', (d) =>
    d.category === 1 && d.role !== 'miner' && evaluateCondition(d.showCond)
  )
)
```

过滤 category=1（处理机器）且已解锁的机器。`miner` 角色暂不允许手动建造。

### canBuild 逻辑

```typescript
function canBuild(defId: string): boolean {
  const def = db.get('machines', defId)
  if (!def) return false
  if (def.maxCount === 0) return false
  if (instancesOf(defId).length >= def.maxCount) return false
  return inventoryStore.canAfford(def.buildCost)
}
```

### hand_assembly 特殊处理

- `buildCost` 为空数组 `[]` → 显示"免费"
- `maxCount = 1` → 上限 1
- 开局由 `machineStore.giveFreeMachine('hand_assembly')` 赠送，不消耗材料
- 界面不显示 x1 / (MAX) 等标记

### 默认电压

新建机器时：
```typescript
const defaultVoltage = Math.min(
  (def as any).maxVoltage ?? 0,
  usePowerStore().globalMaxVoltage
)
```

### 机器 tier 说明

- `tier` 越高，能执行的配方越多（向后兼容）
- 配方 `requiredLevel` 是最低要求，tier=2 机器可以执行 requiredLevel=1 的配方

### 瞬时机器（instantMode = 1）

**完全独立于 tick 循环**，由 UI 层直接驱动。

#### UI 层状态判断

```typescript
// 纯 computed，基于当前 inventory 判断，不依赖 machineStore 状态
function canAffordInstant(inst: MachineInstance): boolean {
  if (!inst.selectedRecipeId) return false
  const recipe = db.get('recipes', inst.selectedRecipeId)
  if (!recipe) return false
  return inventoryStore.canAfford(recipe.inputs)
}
```

- 有材料：按钮绿色可点击，进度区空白
- 缺材料：按钮灰色禁用，进度区显示 `status.no_material`

#### handleCraft 实现

```typescript
function handleCraft(e: MouseEvent, inst: MachineInstance): void {
  if (!inst.selectedRecipeId) return
  if (!canAffordInstant(inst)) return
  const recipe = db.get('recipes', inst.selectedRecipeId)
  if (!recipe) return
  inventoryStore.spend(recipe.inputs)
  for (const output of recipe.outputs) {
    inventoryStore.addItem(output.resourceId, output.amount)
    spawnFloat(e, `+${output.amount} ${getResName(output.resourceId)}`)
  }
}
```

- 直接操作 inventory，不经过 tick
- 每个产出触发浮动文字动画（`spawnFloat`）
- `spawnFloat` 与 WorldPanel 共用相同逻辑

#### machineStore tick 中的瞬时机器

`instantMode=1` 的机器在 tick 中**完全跳过**，不做任何处理（既不消耗能源也不处理配方）。

### 普通机器的停止条件（progressSec 重置）

Phase 3 中，以下三种情况会重置 `progressSec = 0`：

| 状态 | 条件 | 能源退还 |
|------|------|---------|
| `no_power` | selectedVoltage < recipe.voltage 或电力不足 | 退还 |
| `no_steam` | ULV 配方但蒸汽不足 | 退还 |
| `no_material` | 材料不足（首次开始时检测） | 不退还 |

停止时 `progressSec` 重置为 0，重新满足条件后从头开始。

### 超频逻辑

```typescript
const tiers = m.selectedVoltage - recipe.voltage  // 超频档数
const euCost = recipe.euPerSec * Math.pow(4, tiers)  // EU 消耗 ×4^档数
const speedMult = calcSpeedMult(recipe.overclock, tiers)  // 速度倍率
```

- `overclock = 0`：不可超频
- `overclock = 1`：有损超频（每档 ×2 速度）
- `overclock = 2`：无损超频（每档 ×4 速度）

---

## 策划部分

### machines.csv 关键字段

**机器 ID 命名规范**：`{role}_{等级}`，如 `plate_press_1`。显示名称（`locKey`）与 ID 解耦。

| 字段 | 说明 |
|------|------|
| `id` | 唯一 ID，命名遵循 `role_tier` 规范，如同类型多级机器用 `assembler_2` |
| `role` | 机器类型，匹配配方用（如 `furnace`、`assembler`、`plate_press`） |
| `tier` | 机器等级，决定能执行哪些配方 |
| `maxCount` | 最大可建造数量，0=不可建造（开局赠送不受此限制） |
| `buildCost` | 建造消耗材料，hand_assembly 为空数组=免费 |
| `instantMode` | `1`=瞬时机器（点击制作，不依赖 tick）；`0`=普通机器 |
| `maxVoltage` | 最高承受电压：`-1`=不耗电，`0`=蒸汽机器，`≥1`=LV+ |

### recipes.csv 关键字段

| 字段 | 说明 |
|------|------|
| `requiredRole` | 配方所需的机器类型 |
| `requiredLevel` | 配方所需的最低机器等级 |
| `euPerSec` | 每秒 EU 消耗（0=不耗电） |
| `voltage` | 所需最低电压等级（0=ULV/蒸汽，1=LV，-1=无需能源） |
| `overclock` | 是否可超频（0=不可，1=有损，2=无损） |
| `durationSec` | 完成时间（秒），普通机器使用 |

### 瞬时机器配置步骤

1. 机器定义设置 `instantMode = 1`
2. 该机器所有配方按普通方式配置 `durationSec`（UI 层忽略）
3. 玩家点击"制作"按钮时触发一次制作，消耗材料并产出
4. 有材料时按钮可点击，缺材料时按钮禁用并显示"缺少材料"

### 建造限制逻辑

- `maxCount > 0` 且 `当前实例数 < maxCount` 时可建造
- 上限为 1 时不显示 `×1` 标记
- 达到上限时建造按钮和消耗提示一起隐藏

### 新增机器/配方

1. 在 `tables/machines.csv` 或 `tables/recipes.csv` 新增行
2. 确保 `showCondType + showCondPara` 正确配置
3. 在 `tables/locale.csv` 补齐 i18n key
4. 运行 `npm run csv`

### 机器类型 role 一览

| role | 说明 |
|------|------|
| `furnace` | 冶炼炉 |
| `forge_hammer` | 锻造锤 |
| `wire_cutter` | 切线机 |
| `assembler` | 组装机 |
| `miner` | 采矿机（暂不允许手动建造） |