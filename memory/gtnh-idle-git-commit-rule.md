---
name: gtnh-idle-git-commit-rule
description: gtnh-idle 项目 Git 提交规则（AI 自动判断完成度并提交）
metadata:
  node_type: memory
  type: feedback
---

## Git 提交规则（当前生效）

### 1) 自动提交策略
- 由 AI 判断：当一个功能/修复达到“完整可交付”状态时，自动执行提交。
- 不再默认每次都询问“是否提交”。

### 2) “完整可交付”判定标准
- 需求已实现（核心行为已落地）。
- 关键验证已通过（至少 `npm run build` 或 `npm run type-check` 通过，按任务类型选择）。
- 无已知阻塞问题。
- 改动范围清晰，提交内容可单独回滚。

### 3) Commit Message 规范
- 使用 Conventional Commits 前缀：
  - `feat:` 新功能
  - `fix:` 缺陷修复
  - `chore:` 工具链/文档/非功能性维护
- 建议格式：
  - `<type>: <模块或主题> <动作>`
  - 示例：`feat: explore loot tooltip and reward summary`

### 4) 何时仍需先问用户
- 涉及破坏性变更、版本升级策略、或用户明确要求“先别提交”时。
- 需要拆分多条提交但边界不明确时。

