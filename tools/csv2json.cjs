#!/usr/bin/env node
// ============================================================
// CSV → JSON 配置转换工具
// ============================================================
//
// 【用途】
//   将 Excel 导出的 CSV 文件转换为游戏使用的 JSON 配置文件。
//   支持转换：resources, recipes, machines, generators, chapters, techs, locales
//
// 【使用方法】
//   node tools/csv2json.js <类型> <输入CSV> [输出JSON]
//
//   类型（type）:
//     resources   — 资源表
//     recipes     — 配方表
//     machines    — 机器表
//     generators  — 发电机表
//     techs       — 科技表
//     locale      — 本地化文本表
//
// 【示例】
//   node tools/csv2json.js resources  tables/resources.csv  src/config/resources.json
//   node tools/csv2json.js locale     tables/locale.csv     src/config/locales/zh.json
//
// ============================================================
// 【CSV 格式说明】
//
// ── resources.csv ──
//   id, locKey, defaultCap, category, unlockedByChapter
//   iron_ore, res.iron_ore, 1000, ore, 1
//
// ── recipes.csv ──
//   id, locKey, inputs, outputs, durationSec, euPerSec, requiredMachineType, unlockedByChapter
//   smelt_iron, recipe.smelt_iron, "iron_ore:2", "iron_ingot:1", 10, 8, furnace, 1
//   （inputs/outputs 格式: "resourceId:amount|resourceId:amount"，用 | 分隔多个）
//
// ── machines.csv ──
//   id, locKey, type, euPerSec, allowedRecipeIds, buildCost, unlockedByChapter
//   furnace, machine.furnace, furnace, 8, "smelt_iron|smelt_copper|smelt_tin", "iron_plate:4", 1
//   （allowedRecipeIds 用 | 分隔；buildCost 格式同 inputs）
//
// ── generators.csv ──
//   id, locKey, euPerSec, fuelResourceId, fuelPerSec, buildCost, unlockedByChapter
//   steam_boiler, gen.steam_boiler, 16, coal, 0.5, "iron_plate:8|wrench:1", 1
//
// ── techs.csv ──
//   id, locKey, descLocKey, cost, prerequisites, unlockFeatures, unlockMachines, unlockRecipes, unlockGenerators
//   basic_automation, tech.basic_automation.name, tech.basic_automation.desc, "iron_plate:8|copper_wire:4", "", "auto_miner_eu", "", "", ""
//
// ── locale.csv（本地化文本表）──
//   key, zh, en
//   res.iron_ore, 铁矿石, Iron Ore
//   btn.start, ▶ 开启, ▶ Start
//   （每行一个 key，各语言列对应翻译文本）
//   转换时指定输出语言：node tools/csv2json.js locale tables/locale.csv src/config/locales/zh.json --lang zh
//
// ============================================================

const fs = require('fs')
const path = require('path')

// ── CSV 解析（支持引号内逗号） ──
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseLine(line)
    const obj = {}
    headers.forEach((h, i) => { obj[h.trim()] = (values[i] || '').trim() })
    return obj
  })
}

function parseLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue }
    current += ch
  }
  result.push(current)
  return result
}

// ── 辅助：解析 "resourceId:amount|resourceId:amount" 格式 ──
function parseResourceAmounts(str) {
  if (!str || !str.trim()) return []
  return str.split('|').map(part => {
    const [resourceId, amount] = part.split(':')
    return { resourceId: resourceId.trim(), amount: Number(amount) }
  })
}

// ── 辅助：解析 "|" 分隔的字符串列表 ──
function parseList(str) {
  if (!str || !str.trim()) return []
  return str.split('|').map(s => s.trim()).filter(Boolean)
}

// ── 转换器 ──
const converters = {
  resources(rows) {
    return rows.map(r => ({
      id: r.id,
      locKey: r.locKey,
      defaultCap: Number(r.defaultCap),
      category: r.category,
      unlockedByChapter: Number(r.unlockedByChapter),
    }))
  },

  recipes(rows) {
    return rows.map(r => ({
      id: r.id,
      locKey: r.locKey,
      inputs: parseResourceAmounts(r.inputs),
      outputs: parseResourceAmounts(r.outputs),
      durationSec: Number(r.durationSec),
      euPerSec: Number(r.euPerSec),
      requiredMachineType: r.requiredMachineType,
      unlockedByChapter: Number(r.unlockedByChapter),
    }))
  },

  machines(rows) {
    return rows.map(r => ({
      id: r.id,
      locKey: r.locKey,
      type: r.type,
      euPerSec: Number(r.euPerSec),
      allowedRecipeIds: parseList(r.allowedRecipeIds),
      buildCost: parseResourceAmounts(r.buildCost),
      unlockedByChapter: Number(r.unlockedByChapter),
    }))
  },

  generators(rows) {
    return rows.map(r => ({
      id: r.id,
      locKey: r.locKey,
      euPerSec: Number(r.euPerSec),
      fuelResourceId: r.fuelResourceId,
      fuelPerSec: Number(r.fuelPerSec),
      buildCost: parseResourceAmounts(r.buildCost),
      unlockedByChapter: Number(r.unlockedByChapter),
    }))
  },

  techs(rows) {
    return rows.map(r => ({
      id: r.id,
      locKey: r.locKey,
      descLocKey: r.descLocKey,
      cost: parseResourceAmounts(r.cost),
      prerequisites: parseList(r.prerequisites),
      unlocks: {
        ...(r.unlockFeatures ? { features: parseList(r.unlockFeatures) } : {}),
        ...(r.unlockMachines ? { machineDefIds: parseList(r.unlockMachines) } : {}),
        ...(r.unlockRecipes ? { recipeIds: parseList(r.unlockRecipes) } : {}),
        ...(r.unlockGenerators ? { generatorDefIds: parseList(r.unlockGenerators) } : {}),
      },
    }))
  },

  locale(rows, lang) {
    const result = {}
    for (const row of rows) {
      if (row.key && row[lang] !== undefined && row[lang] !== '') {
        result[row.key] = row[lang]
      }
    }
    return result
  },
}

// ── 主程序 ──
function main() {
  const args = process.argv.slice(2)
  if (args.length < 2) {
    console.log('用法: node tools/csv2json.js <type> <input.csv> [output.json] [--lang <lang>]')
    console.log('类型: resources, recipes, machines, generators, techs, locale')
    console.log('')
    console.log('示例:')
    console.log('  node tools/csv2json.js resources  tables/resources.csv  src/config/resources.json')
    console.log('  node tools/csv2json.js locale     tables/locale.csv     src/config/locales/zh.json --lang zh')
    process.exit(1)
  }

  const type = args[0]
  const inputFile = args[1]
  const outputFile = args[2] || `src/config/${type}.json`

  // 解析 --lang 参数
  let lang = 'zh'
  const langIdx = args.indexOf('--lang')
  if (langIdx !== -1 && args[langIdx + 1]) {
    lang = args[langIdx + 1]
  }

  if (!converters[type]) {
    console.error(`未知类型: ${type}`)
    console.error('支持的类型: ' + Object.keys(converters).join(', '))
    process.exit(1)
  }

  const csvText = fs.readFileSync(path.resolve(inputFile), 'utf-8')
  const rows = parseCSV(csvText)
  console.log(`解析了 ${rows.length} 行数据`)

  let result
  if (type === 'locale') {
    result = converters.locale(rows, lang)
    console.log(`语言: ${lang}, 键数: ${Object.keys(result).length}`)
  } else {
    result = converters[type](rows)
  }

  const outPath = path.resolve(outputFile)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8')
  console.log(`已写入: ${outPath}`)
}

main()
