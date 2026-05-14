---
name: gtnh-idle-git-commit-rule
description: gtnh-idle 项目：每次完成工作后必须询问用户是否需要 git commit
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c4fa4bcd-b737-4dea-938b-bdba04dd3524
---

## 工作完成后的 Git 提交规则

**每次完成功能、修复 bug、重构等工作后，必须主动询问用户是否需要 git commit。**

### Why:
- 之前发生了 locale.csv 被错误覆盖、无法回档的情况
- 没有提交的工作在意外发生时无法恢复
- 养成习惯，避免"改了很多但没提交，结果出问题"的局面

### How to apply:
- 完成任何有意义的改动后（不区分大小），在回复末尾询问："需要 git commit 吗？"
- 用户说需要，才执行 git commit；先问 commit message 要写什么，确认后再提交
- 如果用户明确说"先不用"、"之后再说"，则不提交但记住下次继续问
- 提交信息以功能为中心：描述改了什么，不描述怎么改（代码本身会说明）
- 涉及配置文件改动的，必须在 commit message 里说明（如 `locale.csv 补全 65 个缺失翻译`）