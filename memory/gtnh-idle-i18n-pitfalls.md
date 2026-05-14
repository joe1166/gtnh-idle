---
name: gtnh-idle-i18n-pitfalls
description: gtnh-idle 多语言系统的坑和常用操作记录
metadata:
  type: reference
  originSessionId: c4fa4bcd-b737-4dea-938b-bdba04dd3524
---

## 多语言文件结构

```
tables/locale.csv          # 源文件（策划维护）
src/config/locales/zh.json # 由 csv2json-universal.cjs 导出
src/config/locales/en.json
schemas/locale.schema.json # 控制导出列
tools/i18n-add.cjs         # 批量添加/更新多语言 key
tools/csv2json-universal.cjs # CSV → JSON 转换（所有配置表通用）
tools/sort-locale.cjs      # 仅排序 locale.csv（按前缀分组）
```

CSV 格式：`key,zh,en`，第一行是表头，**必须带 BOM**（写入时 `fs.writeFileSync(csvPath, '﻿' + out.join('\n'))`）。

---

## 坑 1：BOM 导致列错位

### 现象
CSV 首行有 BOM (`﻿` = U+FEFF)，`parseCSV()` 没去掉它，导致 header 变成 `﻿key,zh,en`。解析时第一列 key 读到了 BOM 字符，内容全部错位一列。

### 后果
- `locale.csv` 里有翻译，但导出到 `zh.json` / `en.json` 时全部错位
- 中文 key 变成英文值（如 `world.node.pyramid: "Pyramid"` 而非 `"金字塔"`）
- 用户看到中文全部显示成英文

### 修复
`csv2json-universal.cjs` 的 `parseCSV()` 函数开头加上：

```js
function parseCSV(text) {
  const cleanText = text.replace(/^﻿/, '') // 去掉 BOM
  const lines = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  // ...
}
```

---

## 坑 2：i18n-add.cjs 写文件时丢 BOM

### 现象
`i18n-add.cjs` 写入 `tables/locale.csv` 后，BOM 丢失，导致下次读取时 `csv2json-universal.cjs` 再次踩坑。

### 原因
写入时没有手动加 BOM：
```js
// 错误
fs.writeFileSync(CSV_PATH, out.join('\n') + '\n', 'utf-8')

// 正确
fs.writeFileSync(CSV_PATH, '﻿' + out.join('\n') + '\n', 'utf-8')
```

---

## 坑 3：CSV 解析不处理引号内的逗号

### 现象
如果多语言值里本身有逗号（如 `"你好,世界"`），简单 `line.split(',')` 会拆错。

### 当前实现（可接受）
目前 CSV 规范要求多语言值不能含逗号，所以暂时不需要处理。但如果未来有特殊字符，需升级 `parseLine()` 支持引号包裹。

---

## 常用操作

### 添加/更新多语言 key

```bash
# 单个
node tools/i18n-add.cjs "world.node.pyramid" "金字塔" "Pyramid"

# 批量（每3个一组）
node tools/i18n-add.cjs "key1" "中文1" "En1" "key2" "中文2" "En2"
```

### 导出 locale.csv → JSON

```bash
node tools/csv2json-universal.cjs --schema schemas/locale.schema.json --input tables/locale.csv
```

### 检查未翻译的 key

```js
// 检查 CSV 里中文为空的 key
node -e "
const fs = require('fs');
const content = fs.readFileSync('tables/locale.csv', 'utf-8').replace(/^﻿/, '');
const lines = content.split('\n');
const missing = [];
lines.slice(1).forEach(function(line){
  const parts = line.split(',');
  if(parts.length >= 3 && parts[1].trim() === '') missing.push(parts[0]);
});
console.log(missing.length === 0 ? '全部已翻译' : missing.join('\n'));
"
```

### 检查 zh.json 里值等于 key 的条目（未翻译特征）

```js
node -e "
const fs = require('fs');
const zh = JSON.parse(fs.readFileSync('src/config/locales/zh.json', 'utf-8'));
const en = JSON.parse(fs.readFileSync('src/config/locales/en.json', 'utf-8'));
const missing = [];
for(const [k,v] of Object.entries(zh)){
  if(v === k) missing.push(k);
}
if(missing.length === 0) console.log('全部已翻译');
else missing.forEach(function(k){ console.log(k, '->', en[k]); });
"
```

### 排序 locale.csv（按前缀分组）

```bash
node tools/sort-locale.cjs
```

---

## 原理说明

`csv2json-universal.cjs` 对 `locale.schema.json`（root=locale）有特殊处理：
- 不走 schema.fields 解析，直接按 `key,zh,en` 三列读取
- 遍历 `schema.outputs` 里定义的每个语言（zh/en），写入对应的 JSON 文件
- 所以只需要维护 `tables/locale.csv`，导出命令是统一的

---

## 相关文档

- [I18N.md](./I18N.md) — 项目多语言设计文档
- csv2json-universal.cjs — 通用 CSV 转换工具（所有配置表共用）