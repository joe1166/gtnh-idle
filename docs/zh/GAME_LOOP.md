# 游戏主循环

---

## 技术部分

### 初始化流程（onMounted）

```
initGame()
  ├── load()          尝试从 localStorage 读取存档
  ├── start()         启动 tick 循环
  └──离线>10s?
        ├── simulate()  100x 离线模拟
        └── show OfflineModal
```

### Tick 执行顺序（每秒）

```
1. gameStore.tick()          时间+1
2. steamStore.beginTick()     重置蒸汽池（供机器 Tick 阶段写入）
3. machineStore.tick()        发电（+EU）+ 消耗（-EU）+ 配方推进
4. powerStore.tick()          过载检测
5. progressionStore.tick()    任务检查 + 章节解锁
6. worldStore.tick()          timed 节点进度更新
7. mineStore.tick()           仅 entered=true 时推进矿洞状态
8. exploreStore.tick(1000)    仅 entered=true 时推进遗迹自动战斗
9. (每30秒) save()            自动存档
```

### 存档格式

```json
{
  "version": "6.0.0",
  "savedAt": 1748000000000,
  "state": {
    "game": {},
    "inventory": {},
    "power": {},
    "machines": {},
    "progression": {},
    "tasks": {},
    "tech": {},
    "world": {},
    "tools": {}
  }
}
```

当前版本为 `6.0.0`，版本不一致时不做迁移，直接进入不兼容存档流程（新开档）。

---

## 关键设计说明

### timed 节点不自动给资源

`tick()` 只设 `done: true`，用户主动点领取才给资源。这样倒计时中途退出也不会丢进度。

### 离线模拟

超过 10 秒的离线：`simulate()` 以 100x 速度模拟，最大模拟时长 24 小时。结束后显示 OfflineModal 告知收益。

### 自动存档

每 30 秒自动存档一次。关键操作（解锁新面板等）也会立即存档。
