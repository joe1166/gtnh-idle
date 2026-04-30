#!/usr/bin/env node
// ============================================================
// CSV 批量转换 Runner
// ============================================================
//
// 【用法】
//   node tools/csv-runner.cjs              — 转换所有表
//   node tools/csv-runner.cjs resources    — 只转换 resources 表
//   node tools/csv-runner.cjs res rec      — 转换多张表（前缀匹配）
//
// 【新增表】
//   只需在 schemas/csv-manifest.json 里加一行，无需修改 package.json。
//
// ============================================================

'use strict'

const fs            = require('fs')
const path          = require('path')
const { execSync }  = require('child_process')

const ROOT         = path.resolve(__dirname, '..')
const MANIFEST_PATH = path.join(ROOT, 'schemas', 'csv-manifest.json')
const CONVERTER    = path.join(ROOT, 'tools', 'csv2json-universal.cjs')

// ─── 读取 manifest ────────────────────────────────────────────

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))

// ─── 过滤目标表 ───────────────────────────────────────────────
// 无参数 → 全部；有参数 → 前缀匹配（支持多个参数）

const filters = process.argv.slice(2).filter(a => !a.startsWith('-'))

const targets = filters.length === 0
  ? manifest
  : manifest.filter(entry =>
      filters.some(f => entry.name.startsWith(f))
    )

if (targets.length === 0) {
  console.error(`未找到匹配的表: ${filters.join(', ')}`)
  console.error(`可用的表: ${manifest.map(e => e.name).join(', ')}`)
  process.exit(1)
}

// ─── 逐表转换 ────────────────────────────────────────────────

let ok = 0
let fail = 0

for (const entry of targets) {
  // 可选的前置脚本（如 locale 的排序）
  if (entry.pre) {
    try {
      execSync(entry.pre, { cwd: ROOT, stdio: 'inherit' })
    } catch {
      console.error(`[csv-runner] 前置脚本失败: ${entry.pre}`)
      fail++
      continue
    }
  }

  const cmd = `node "${CONVERTER}" --schema "${entry.schema}" --input "${entry.input}"`
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' })
    ok++
  } catch {
    console.error(`[csv-runner] 转换失败: ${entry.name}`)
    fail++
  }
}

// ─── 汇总 ────────────────────────────────────────────────────

if (targets.length > 1) {
  console.log(`\n完成：${ok} 张表成功${fail > 0 ? `，${fail} 张失败` : ''}。`)
}

if (fail > 0) process.exit(1)
