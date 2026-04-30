// 按前缀分组、字母排序 tables/locale.csv
// 用法：node tools/sort-locale.cjs
'use strict'
const fs   = require('fs')
const path = require('path')

const csvPath = path.resolve(__dirname, '../tables/locale.csv')
const text    = fs.readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '')
const lines   = text.split('\n')
const headers = lines[0].split(',')

function parseRow(line) {
  const result = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQ = !inQ }
    else if (c === ',' && !inQ) { result.push(cur); cur = '' }
    else cur += c
  }
  result.push(cur)
  return result
}

function stringifyField(v) {
  if (v.includes(',') || v.includes('"') || v.includes('\n'))
    return '"' + v.replace(/"/g, '""') + '"'
  return v
}

const rows = lines.slice(1).filter(l => l.trim()).map(l => {
  const vals = parseRow(l)
  const obj  = {}
  headers.forEach((h, i) => (obj[h] = vals[i] ?? ''))
  return obj
})

function getPrefix(k) {
  const i = k.indexOf('.')
  return i === -1 ? k : k.slice(0, i)
}

const byPrefix = new Map()
for (const r of rows) {
  const k = String(r.key ?? '').trim()
  if (!k) continue
  const p = getPrefix(k)
  if (!byPrefix.has(p)) byPrefix.set(p, [])
  byPrefix.get(p).push(r)
}

const prefixes = Array.from(byPrefix.keys()).sort((a, b) => a.localeCompare(b))
const sorted   = []
for (const p of prefixes) {
  const g = byPrefix.get(p)
  g.sort((a, b) => String(a.key).localeCompare(String(b.key)))
  sorted.push(...g)
}

const outLines = [headers.join(',')]
for (const r of sorted)
  outLines.push(headers.map(h => stringifyField(r[h] ?? '')).join(','))

fs.writeFileSync(csvPath, outLines.join('\n') + '\n', 'utf-8')
console.log(`locale.csv 已排序（${sorted.length} 行）`)
