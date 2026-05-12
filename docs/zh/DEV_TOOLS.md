# 开发者工具

> 仅开发阶段使用，不影响正式玩法。所有开关状态不持久化（刷新后重置）。

---

## 打开方式

按 **`` ` ``（反引号 / 波浪键）** 切换开发者控制台显示/隐藏。

- 该键位于键盘左上角 ESC 正下方，与浏览器快捷键无冲突。
- 矿洞全屏模式下同样有效（监听在 `App.vue` 根组件，全局生效）。
- TopBar 右上角齿轮图标也可点击切换（矿洞全屏时不可见）。

---

## 实现位置

| 文件 | 职责 |
|------|------|
| `src/composables/useDevConsole.ts` | 模块级单例：`isOpen`、`highlightHitAreas`、`mineReveal` 三个 ref |
| `src/components/modals/DevConsole.vue` | 弹窗 UI，Teleport 挂到 body，固定右下角 |
| `src/App.vue` | `onMounted` 注册全局 keydown 监听（`` ` `` → toggle），`onUnmounted` 清理 |

---

## 当前功能

### 高亮热区轮廓

**ref**：`highlightHitAreas`

开启后，世界面板（WorldPanel.vue）中 SVG 热区的 `hitArea` 轮廓以橙色边框显示，用于调试节点点击区域的位置和大小。

使用方式：

```typescript
import { useDevConsole } from '../../composables/useDevConsole'
const { highlightHitAreas } = useDevConsole()

// 在模板中：
:style="highlightHitAreas ? { outline: '2px solid orange' } : {}"
```

---

### 矿透（Mine Reveal）

**ref**：`mineReveal`

开启后，矿洞网格中正常不可见的黑色格子（未与已挖可达格相邻的区域）会显示其真实方块颜色，方便调试地图生成结果（矿脉分布、基岩过渡带等）。

视觉上，被"透视"出来的格子 opacity 为 0.55，与真实可见的相邻格（opacity 1.0）有明显区别。

**影响范围**（`MineGrid.vue` 中三处）：

| 函数 | 正常行为 | 矿透行为 |
|------|---------|---------|
| `cellClass` | 非相邻格返回 `--invisible` | 返回 `--revealed` + diggable/locked |
| `cellStyle` | 非相邻格返回 `{}` | 计算并返回真实方块颜色/渐变 |
| `cellTitle` | 非相邻格返回 `''` | 返回方块名 tooltip |

矿透模式下点击不可见格仍会提示"此处不可见"（不绕过可达性判断）。

---

## 添加新功能

1. 在 `useDevConsole.ts` 中声明新的 `ref`，并在 `return` 中导出
2. 在 `DevConsole.vue` 的 `<div class="dev-body">` 中追加 `<label class="dev-row">` 复选框
3. 在需要响应该开关的组件中 `import { useDevConsole }` 并取出对应 ref 使用

无需任何路由/权限配置，composable 是模块级单例，跨组件共享状态。
