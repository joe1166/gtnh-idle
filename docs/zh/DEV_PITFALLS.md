# 开发踩坑记录

> 记录项目开发过程中遇到的非预期行为、根因分析以及解决方案。遇到奇怪 bug 时先查这里。

---

## 1. HMR 重置后 `instanceId` 冲突导致机器操作错乱

**环境：** 开发阶段，Vite HMR 开启。

**现象：** 点击 CraftingPanel 中某台机器的"开启"按钮，store 却对另一台机器（通常是第一台）执行了操作。控制台日志显示点击的 `instanceId` 和实际找到的 `defId` 不一致。

**日志表现：**

```text
[onToggleClick] defId=workbench instanceId=machine_1 isRunning=false
[toggleMachine] id=machine_1 defId=hand_assembly isRunning=true  // 实际被操作的是 hand_assembly！
```

**根因分析：**

`machineStore` 用模块级变量 `_nextId` 生成实例 ID：

```typescript
let _nextId = 1

// 建造机器时：
instanceId: `machine_${_nextId++}`  // machine_1, machine_2, ...
```

`this.instances` 数组通过 localStorage 持久化。页面刷新后：
1. `_nextId` 重置为 1（全新 JS 上下文）
2. `instances` 从 localStorage 恢复，包含旧 session 的所有机器（machine_1 = hand_assembly）
3. 新建造的 workbench 也得到 `machine_1`
4. 数组里出现**两个 `machine_1`**，`toggleMachine('machine_1')` 总是找到第一个（hand_assembly）

**解决方案：** `instanceId` 格式改为 `${defId}_${counter}`，每个 `defId` 有独立计数器：

```typescript
const _counters: Record<string, number> = {}

function nextInstanceId(defId: string): string {
  _counters[defId] = (_counters[defId] ?? 0) + 1
  return `${defId}_${_counters[defId]}`  // hand_assembly_1, workbench_1, ...
}
```

**进阶问题：HMR 重置 `_counters` 后仍可能与 localStorage 冲突**

即使改用复合 ID，HMR 仍会重置 `_counters`（空对象），而 localStorage 中的实例 ID（如 `workbench_1`）不会消失。新建的 `workbench` 会重新从 `workbench_1` 开始编号，和旧数据冲突。

**解决方案：`syncCountersFromInstances` + `load()` 后同步**

`load()` 从 localStorage 恢复实例后，调用 `syncCounters()` 扫描所有已有 instance ID，提取每个 defId 的最大序号，同步到 `_counters`。此后 `nextInstanceId()` 生成的编号永远不会和旧数据重叠。

```typescript
// useSaveLoad.ts
if (data.state.machines?.instances) {
  useMachineStore().syncCounters(data.state.machines.instances)
}
```

**经验教训：** 全局 ID 生成器必须考虑 HMR/localStorage 并存场景。复合 ID + 启动时同步最大序号是最可靠的方案。

**旧存档兼容性：删除机器类型后的残留实例清理**

如果新版本删除了某个机器（如 `workbench`），旧存档 localStorage 中仍保留着 `workbench_1` 等实例。`load()` 后该实例仍存在于 `instances` 中，但 `db.get('machines', 'workbench')` 已返回 `undefined`，导致：
- tick 中该机器被静默跳过（`if (!def) continue`）
- UI 中该机器显示为空白/异常状态

**解决方案：** `load()` 后调用 `removeInvalidInstances()`，过滤掉配置中已不存在的实例：

```typescript
// useSaveLoad.ts load() 中
useMachineStore().removeInvalidInstances()
// 删除了配置里没有 defId 的所有实例
```

---

## 2. Phase 3 tick 处理了 `instantMode=1` 的机器

**现象：** `hand_assembly`（instantMode=1）被 tick 中的 Phase 3 错误地设置状态为 `no_material`，导致 `isRunning` 被意外关闭，UI 显示混乱。

**根因：** Phase 3 遍历所有 `category=1` 的机器，但漏掉了对 `instantMode=1` 的跳过逻辑。instant 机器本应完全由 UI 层（`CraftingPanel.handleCraft`）驱动，和 tick 无关。

**解决方案：** Phase 3 开头加跳过判断：

```typescript
if ((def.instantMode ?? 0) === 1) continue
```

**经验教训：** instantMode 的语义是"完全由 UI 驱动"，需要在所有相关代码路径（tick、UI 渲染）显式处理，不能依赖默认值。

---

## 3. CSV 空字段占位导致解析错位

**现象：** 添加 `workbench` 机器时，buildCost 中的 pipe 分隔材料被错误解析。

**根因：** CSV 中 `fuelResourceId` 和 `fuelPerSec` 字段为空时，必须用 `,,` 保持位置占位，否则后续 `buildCost` 的 pipe 分隔值会前移一位被错误消费。

**正确写法：**

```
workbench,machine.workbench,1,assembler,1,0,,0,flint:3|log_wood:5,1,resource_ever,flint,0
```

`furnace` 行中 `fuelResourceId` 和 `fuelPerSec` 本身就是空值，但仍然有 `,,` 占位。

**经验教训：** CSV 可选字段为空时，逗号占位不能省略。解析侧按固定位置映射字段，数量必须严格对齐。

---

## 4. 离线模拟状态 `isSimulatingOffline` 被 localStorage 持久化导致遮罩无法关闭

**现象：** 游戏启动后显示"正在模拟离线进度 100%"遮罩，但实际离线时间只有几秒（不足以触发离线模拟），页面卡死。

**根因：** `gameStore.isSimulatingOffline` 是普通 boolean 状态，随存档一起被持久化到 localStorage。如果上一次游戏在离线模拟过程中关闭了标签页（如被浏览器杀掉），`setOfflineSimulating(false)` 没来得及调用，导致 localStorage 中保留了 `isSimulatingOffline: true` + `offlineSimProgress: 100`。

**解决方案：** `load()` 末尾强制重置：

```typescript
// useSaveLoad.ts load() 末尾
useGameStore().setOfflineSimulating(false, 0)
```

**经验教训：** 临时性的 UI 状态（如弹窗遮罩）不应混入可序列化的 gameStore state。如需标记"正在模拟中"，应仅用内存变量，不写入 localStorage。
