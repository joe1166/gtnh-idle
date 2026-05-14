# 配表修改规则（强制）

## 目标
避免“手改导出 JSON 被覆盖”的反复问题，统一配置改动流程。

## 唯一真源
- 只把 `tables/*.csv` 视为配置源（single source of truth）。
- `src/config/*.json` 是导出产物，禁止手工编辑。

## 标准流程
1. 修改 `tables/*.csv`（以及必要时的 `tables/locale.csv`）。
2. 执行 `npm run csv`，重新导出配置到 `src/config/*`。
3. 执行 `npm run build`（或至少 `npm run type-check`）验证。
4. 提交时同时包含 CSV 与导出后的 JSON 变更。

## 禁止项
- 禁止直接编辑 `src/config/*.json`。
- 禁止只改 JSON 不改 CSV。

## 适用范围
- 资源、奖励、工具、群系、遗迹、文案等所有配表改动。
