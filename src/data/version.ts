/**
 * 版本管理 — 所有版本号集中管理
 *
 * 任何版本升级都必须先询问用户，不可自行升级。
 * 包含：
 *   APP_VERSION  — 应用版本（package.json 也同步）
 *   SAVE_VERSION — 存档格式版本（useSaveLoad.ts 引用）
 */

export const APP_VERSION   = '0.1.0'
export const SAVE_VERSION  = '6.0.0'