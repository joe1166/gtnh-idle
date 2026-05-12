# GTNH Idle — 文档总览

> 游戏核心文档索引。每个模块包含技术开发部分和策划配置部分。

---

## 文档索引

| 模块 | 技术文档 | 策划文档 |
|------|----------|----------|
| 00 - 总览 | [TECH_OVERVIEW.md](./zh/TECH_OVERVIEW.md) | — |
| 01 - CSV 工具链 | [CSV_TOOLCHAIN.md](./zh/CSV_TOOLCHAIN.md) | — |
| 02 - 条件系统 | [CONDITIONS.md](./zh/CONDITIONS.md) | [CONDITIONS.md](./zh/CONDITIONS.md)（策划部分） |
| 03 - i18n 本地化 | [I18N.md](./zh/I18N.md) | [I18N.md](./zh/I18N.md)（策划部分） |
| 04 - 配表参考 | [DATA_REFERENCE.md](./zh/DATA_REFERENCE.md) | [DATA_REFERENCE.md](./zh/DATA_REFERENCE.md)（策划部分） |
| 05 - Stores | [STORES.md](./zh/STORES.md) | — |
| 06 - 游戏主循环 | [GAME_LOOP.md](./zh/GAME_LOOP.md) | — |
| 07 - 探索系统 | [WORLD_SYSTEM.md](./zh/WORLD_SYSTEM.md) | [WORLD_SYSTEM.md](./zh/WORLD_SYSTEM.md)（策划部分） |
| 07A - 遗迹探索小游戏 | [EXPLORE_SYSTEM.md](./zh/EXPLORE_SYSTEM.md) | [EXPLORE_SYSTEM.md](./zh/EXPLORE_SYSTEM.md)（策划部分） |
| 08 - 制作系统 | [CRAFTING_SYSTEM.md](./zh/CRAFTING_SYSTEM.md) | [CRAFTING_SYSTEM.md](./zh/CRAFTING_SYSTEM.md)（策划部分） |
| 09 - 面板系统 | [PANEL_SYSTEM.md](./zh/PANEL_SYSTEM.md) | [PANEL_SYSTEM.md](./zh/PANEL_SYSTEM.md)（策划部分） |
| 10 - 存档系统 | [SAVE_SYSTEM.md](./zh/SAVE_SYSTEM.md) | — |
| 11 - 开发流程规范 | [DEV_WORKFLOW.md](./zh/DEV_WORKFLOW.md) | — |
| X - 踩坑记录 | [DEV_PITFALLS.md](./zh/DEV_PITFALLS.md) | — |

---

## 项目信息

- **技术栈**：Vue 3 (`<script setup lang="ts">`) + Pinia + TypeScript + Vite
- **存档**：localStorage，key `gtnh_idle_save`，版本 `6.0.0`
- **游戏循环**：探索采集 → 冶炼/加工 → 制作机器 → 发电 → 自动化生产 → 推进章节

## 核心概念

### 中心化条件系统

所有配置表的显示/解锁条件统一使用 `showCondType + showCondPara` 字段，通过 `evaluateCondition()` 判断。支持：chapter、task、tech、resource、resource_ever、tool 六种条件类型。

### 瞬时机器

`instantMode=1` 的机器（目前只有 hand_assembly）完全由 UI 层驱动，点击制作按钮直接消耗材料并产出，不经过 tick 循环。

### 资源分类

仓库面板按 `raw.mat.prod.misc` 四大类分组显示，category 格式为 `大类.小类`（如 `raw.wood`），通过 `topCategory()` 提取顶层分类。

### 工具系统

工具按 type 分组（stone_axe、stone_pickaxe、prospector），每种 type 有多个等级（level=0/1/2...）。探矿仪需满足 `resource_ever:basic_circuit` 才显示。

### 超频

机器可选择高于配方所需电压等级运行，有损超频（overclock=1）每档×2速度，无损超频（overclock=2）每档×4速度，同时 EU 消耗按 ×4^档数增长。
