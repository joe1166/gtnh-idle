#!/usr/bin/env node
/**
 * i18n-add.cjs — 添加或更新多语言 key
 *
 * 用法：
 *   node tools/i18n-add.cjs <key> <zh> <en>
 *   node tools/i18n-add.cjs <key> <zh> <en> [--csv locale.csv] [--dry]
 *
 * 示例：
 *   node tools/i18n-add.cjs "mine.stamina.eat" "吃" "Eat"
 *   node tools/i18n-add.cjs "panel.tool.title" "工具" "Tools"
 */

const fs   = require('fs')
const path = require('path')

const ROOT      = path.resolve(__dirname, '..')
const CSV_PATH  = path.join(ROOT, 'tables', 'locale.csv')
const SCHEMA    = path.join(ROOT, 'schemas', 'locale.schema.json')

function parseCSVLine(line) {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else { inQuotes = !inQuotes }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

function escapeCSV(s) {
  s = String(s ?? '')
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function getPrefix(key) {
  const idx = key.indexOf('.')
  return idx === -1 ? key : key.slice(0, idx)
}

function sortRowsPrefixGrouped(rows) {
  const byPrefix = new Map()
  for (const r of rows) {
    const k = String(r.key ?? '').trim()
    if (!k) continue
    const p = getPrefix(k)
    if (!byPrefix.has(p)) byPrefix.set(p, [])
    byPrefix.get(p).push(r)
  }
  const prefixes = Array.from(byPrefix.keys()).sort((a, b) => a.localeCompare(b))
  const sorted = []
  for (const p of prefixes) {
    const group = byPrefix.get(p)
    group.sort((a, b) => String(a.key).localeCompare(String(b.key)))
    sorted.push(...group)
  }
  return sorted
}

// ── CLI ────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

if (args.length < 3) {
  console.error('用法: node i18n-add.cjs <key> <zh> <en> [--dry]')
  console.error('示例: node i18n-add.cjs "panel.tool.title" "工具" "Tools"')
  process.exit(1)
}

const dryRun    = args.includes('--dry')
const cleanArgs  = args.filter(a => !a.startsWith('--'))
const [key, zh, en] = cleanArgs

if (!key || !zh || !en) {
  console.error('key / zh / en 三个参数都不能省略')
  process.exit(1)
}

if (dryRun) console.log('[dry-run] 仅预览，不写入文件')

// ── 读取 & 解析 CSV ────────────────────────────────────────────────

const rawText = fs.readFileSync(CSV_PATH, 'utf-8').replace(/^﻿/, '')
const lines   = rawText.split('\n').filter(l => l.trim())
const headers = parseCSVLine(lines[0])
const dataRows = lines.slice(1).map(l => parseCSVLine(l))

// ── 查找或新建行 ───────────────────────────────────────────────────

let row = dataRows.find(r => String(r[0]).trim() === key)
let isNew = false

if (!row) {
  row = []
  for (const h of headers) row.push('')
  row[0] = key
  dataRows.push(row)
  isNew = true
}

const zhIdx = headers.indexOf('zh')
const enIdx = headers.indexOf('en')

if (zhIdx >= 0) row[zhIdx] = zh
if (enIdx >= 0) row[enIdx] = en

// ── 排序 & 写入 ────────────────────────────────────────────────────

const sorted = sortRowsPrefixGrouped(dataRows)
const newCSV = ['﻿' + headers.join(',') + '\n']
for (const r of sorted) {
  newCSV.push(r.map(escapeCSV).join(','))
}

if (!dryRun) {
  fs.writeFileSync(CSV_PATH, newCSV.join('\n'), 'utf-8')
  console.log(`✓ ${isNew ? '新增' : '更新'}: ${key} → zh="${zh}" en="${en}"`)
} else {
  console.log(`[dry-run] ${isNew ? '新增' : '更新'}: ${key} → zh="${zh}" en="${en}"`)
}

process.exit(0)