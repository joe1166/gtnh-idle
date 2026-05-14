---
name: gtnh-idle-version-management
description: gtnh-idle 版本管理规则：所有版本（应用版本、存档版本）集中在 src/data/version.ts，每次升级必须询问用户，不可自行升级
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c4fa4bcd-b737-4dea-938b-bdba04dd3524
---

## 版本管理规则

### 版本管理文件
`src/data/version.ts` — 所有版本号集中管理，包括：
- `APP_VERSION` — 应用版本（package.json 也同步更新）
- `SAVE_VERSION` — 存档格式版本（useSaveLoad.ts 引用）

### 初始版本
- 应用版本：`0.1.0`
- 存档版本：`6.0.0`

### 升级规则
**任何版本的升级都必须先询问用户，不可自行升级。** 包括：
- 应用版本 `0.1.0` → `0.1.1`
- 存档版本 `6.0.0` → `7.0.0`
- 任何其他版本号

### Why
- 版本号变更是不可逆的重大操作
- 用户需要决定何时升级、升到哪个版本
- 防止因版本判断错误导致的存档兼容问题