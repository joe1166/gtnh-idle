# 面板系统

---

## 技术部分

### App.vue

```typescript
const activePanel = ref('world')
const defaultPanelId = computed(() =>
  PANEL_DEFS.filter(d => isVisible(d)).sort((a, b) => a.order - b.order)[0]?.id
)
const isPanelFullBleed = computed(() => activePanel.value === 'world')
```

默认激活面板由 `order` 最小的可见面板动态决定（不硬编码 `'world'`）。

### SideNav.vue - 两轮 pass

`hideCond.type === 'panel'` 需要两轮 pass 避免循环依赖：

```typescript
// 第一轮：计算所有 showCond 通过的面板（不含 panel 类型 hideCond）
const allVisible = computed(() => PANEL_DEFS.filter(d =>
  !d.showCond || evaluateCondition(d.showCond)
))
const visibleIds = computed(() => new Set(allVisible.value.map(p => p.id)))

// 第二轮：应用 panel 类型 hideCond
const navItems = computed(() => PANEL_DEFS.filter(d => isVisible(d, visibleIds.value)))
```

### 面板自动存档

```typescript
watch(navItems, (newItems) => {
  const newIds = newItems.map(p => p.id).filter(id => !prevVisibleIds.has(id))
  if (newIds.length > 0) {
    newIds.forEach(id => prevVisibleIds.add(id))
    save()  // 立即存档
  }
}, { deep: true })
```

### panelConfig.ts

```typescript
import { Condition, evaluateCondition } from './conditions'

export interface PanelShowCondition extends Condition {}
export interface PanelHideCondition { type: 'panel'; para: string }
export interface PanelDef {
  id: string
  order: number
  icon: string
  labelKey: string
  showCond?: Condition
  hideCond?: Condition | PanelHideCondition
}
```

---

## 策划部分

### panels.csv 字段说明

| 字段 | 说明 |
|------|------|
| `order` | 导航排序，数值最小 = 默认激活面板 |
| `icon` | 导航图标 emoji |
| `labelKey` | 导航标签 i18n key |
| `showCondType` | 显示条件（空=无条件显示） |
| `showCondPara` | 显示条件参数 |
| `hideCondType` | 隐藏条件（`panel` 类型仅用于此） |
| `hideCondPara` | 隐藏条件参数 |

### showCond vs hideCond

- `showCond`：满足条件才显示（如完成任务 10 后面板出现）
- `hideCond`：满足条件就隐藏（如进入电气时代后蒸汽面板消失）
- `hideCond` 优先于 `showCond`

### panel 类型 hideCond

仅用于处理面板间的互斥关系（如 A 面板出现时 B 面板消失），不走 `evaluateCondition`，由 SideNav 两轮 pass 处理。

### 当前面板解锁条件

| 面板 | showCondType | showCondPara | 说明 |
|------|-------------|-------------|------|
| world | — | — | 无条件，永远显示 |
| chapter | task | 10 | 完成任务 10 解锁 |
| steam | task | 13 | 完成任务 13 解锁 |
| power | tech | electric_age | 研究电气时代后解锁 |
| mining | task | 14 | 完成任务 14 解锁 |
| crafting | resource_ever | weeds | 获得过杂草后永久解锁 |
| inventory | task | 15 | 完成任务 15 解锁 |
| tech | task | 12 | 完成任务 12 解锁 |

### 新增面板

1. 在 `panels.csv` 新增行，配置 `showCondType + showCondPara`
2. 在 `App.vue` 的 `<component :is="...">` 中注册对应面板组件
3. SideNav 条件判断自动生效