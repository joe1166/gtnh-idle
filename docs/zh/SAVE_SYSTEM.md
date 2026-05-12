# 存档系统

---

## 技术部分

### 存档位置

- **存储**：`localStorage`，key `gtnh_idle_save`
- **版本**：`version: "6.0.0"`
- **格式**：JSON

> **早期开发策略**：版本号不符时直接判为不兼容，不做迁移。版本号升级时删除旧的 migrate 逻辑，不维护向下兼容。

### useSaveLoad composable

```typescript
import { useSaveLoad } from '../composables/useSaveLoad'

const { save, load, exportSave, importSave, deleteSave } = useSaveLoad()

save()          // 立即存档
load()          // 读取并解析，返回 LoadResult
exportSave()    // 返回 base64 存档码
importSave(str) // 导入并刷新页面（成功返回 true）
deleteSave()    // 删除 localStorage 存档（不刷新页面）
```

`LoadResult` 结构：

```typescript
interface LoadResult {
  success: boolean      // 成功加载存档
  incompatible: boolean // 版本不兼容（version !== SAVE_VERSION）
  offlineSeconds: number
}
```

版本不兼容时：`incompatible=true`，不加载任何状态，调用方负责展示提示弹窗。

### 存档内容

```json
{
  "version": "6.0.0",
  "savedAt": 1748000000000,
  "state": {
    "game": { "tick": 100 },
    "inventory": { "items": {...}, "caps": {...}, "totalProduced": {...} },
    "power": { "batteryCurrentEU": 500, "batteryCapacityEU": 1000 },
    "machines": { "instances": [...] },
    "progression": { "currentChapterId": 1, "chapterCompleted": false, "era": "stone" },
    "tasks": { "completedIds": ["build_furnace", "gather_wood"] },
    "tech": { "researchedIds": [] },
    "world": { "discoveredBiomeIds": [...], "currentBiomeId": "plains", ... },
    "tools": { "levels": { "stone_axe": 1, "stone_pickaxe": 0 } },
    "mine": {
      "grid": [...],
      "stamina": 42,
      "entered": true,
      "seed": 1748123456789,
      "prospectorResult": null,
      "prospectorCooldown": 0,
      "sessionLoot": { "coal": 6 },
      "exitDialogOpen": false
    },
    "explore": {
      "mapId": "pyramid",
      "rows": 9,
      "cols": 9,
      "rooms": [...],
      "connections": [...],
      "cellRoomMap": { "8,4": "room_1", ... },
      "currentRoomId": "room_1",
      "entered": false,
      "seed": 1748987654321,
      "visitedRoomIds": ["room_1"],
      "sessionLoot": {},
      "exitDialogOpen": false
    }
  }
}
```

`progression.era` 持久化游戏时代（`'stone' | 'steam' | 'lv'`），初始值 `'stone'`。

### 不兼容存档处理

版本不符时 `App.vue` 展示 `IncompatibleSaveModal`，游戏循环不启动：

```typescript
// App.vue onMounted
const saveResult = load()
if (saveResult.incompatible) {
  showIncompatibleModal.value = true
  return  // 不 start() 游戏循环
}
```

弹窗只有一个按钮"开始新游戏"，走 `useNewGame().startNewGame()`。

### useNewGame composable

统一的"开始新游戏"接口，所有触发点都应调用此 composable，不得直接调用 `deleteSave` + `reload`：

```typescript
import { useNewGame } from '../composables/useNewGame'

const { startNewGame } = useNewGame()
startNewGame()  // deleteSave() + location.reload()
```

当前使用位置：
- `IncompatibleSaveModal.vue` — 不兼容存档提示
- `SaveModal.vue` — 设置弹窗内"删除存档"确认

### 版本历史（仅供参考，已废弃迁移）

| 版本      | 主要变更                                      |
| --------- | --------------------------------------------- |
| 1.0.0     | 初始版本，发电机在 powerStore                 |
| 2.0.0     | 发电机迁移到 machineStore                     |
| 3.0.0     | `overclock` → `selectedVoltage`               |
| 4.0.0     | 新增工具系统                                  |
| 4.1.0     | 新增矿洞系统                                  |
| **5.0.0** | **新增 Era 游戏时代系统；废弃所有旧迁移逻辑** |
| **6.0.0** | **遗迹探索二阶段：房间字段重构为 `layoutType + type`，新增剧情/战斗配置表** |

### 自动存档

- 每 30 秒自动存档（tick % 30 === 0）
- 关键操作时立即存档（发现新群系等）

---

## 关键设计

### 版本兼容策略

早期开发阶段不维护向下兼容。升级版本号时：
1. 将 `SAVE_VERSION` 改为新版本号
2. 在旧版本历史表格中补记
3. **不添加新的 migrate 分支**

### 离线进度

超过 10 秒的离线间隔，`simulate()` 以 100x 速度模拟，最大 12 小时。结束后显示 OfflineModal 告知收益。

**注意**：`load()` 后会强制重置 `isSimulatingOffline=false` 和 `offlineSimProgress=0`，避免上一次游戏在离线模拟中途退出时残留状态导致遮罩无法关闭。

### 遗迹探索（二阶段）补充

- `explore` 状态已纳入存档，包含 `mode/hp/rooms/connections/sessionLoot` 等会话字段。
- 当前策略不做旧版本迁移；遗迹二阶段上线后通过 `SAVE_VERSION=6.0.0` 触发旧档不兼容新开档。
