# 技术总览

> 技术开发必读。策划配置部分见各模块文档。

---

## 1. 技术栈

- **前端框架**：Vue 3（`<script setup lang="ts">` Composition API）
- **状态管理**：Pinia
- **类型系统**：TypeScript
- **构建工具**：Vite
- **样式**：原生 CSS + CSS 变量（无预处理器）

---

## 2. 目录结构

```
gtnh-idle/
├── tables/                    # 配置源（CSV，策划用表格编辑器维护）
├── schemas/                   # CSV→JSON schema + csv-manifest.json
│   └── csv-manifest.json      # 新增表只需改这里
├── src/
│   ├── config/               # 由 CSV 生成（勿手动编辑）
│   │   └── locales/          # zh.json / en.json
│   ├── data/
│   │   ├── types.ts          # 所有 TypeScript 接口定义
│   │   ├── db.ts             # 统一数据访问（所有配置的读写入口）
│   │   ├── conditions.ts     # 中心化条件系统 evaluateCondition()
│   │   ├── panelConfig.ts    # 面板定义
│   │   └── i18n.ts           # t() 运行时
│   ├── stores/               # Pinia store
│   │   ├── gameStore.ts      # 游戏时间 / tick 计数
│   │   ├── inventoryStore.ts # 物品仓库
│   │   ├── powerStore.ts     # 电池 / EU 电力
│   │   ├── machineStore.ts   # 机器+发电机实例
│   │   ├── taskStore.ts      # 任务系统
│   │   ├── progressionStore.ts # 章节进度
│   │   ├── techStore.ts      # 科技研究
│   │   ├── worldStore.ts     # 探索节点
│   │   ├── toolStore.ts      # 工具升级
│   │   └── mineStore.ts      # 矿洞探索小游戏
│   ├── composables/
│   │   ├── useGameLoop.ts    # initGame + tick 主循环
│   │   ├── useSaveLoad.ts    # 存档/读档
│   │   ├── useOfflineProgress.ts # 离线模拟
│   │   ├── useToast.ts        # Toast 通知
│   │   └── useDevConsole.ts  # 开发者后台
│   └── components/
│       ├── layout/           # TopBar / SideNav
│       ├── modals/           # OfflineModal / SaveModal / StatsModal / DevConsole
│       ├── mine/             # MineOverlay / MineGrid / MineProspector（独立全屏小游戏）
│       └── panels/           # WorldPanel / SteamPanel / PowerPanel / ...
└── docs/                      # 文档目录（本文件索引所有模块）
```

---

## 3. 核心设计约定

### 3.1 数据边界

- **静态配置数据**：`src/data/db.ts` 统一访问，`src/config/*.json` 由 CSV 生成
- **运行时状态**：Pinia Store（配置 `showCond` 可见性后，数据层不存储任何配置）
- **禁止**：在 `src/config/` 下手动编辑 JSON

### 3.2 发电机是特殊机器

- 共用 `machineStore`，通过 `category: 2` 区分发电机 vs `category: 1` 处理机器
- 配方匹配与机器类型无关，发电机不使用配方系统

### 3.3 数字格式化

使用 `fmt()` 函数：`1000 → 1k`，`1e6 → 1M`

### 3.4 存档版本管理

- 存档版本 `SAVE_VERSION` 定义在 `src/data/version.ts`
- 应用版本 `APP_VERSION` 同在一个文件
- 版本不兼容时不做迁移，直接走新开档流程
- 存档结构：`{ version, savedAt, state: { game, inventory, power, machines, progression, tasks, tech, world, tools, mine?, explore? } }`
- `mine`、`explore` 由各自 store 状态持久化；版本不一致时不兼容

---

## 4. 关键设计决策

### 配方匹配机制

配方能否在某机器上执行，取决于 **role + tier**，不依赖枚举 ID：

```
machine.role === recipe.requiredRole && machine.tier >= recipe.requiredLevel
```

- 每个机器有 `role`（如 `furnace`、`assembler`）和 `tier`（1/2/3...）
- 每个配方有 `requiredRole` 和 `requiredLevel`
- 机器 tier 高可以执行低等级配方，反之不行

### 中心化条件系统

所有"是否满足条件"统一调用 `evaluateCondition(cond)`：
- `chapter` / `task` / `tech` / `resource` / `resource_ever` / `tool`
- 新增条件类型只需改 `src/data/conditions.ts` 一处
- 见 [CONDITIONS.md](./CONDITIONS.md)

### timed 节点不自动给资源

`tick()` 只设 `done: true`，用户主动点领取才给资源，防止中途退出丢进度。

---

## 5. 快速索引

| 主题           | 文件                                       |
| -------------- | ------------------------------------------ |
| CSV 工具链     | [CSV_TOOLCHAIN.md](./CSV_TOOLCHAIN.md)     |
| 中心化条件系统 | [CONDITIONS.md](./CONDITIONS.md)           |
| i18n 本地化    | [I18N.md](./I18N.md)                       |
| 配表字段参考   | [DATA_REFERENCE.md](./DATA_REFERENCE.md)   |
| Pinia Stores   | [STORES.md](./STORES.md)                   |
| 游戏主循环     | [GAME_LOOP.md](./GAME_LOOP.md)             |
| 探索系统       | [WORLD_SYSTEM.md](./WORLD_SYSTEM.md)       |
| 遗迹探索小游戏 | [EXPLORE_SYSTEM.md](./EXPLORE_SYSTEM.md)   |
| 矿洞探索小游戏 | [MINE_SYSTEM.md](./MINE_SYSTEM.md)         |
| 制作系统       | [CRAFTING_SYSTEM.md](./CRAFTING_SYSTEM.md) |
| 面板系统       | [PANEL_SYSTEM.md](./PANEL_SYSTEM.md)       |
| 存档系统       | [SAVE_SYSTEM.md](./SAVE_SYSTEM.md)         |
| UI 主题系统    | [THEMING.md](./THEMING.md)                 |
| 开发者工具     | [DEV_TOOLS.md](./DEV_TOOLS.md)             |
