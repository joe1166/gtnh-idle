---
name: 不使用 preview 工具验证 UI
description: gtnh-idle 项目的 preview_start 因工作目录问题无法启动，不要尝试用 preview_* 工具验证 UI
type: feedback
originSessionId: bd1398a1-dd0a-4e78-85ce-96fca082cf6d
---
preview_start 工具始终以 D:\claudecode（而非 D:\claudecode\gtnh-idle）作为工作目录运行，导致找不到 package.json 而失败，且无法通过 launch.json 的任何配置绕过。

**Why:** 工作目录硬编码，cwd/--prefix/bash -c 等方式均无效。

**How to apply:** 对 gtnh-idle 项目的所有 UI 变更，只需跑 `npm run csv` 和 `npm run type-check` 验证数据层和类型层正确即可，不再尝试启动 preview 服务器。如需视觉确认，告知用户自行在浏览器查看。
