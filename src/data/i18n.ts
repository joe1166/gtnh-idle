// ============================================================
// 多语言系统 (i18n.ts)
// ============================================================
//
// 【架构说明】
//   本文件是多语言系统的运行时入口。
//   运行时读取的是 `src/config/locales/` 目录下的 JSON 文件：
//     src/config/locales/zh.json  — 中文
//     src/config/locales/en.json  — 英文
//
//   注意：这些 JSON **不是手改的权威来源**。
//   本项目以 `tables/locale.csv` 为多语言的唯一真源，JSON 通过脚本生成：
//     npm run csv:locale
//   （转换规则见 `schemas/locale.schema.json` / `tools/csv2json-universal.cjs`）
//
// 【如何使用】
//   import { t } from '../../data/i18n'
//   t('btn.start')              // → '▶ 开启'（中文）或 '▶ Start'（英文）
//   t('res.iron_ore')           // → '铁矿石' 或 'Iron Ore'
//   t('chapter.1.name')         // → '第一章：蒸汽时代'
//
// 【本地化键命名规范】
//   UI 文本:       'panel.power.title', 'btn.start', 'status.running'
//   资源名称:      'res.<resourceId>'          如 'res.iron_ore'
//   配方名称:      'recipe.<recipeId>'         如 'recipe.smelt_iron'
//   机器名称:      'machine.<machineId>'       如 'machine.furnace'
//   发电机名称:    'gen.<generatorId>'         如 'gen.steam_boiler'
//   章节名称:      'chapter.<id>.name'         如 'chapter.1.name'
//   章节描述:      'chapter.<id>.desc'         如 'chapter.1.desc'
//   任务描述:      'task.<taskId>'             如 'task.build_furnace'
//   科技名称:      'tech.<techId>.name'        如 'tech.basic_automation.name'
//   科技描述:      'tech.<techId>.desc'        如 'tech.basic_automation.desc'
//   分类标签:      'category.<category>'       如 'category.ore'
//   feature 名称:  'feature.<featureId>'       如 'feature.overclock'
//
// 【如何添加新语言】
//   1. 在 `tables/locale.csv` 中新增该语言列（例如 ja）并补齐对应翻译
//   2. 更新 `schemas/locale.schema.json` 的 outputs，指向生成的 JSON 路径
//   3. 运行 `npm run csv:locale` 生成 `src/config/locales/ja.json`
//   4. 在下方 LOCALE_DATA 中 import 并注册
//   5. 在 SUPPORTED_LOCALES 中添加语言代码
// ============================================================

import zhData from '../config/locales/zh.json'
import enData from '../config/locales/en.json'

/** 支持的语言代码 */
export type Locale = 'zh' | 'en'

/** 所有支持的语言列表 */
export const SUPPORTED_LOCALES: Locale[] = ['zh', 'en']

/** 各语言的翻译数据 */
const LOCALE_DATA: Record<Locale, Record<string, string>> = {
  zh: zhData as Record<string, string>,
  en: enData as Record<string, string>,
}

// ---- DEV: auto-capture missing keys into tables/locale.csv ----

const DEV_REPORT_ENDPOINT = '/__i18n/report'
const DEV_REPORT_MISSING_TRANSLATIONS = import.meta.env.VITE_I18N_REPORT_MISSING_TRANSLATIONS === '1'

const REPORTED = new Set<string>()
let reportTimer: number | null = null
const reportQueue = new Set<string>()

function enqueueDevReport(key: string): void {
  if (!import.meta.env.DEV) return
  if (REPORTED.has(key)) return
  REPORTED.add(key)
  reportQueue.add(key)

  if (reportTimer != null) return
  reportTimer = window.setTimeout(() => {
    reportTimer = null
    const keys = Array.from(reportQueue)
    reportQueue.clear()

    // Fire and forget; dev server will write to locale.csv.
    fetch(DEV_REPORT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keys }),
    }).catch(() => {})
  }, 500)
}

/** 当前语言（响应式，可在运行时切换） */
let currentLocale: Locale = 'zh'

/**
 * 获取当前语言
 */
export function getLocale(): Locale {
  return currentLocale
}

/**
 * 切换语言
 * @param locale - 目标语言代码
 */
export function setLocale(locale: Locale): void {
  if (SUPPORTED_LOCALES.includes(locale)) {
    currentLocale = locale
  }
}

/**
 * 获取本地化字符串。
 * @param key - 本地化键（如 'btn.start', 'res.iron_ore'）
 * @returns 当前语言的翻译文本；若键不存在，回退到中文；仍不存在则返回键名本身
 *
 * @example
 * t('btn.start')         // → '▶ 开启'
 * t('res.iron_ore')      // → '铁矿石'
 * t('chapter.1.name')    // → '第一章：蒸汽时代'
 */
export function t(key: string): string {
  // 优先当前语言
  const val = LOCALE_DATA[currentLocale]?.[key]
  if (val !== undefined) return val

  // 回退到中文
  if (currentLocale !== 'zh') {
    const zhVal = LOCALE_DATA.zh?.[key]
    if (zhVal !== undefined) {
      if (DEV_REPORT_MISSING_TRANSLATIONS) enqueueDevReport(key)
      return zhVal
    }
  }

  // 都没有：上报缺失 key（dev only），并返回 key 便于定位
  enqueueDevReport(key)
  return key
}
