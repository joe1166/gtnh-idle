# UI 主题系统

---

## 技术概览

主题通过 CSS 自定义属性（`var(--token-name)`）驱动，统一定义在 `src/styles/global.css` 的 `:root` 选择器中。切换主题时仅覆盖 **Accent 组** 变量，其余 token 保持不变。

主题切换通过在 `<html>` 元素上添加 `data-theme` attribute 实现：

```html
<!-- 默认（Terminal Green） -->
<html>

<!-- 切换后 -->
<html data-theme="cobalt">
```

持久化：主题 ID 存入 `localStorage`（key: `gtnh_idle_theme`），页面加载时自动恢复。

---

## Token 规范

**所有 Vue 组件 CSS 必须使用以下 token，禁止直接写颜色字面量。**

### 背景层（由深到浅）

| Token | 默认值 | 用途 |
|-------|--------|------|
| `--bg-deep` | `#0d0d0d` | 矿洞/全屏覆盖层底色 |
| `--bg-base` | `#1a1a1a` | 应用根背景 |
| `--bg-panel` | `#2a2a2a` | 面板容器背景 |
| `--bg-elevated` | `#333333` | 卡片、按钮基色 |
| `--bg-hover` | `#3a3a3a` | hover 态 elevated |
| `--bg-sunken` | `#222222` | 凹陷区域（输入框等） |
| `--bg-overlay` | `rgba(0,0,0,0.72)` | 模态遮罩 |
| `--bg-glass` | `rgba(15,15,15,0.85)` | 底部面板毛玻璃背景 |

### 文字层（由亮到暗）

| Token | 默认值 | 用途 |
|-------|--------|------|
| `--text-primary` | `#e0e0e0` | 主要文字 |
| `--text-secondary` | `#a0a0a0` | 次要文字 |
| `--text-muted` | `#888888` | 弱化文字（标签、说明） |
| `--text-faint` | `#666666` | 极弱文字（分隔线旁标注） |
| `--text-disabled` | `#555555` | 禁用状态文字 |

### 边框

| Token | 默认值 | 用途 |
|-------|--------|------|
| `--border` | `rgba(180,180,180,0.2)` | 默认边框 |
| `--border-subtle` | `rgba(180,180,180,0.1)` | 细分割线 |
| `--border-strong` | `rgba(180,180,180,0.35)` | 强调边框（激活 tab 等） |
| `--border-emphasis` | `rgba(180,180,180,0.5)` | hover 高亮边框 |

### Accent（主题色，随主题切换）

| Token | 用途 |
|-------|------|
| `--accent` | 主题主色（按钮文字/图标/激活态） |
| `--accent-bg` | 主色按钮背景 |
| `--accent-bg-hover` | 主色按钮 hover 背景 |
| `--accent-subtle` | 极淡主色背景（约 8% 透明度） |
| `--accent-soft` | 淡主色背景（约 12% 透明度） |
| `--accent-dim` | 半透明主色（约 50% 透明度） |

### Warn / Yellow（固定，不随主题变）

| Token | 默认值 | 用途 |
|-------|--------|------|
| `--warn` | `#ffc107` | 警告色文字/边框 |
| `--warn-bg` | `#2a2a10` | 警告按钮背景 |
| `--warn-bg-hover` | `#3a3a18` | 警告按钮 hover 背景 |
| `--warn-subtle` | `rgba(255,193,7,0.08)` | 警告区域淡背景 |

### Danger / Red（固定）

| Token | 默认值 | 用途 |
|-------|--------|------|
| `--danger` | `#f44336` | 危险色文字/边框 |
| `--danger-bg` | `#2a2020` | 危险按钮/区域背景 |
| `--danger-border` | `#4a3030` | 危险边框 |
| `--danger-text` | `#774444` | 禁用/无效状态的淡红文字 |
| `--danger-subtle` | `rgba(244,67,54,0.08)` | 危险区域淡背景 |
| `--danger-subtle-border` | `rgba(244,67,54,0.25)` | 危险区域淡边框 |

### Info / Blue（仅 DevConsole，固定）

| Token | 默认值 | 用途 |
|-------|--------|------|
| `--info` | `#4a9eff` | 调试信息蓝 |
| `--info-subtle` | `rgba(74,158,255,0.08)` | 调试背景 |
| `--info-soft` | `rgba(74,158,255,0.15)` | 调试背景（稍深） |

### 其他

| Token | 默认值 | 用途 |
|-------|--------|------|
| `--scrollbar-thumb` | `rgba(140,140,140,0.3)` | 滚动条滑块色 |
| `--font-mono` | `'Consolas', 'Courier New', monospace` | 等宽字体栈 |

---

## 当前主题列表

| ID | 名称 | Accent 色 | data-theme 值 |
|----|------|-----------|---------------|
| `green` | Terminal Green | `#4caf50` | 无（默认） |
| `cobalt` | Cobalt | `#4a9eff` | `cobalt` |
| `amber` | Amber | `#ff9800` | `amber` |
| `violet` | Violet | `#9c27b0` | `violet` |
| `cyan` | Cyan | `#00bcd4` | `cyan` |

---

## 添加新主题

在 `src/styles/global.css` 末尾添加：

```css
[data-theme="my-theme"] {
  --accent:          #xxxxxx;
  --accent-bg:       #xxxxxx;   /* 深色背景，约原色亮度的 25% */
  --accent-bg-hover: #xxxxxx;   /* 比 accent-bg 略亮 */
  --accent-subtle:   rgba(r, g, b, 0.08);
  --accent-soft:     rgba(r, g, b, 0.12);
  --accent-dim:      rgba(r, g, b, 0.5);
}
```

然后在 `src/composables/useTheme.ts` 的 `THEMES` 数组中添加一条：

```typescript
{ id: 'my-theme', nameKey: 'theme.my_theme', accent: '#xxxxxx' },
```

并在 `locale.csv` 添加 `theme.my_theme` 的翻译键。

---

## 主题切换 API

```typescript
import { useTheme, THEMES } from '../../composables/useTheme'

const { currentTheme, setTheme, THEMES } = useTheme()

// 切换主题
setTheme('cobalt')

// 读取当前主题
console.log(currentTheme.value)  // 'cobalt'

// 遍历所有主题
THEMES.forEach(t => console.log(t.id, t.accent))
```

主题切换 UI 位于设置弹窗（`SaveModal.vue`）顶部的"界面主题"区块。

---

## 编写规范（新功能必须遵守）

1. **禁止写颜色字面量**：不允许在 `<style>` 中直接写 `#4caf50`、`rgba(76,175,80,...)` 等，一律用 token
2. **主色必须用 `var(--accent)`**：不得用 `var(--accent-green)` 等旧别名（别名只为兼容旧代码保留）
3. **按钮状态模式**：
   - 可用（ok）：`background: var(--accent-bg); border-color: var(--accent); color: var(--accent);`
   - hover：`background: var(--accent-bg-hover);`
   - 不可用（lack）：`background: var(--danger-bg); border-color: var(--danger-border); color: var(--danger-text); cursor: not-allowed;`
4. **Toast 颜色参数**：用 `'var(--accent)'` / `'var(--danger)'` / `'var(--warn)'`，不用字面量
5. **允许保留的局部微调色**：`#ddd`、`#ccc`、`#eee`、`rgba(30,30,30,0.8)` 等背景透明度效果不涉及主题的颜色可保留字面量
