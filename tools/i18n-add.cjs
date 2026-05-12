#!/usr/bin/env node
/**
 * i18n-add.cjs — 添加或更新多语言 key
 *
 * 用法：
 *   node tools/i18n-add.cjs <key> <zh> <en>
 *   node tools/i18n-add.cjs <key> <zh> <en> <key2> <zh2> <en2> ...
 *
 * 示例：
 *   node tools/i18n-add.cjs "panel.tool.title" "工具" "Tools"
 *   node tools/i18n-add.cjs "foo.bar" "Foo" "Bar" "baz.qux" "Baz" "Qux"
 */

'use strict'

const fs   = require('fs')
const path = require('path')

const ROOT     = path.resolve(__dirname, '..')
const CSV_PATH = path.join(ROOT, 'tables', 'locale.csv')

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

const args = process.argv.slice(2)
if (args.length < 3 || args.length % 3 !== 0) {
  console.error('用法: node i18n-add.cjs <key> <zh> <en> [<key> <zh> <en> ...]')
  process.exit(1)
}

const raw    = fs.readFileSync(CSV_PATH, 'utf-8').replace(/^﻿/, '')
const lines  = raw.split('\n')
const dataRows = lines.slice(1).filter(l => l.trim()).map(l => parseRow(l))

const existing = new Set(dataRows.map(r => r[0]))

for (let i = 0; i < args.length; i += 3) {
  const [key, zh, en] = args.slice(i, i + 3)
  const match = dataRows.find(r => r[0] === key)
  if (match) {
    match[1] = zh
    match[2] = en
    console.log(`✓ 更新: ${key}`)
  } else {
    dataRows.push([key, zh, en])
    existing.add(key)
    console.log(`✗ 新增: ${key}`)
  }
}

// sort by prefix group
const byPrefix = new Map()
for (const r of dataRows) {
  const k = String(r[0] ?? '').trim()
  if (!k) continue
  const p = getPrefix(k)
  if (!byPrefix.has(p)) byPrefix.set(p, [])
  byPrefix.get(p).push(r)
}
const sorted = []
for (const p of [...byPrefix.keys()].sort()) {
  const g = byPrefix.get(p)
  g.sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  sorted.push(...g)
}

const out = ['key,zh,en']
for (const r of sorted) out.push(r.map(escape).join(','))
fs.writeFileSync(CSV_PATH, '﻿' + out.join('\n') + '\n', 'utf-8')
console.log('已写入', CSV_PATH)