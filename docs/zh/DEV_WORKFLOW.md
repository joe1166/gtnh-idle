# 开发与文档更新规范

---

## 目标

每次功能开发后，技术文档必须同步更新，并且采用“增量更新”方式，避免重写历史文档结构。

---

## 文档更新原则

1. 不重写原有文档整文件。  
2. 只修改错误项（如版本号、字段名、流程顺序）和新增“本次改动”段落。  
3. 新功能模块优先新增独立文档（例如 `EXPLORE_SYSTEM.md`），再在索引文档中挂链接。  
4. 文档内容必须与当前代码一致，禁止写未来方案或未落地内容。  
5. 涉及配置表变更时，必须同步更新数据参考文档。  

---

## 必更文档范围（按改动触发）

- 改 `src/stores/*`：更新 `docs/zh/STORES.md`
- 改存档/版本：更新 `docs/zh/SAVE_SYSTEM.md`、`docs/zh/TECH_OVERVIEW.md`
- 改主循环：更新 `docs/zh/GAME_LOOP.md`
- 改配置表/schema/db 映射：更新 `docs/zh/DATA_REFERENCE.md`
- 新系统模块：新增 `docs/zh/*_SYSTEM.md`，并更新 `docs/README.md`、`docs/zh/TECH_OVERVIEW.md` 索引

---

## 自动化机制

项目提供两个脚本：

- `npm run docs:auto`：自动写入“技术文档更新记录”
- `npm run docs:check`：检查本次提交是否已更新文档记录，未更新则失败

并通过 `pre-commit` hook 自动执行，保证提交前完成最低文档同步。

---

## 使用方式

首次启用：

```bash
npm run hooks:install
```

日常开发无需手动操作，`git commit` 前会自动触发文档更新与检查。  

