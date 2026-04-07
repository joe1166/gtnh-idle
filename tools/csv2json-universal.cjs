#!/usr/bin/env node
// ============================================================
// 通用 CSV → JSON 配置转换工具  v2
// ============================================================
//
// 【用法】
//   node tools/csv2json-universal.cjs --schema <schema.json> --input <CSV文件> [--output <JSON文件>] [--dry]
//
// 【Schema 字段类型】
//
//   基本类型（直接写字符串）：
//     "string"   — 字符串（空值整个字段省略）
//     "number"   — 数值（空值整个字段省略）
//     "boolean"  — 布尔（"true"/"false"）
//
//   数组类型（每个 CSV 格子是一串分隔值）：
//     { "type": "array", "sep": "|", "item": <任意类型> }
//     例：iron_ore:2|copper_wire:4
//
//   紧凑对象（一个格子里按位置编码多个字段，fields 是有序数组）：
//     { "type": "object", "sep": ":", "fields": [{"name":"...", "type":"..."}],
//       "sparse": true,       // 省略空值子字段（不写入 JSON）
//       "omitIfEmpty": true   // 全部子字段都为空时整个键省略
//     }
//     例：eu_per_sec:32
//
//   以上三种可以互相嵌套，例如「数组 of 紧凑对象」：
//     { "type": "array", "sep": "|",
//       "item": { "type": "object", "sep": ":", "fields": [
//         {"name":"resourceId","type":"string"},
//         {"name":"amount","type":"number"}
//       ]}
//     }
//     CSV 格子：iron_plate:8|wrench:1
//
// ============================================================

'use strict'

const fs   = require('fs')
const path = require('path')

// ─── CSV 解析 ────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseLine(lines[0]).map(h => h.trim())
  return lines.slice(1).map(line => {
    const values = parseLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim() })
    return row
  })
}

function parseLine(line) {
  const fields = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else { inQuotes = !inQuotes }
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}

// ─── 值解析（递归）────────────────────────────────────────────────────────────
//
// 入参 raw  : 原始字符串（CSV 格子内容）
// 入参 type : Schema 字段类型描述（string 或 object）
// 返回值   : 解析后的 JS 值；undefined 表示该字段应被省略

function parseValue(raw, type) {
  // ── 基本类型 ──
  if (typeof type === 'string') {
    if (raw === '' || raw == null) return undefined
    if (type === 'number')  return Number(raw)
    if (type === 'boolean') return raw.toLowerCase() === 'true'
    return raw // string
  }

  // ── 数组类型 ──
  if (type.type === 'array') {
    if (raw == null || raw.trim() === '') return []
    return raw.split(type.sep)
              .map(part => parseValue(part.trim(), type.item))
              .filter(v => v !== undefined && v !== '')
  }

  // ── 紧凑对象类型 ──
  if (type.type === 'object') {
    if (raw == null || raw.trim() === '') {
      if (type.omitIfEmpty) return undefined
      return {}
    }

    const parts  = raw.split(type.sep)
    const obj    = {}
    const fields = type.fields  // 有序数组 [{name, type}]

    for (let i = 0; i < fields.length; i++) {
      const { name, type: ft } = fields[i]
      const part  = parts[i] ?? ''
      const value = parseValue(part.trim(), ft)

      // sparse 模式：跳过空/undefined/空数组
      if (type.sparse) {
        if (value === undefined || value === '') continue
        if (Array.isArray(value) && value.length === 0) continue
      }

      if (value !== undefined) obj[name] = value
    }

    if (type.omitIfEmpty && Object.keys(obj).length === 0) return undefined
    return obj
  }

  return undefined
}

// ─── 行对象构建 ───────────────────────────────────────────────────────────────
// 将 CSV 一行（{列名: 原始值}）按 schema.fields 构建成嵌套 JSON 对象

function buildRow(row, fields) {
  const obj = {}
  for (const [key, type] of Object.entries(fields)) {
    const raw   = row[key] ?? ''
    const value = parseValue(raw, type)

    if (value === undefined) continue
    if (value === '') continue
    obj[key] = value
  }
  return obj
}

// ─── Locale 模式（特殊处理） ──────────────────────────────────────────────────

function convertLocale(schema, csvText) {
  const rows   = parseCSV(csvText)
  const keyCol = schema.keyColumn || 'key'
  const result = {}
  for (const lang of Object.keys(schema.outputs)) {
    const langObj = {}
    for (const row of rows) {
      if (row[keyCol] && (row[lang] ?? '') !== '') {
        langObj[row[keyCol]] = row[lang]
      }
    }
    result[lang] = langObj
  }
  return result
}

// ─── 主转换 ───────────────────────────────────────────────────────────────────

function convert(schema, csvText) {
  if (schema.root === 'locale') return convertLocale(schema, csvText)
  return parseCSV(csvText).map(row => buildRow(row, schema.fields))
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '--help') {
    console.log([
      '用法: node tools/csv2json-universal.cjs --schema <schema.json> --input <input.csv> [选项]',
      '',
      '选项:',
      '  --output <path>   覆盖 schema 中的 output 路径',
      '  --dry             不写文件，结果输出到 stdout',
    ].join('\n'))
    return
  }

  let schemaPath, inputPath, outputPath, dry = false

  for (let i = 0; i < args.length; i++) {
    if      (args[i] === '--schema') schemaPath = args[++i]
    else if (args[i] === '--input')  inputPath  = args[++i]
    else if (args[i] === '--output') outputPath = args[++i]
    else if (args[i] === '--dry')    dry = true
  }

  if (!schemaPath || !inputPath) {
    console.error('错误: --schema 和 --input 是必须的')
    process.exit(1)
  }

  const schema  = JSON.parse(fs.readFileSync(path.resolve(schemaPath), 'utf-8'))
  const csvText = fs.readFileSync(path.resolve(inputPath), 'utf-8')
  const result  = convert(schema, csvText)

  if (schema.root === 'locale') {
    for (const [lang, obj] of Object.entries(result)) {
      const outPath = outputPath || schema.outputs[lang]
      if (!outPath) continue
      const json = JSON.stringify(obj, null, 2)
      if (dry) {
        console.log(`\n=== ${lang} ===\n` + json)
      } else {
        fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true })
        fs.writeFileSync(path.resolve(outPath), json, 'utf-8')
        console.log(`已写入: ${outPath}（${Object.keys(obj).length} 个键）`)
      }
    }
  } else {
    const outPath = outputPath || schema.output
    if (!outPath) {
      console.error('错误: 未指定输出路径（用 --output 或在 schema 中设置 output）')
      process.exit(1)
    }
    const json = JSON.stringify(result, null, 2)
    if (dry) {
      console.log(json)
    } else {
      fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true })
      fs.writeFileSync(path.resolve(outPath), json, 'utf-8')
      console.log(`已写入: ${outPath}（${result.length} 条记录）`)
    }
  }
}

main()
