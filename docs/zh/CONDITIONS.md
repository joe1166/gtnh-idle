# 中心化条件系统

> 核心文件：`src/data/conditions.ts`

---

## 技术部分

### Condition 类型定义

```typescript
export type ConditionType = 'chapter' | 'task' | 'tech' | 'resource' | 'resource_ever' | 'tool'

export interface Condition {
  type: ConditionType
  /** para 格式： */
  para: string
}
```

### 条件类型一览

| type | para 格式 | 判断逻辑 |
|------|-----------|---------|
| `chapter` | 数字字符串，如 `'3'` | `currentChapterId >= Number(para)` |
| `task` | 数字字符串，如 `'10'` | 任务 ID=para 已完成 |
| `tech` | 科技 ID 字符串 | 科技已研究 |
| `resource` | 资源 ID 字符串 | 当前背包中拥有 > 0 |
| `resource_ever` | 资源 ID 字符串，或 `'*'` | 曾获得过（`totalProduced > 0`），`*`=任意物品 |
| `tool` | `'toolType:level'`，如 `'stone_axe:2'` | 工具等级 >= value |

### evaluateCondition 实现

```typescript
export function evaluateCondition(cond: Condition | undefined | null): boolean {
  if (!cond) return true
  switch (cond.type) {
    case 'chapter':  return useProgressionStore().currentChapterId >= Number(cond.para)
    case 'task':    return useTaskStore().isComplete(Number(cond.para))
    case 'tech':    return useTechStore().isResearched(cond.para)
    case 'resource': return useInventoryStore().getAmount(cond.para) > 0
    case 'resource_ever':
      if (cond.para === '*') {
        // 曾获得过任意物品
        return Object.values(useInventoryStore().totalProduced).some(v => v > 0)
      }
      return useInventoryStore().everHad(cond.para)
    case 'tool': { /* parse toolType:level */ return (toolStore.levels[toolType] ?? 0) >= level }
    default: return false
  }
}
```

### db.ts 中的 showCond 转换

`buildShowCond()` 在 `db.ts` 加载时将 CSV 的 `showCondType + showCondPara` 合并为 `Condition | undefined`，所有配置对象直接带 `showCond` 字段，无需每次都解析字符串。

### panel 条件特殊处理

`hideCond.type === 'panel'` 需要两轮 pass 避免循环依赖（SideNav.vue 单独处理），不走 `evaluateCondition`。

---

## 策划部分

### showCondType / showCondPara 字段

每张需要控制显示/隐藏的配置表都有两个字段：

- `showCondType`：条件类型（`chapter` / `task` / `tech` / `resource` / `resource_ever` / `tool`，空=无条件）
- `showCondPara`：条件参数（见上表格式）

### 使用场景

| 配置表 | 用途 |
|--------|------|
| machines.csv | 控制机器是否可建造/显示 |
| recipes.csv | 控制配方是否可用 |
| panels.csv | 控制面板是否出现在导航 |
| tasks.csv（间接） | 任务完成条件 |

### resource vs resource_ever 的区别

- `resource:weeds` = **当前**背包里有杂草才解锁（用掉就没了）
- `resource_ever:weeds` = **曾经获得过**杂草就永久解锁（`totalProduced > 0`，用掉也保留）
  - 典型用法：合成面板在获得杂草后永久解锁

### 示例

机器在第 3 章解锁：
- `showCondType = chapter`
- `showCondPara = 3`

任务 10 完成后解锁：
- `showCondType = task`
- `showCondPara = 10`

获得过杂草后解锁：
- `showCondType = resource_ever`
- `showCondPara = weeds`

工具等级达到 2 级解锁：
- `showCondType = tool`
- `showCondPara = stone_axe:2`