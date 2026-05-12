#!/usr/bin/env node
/**
 * i18n-add.cjs — 添加或更新多语言 key
 *
 * 用法：
 *   node tools/i18n-add.cjs <key> <zh> <en>
 *
 * 示例：
 *   node tools/i18n-add.cjs "panel.tool.title" "工具" "Tools"
 */

'use strict'

const fs   = require('fs')
const path = require('path')

const ROOT     = path.resolve(__dirname, '..')
const CSV_PATH = path.join(ROOT, 'tables', 'locale.csv')

// ── 解析 ──────────────────────────────────────────────────────────

function parseRow(line) {
  const result = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++ } else { inQ = !inQ } }
    else if (c === ',' && !inQ) { result.push(cur); cur = '' }
    else cur += c
  }
  result.push(cur)
  return result
}

function escape(s) {
  s = String(s ?? '')
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function getPrefix(k) {
  const i = k.indexOf('.')
  return i === -1 ? k : k.slice(0, i)
}

// ── CLI ────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
if (args.length < 3) {
  console.error('用法: node i18n-add.cjs <key> <zh> <en>')
  process.exit(1)
}

const [key, zh, en] = args
if (!key || !zh || !en) {
  console.error('key / zh / en 三个参数都不能省略')
  process.exit(1)
}

// ── 读取 ──────────────────────────────────────────────────────────

const raw    = fs.readFileSync(CSV_PATH, 'utf-8')
const lines  = raw.replace(/^﻿/, '').split('\n')
const dataRows = lines.slice(1).filter(l => l.trim()).map(l => parseRow(l))

// ── 查找或新建 ────────────────────────────────────────────────────

let row = dataRows.find(r => String(r[0]).trim() === key)
let isNew = false

if (!row) {
  row = [key, '', '']
  dataRows.push(row)
  isNew = true
}

row[1] = zh
row[2] = en

// ── 排序 ─────────────────────────────────────────────────────────

const byPrefix = new Map()
for (const r of dataRows) {
  const k = String(r[0] ?? '').trim()
  if (!k) continue
  const p = getPrefix(k)
  if (!byPrefix.has(p)) byPrefix.set(p, [])
  byPrefix.get(p).push(r)
}

const prefixes = Array.from(byPrefix.keys()).sort()
const sorted   = []
for (const p of prefixes) {
  const g = byPrefix.get(p)
  g.sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  sorted.push(...g)
}

// ── 写回（带 BOM）────────────────────────────────────────────────

const outLines = ['key,zh,en']
for (const r of sorted) outLines.push([r[0], r[1], r[2]].map(escape).join(','))

fs.writeFileSync(CSV_PATH, '﻿' + outLines.join('\n') + '\n', 'utf-8')
console.log(`✓ ${isNew ? '新增' : '更新'}: ${key} → zh="${zh}" en="${en}"`)