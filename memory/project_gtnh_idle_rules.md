---
name: gtnh-idle 项目协作规范
description: gtnh-idle 项目专用的协作规则，仅适用于 d:\claudecode\gtnh-idle 目录
type: project
---

仅适用于 `d:\claudecode\gtnh-idle` 项目，其他项目不受约束。

**Why:** 用户希望保持代码与内容配置、翻译工作分离，避免 AI 越权修改游戏内容。

**规则：**

1. **先讨论后动手**：实现新功能前，先分析需要改什么、怎么改，告知用户并得到确认后再开始写代码。

2. **所有 UI 文字走多语言**：Vue 组件中所有面向玩家显示的文字必须通过 `t('key')` 调用，禁止硬编码任何语言文字。

3. **不自己改配置**：不修改 `src/config/` 下的 JSON 文件（如 recipes.json、machines.json、chapters.json 等），只提供必要的示例格式供用户参考。

4. **不自己翻译多语言**：不往 `src/config/locales/zh.json` 或 `en.json` 里添加翻译内容，只在代码中使用 key，locale 文件由用户自己维护。en.json 同样不需要维护。

5. **只处理代码和必要示例**：实现功能时只写 TypeScript/Vue 代码，配置文件只提供格式示例（如新字段的 JSON 结构），不填充实际游戏内容。

**How to apply:** 每次开始新功能时，先走"讨论→确认→编码"流程。写 Vue 模板时，文字内容一律用 `t()` 包裹，locale key 在 zh.json 中的值留给用户填写。

**调试方法：** Debug 时用 `console.log` 加日志，在 `machineStore.ts` 的 `buildMachine`/`toggleMachine`/`tick`、CraftingPanel 的事件处理函数等关键节点输出状态变量。浏览器控制台（F12）查看日志来定位问题。

**临时重置存档：** 如果游戏卡在离线模拟遮罩不动，可以在控制台执行 `localStorage.removeItem('gtnh_idle_save'); location.reload()` 清除存档后重新开始。
