# CSV 工具链

---

## 技术部分

### 工作原理

```
tables/*.csv + schemas/*.schema.json
        ↓  (npm run csv)
src/config/*.json
```

1. `schemas/csv-manifest.json` 定义每张表的 schema 路径和输出路径
2. 读取 CSV 后按 schema 校验字段，输出 JSON 到 `src/config/`
3. `buildShowCond()` 在 `db.ts` 中将 `showCondType + showCondPara` 合并为 `Condition` 对象

### 命令

```bash
npm run csv              # 一键导出全部表
npm run csv -- <表名>     # 导出单表（前缀匹配）
```

### 新增配置表

1. 在 `schemas/csv-manifest.json` 添加一行
2. 在 `schemas/` 下创建对应的 `.schema.json`
3. 运行 `npm run csv -- <表名>`

### 输出文件

| CSV 文件 | 生成 JSON |
|----------|-----------|
| resources.csv | config/resources.json |
| recipes.csv | config/recipes.json |
| machines.csv | config/machines.json |
| tasks.csv | config/tasks.json |
| chapters.csv | config/chapters.json |
| techs.csv | config/techs.json |
| tech_trees.csv | config/tech_trees.json |
| panels.csv | config/panels.json |
| dimensions.csv | config/dimensions.json |
| biomes.csv | config/biomes.json |
| biome_nodes.csv | config/biome_nodes.json |
| locale.csv | config/locales/zh.json + en.json |

---

## 策划部分

### 配置流程

1. 用 Excel 打开 `tables/*.csv`（注意：保存时选 **CSV UTF-8**）
2. 修改/新增配置行
3. 通知程序运行 `npm run csv` 生成 JSON

### 重要约束

- **禁止手动编辑** `src/config/*.json`（会被覆盖）
- 所有游戏内容（资源、配方、机器、任务等）必须通过 CSV 配置
- 新增行时确保 `id` 唯一
- JSON 格式的列（如 `inputs`、`outputs`、`buildCost`）在 CSV 中是字符串，格式必须合法

### i18n key 新增流程

1. 程序在代码中写 `t('xxx.yyy')`（不存在会显示 key 本身作为回退）
2. dev 模式下会自动把缺失的 key 补入 `tables/locale.csv`（zh/en 留空）
3. 策划补齐翻译后，程序运行 `npm run csv -- locale` 生成 JSON

### CSV 保存注意事项

Excel 保存 CSV 时务必选择 **"CSV UTF-8（逗号分隔）(*.csv)"**，否则中文会乱码。