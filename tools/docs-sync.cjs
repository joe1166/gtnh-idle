#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const cp = require('child_process')

const root = process.cwd()
const changelog = path.join(root, 'docs', 'zh', 'DOC_CHANGELOG.md')

function run(cmd) {
  try {
    return cp.execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8')
  } catch {
    return ''
  }
}

function getStagedFiles() {
  const out = run('git diff --cached --name-only')
  return out
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
}

function hasDocChanges(staged) {
  return staged.some(f => f.startsWith('docs/'))
}

function hasCodeChanges(staged) {
  return staged.some(f =>
    f.startsWith('src/') ||
    f.startsWith('tables/') ||
    f.startsWith('schemas/') ||
    f.startsWith('tools/')
  )
}

function appendLog(staged) {
  const now = new Date()
  const ts = now.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, 'Z')
  const codeFiles = staged.filter(f =>
    f.startsWith('src/') || f.startsWith('tables/') || f.startsWith('schemas/')
  )
  const filesPreview = codeFiles.slice(0, 8).join(', ')
  const extra = codeFiles.length > 8 ? ` ...(+${codeFiles.length - 8})` : ''
  const line = `- ${ts} | code=${codeFiles.length} | ${filesPreview}${extra}\n`

  let content = ''
  if (fs.existsSync(changelog)) {
    content = fs.readFileSync(changelog, 'utf8')
  } else {
    content = '# 技术文档更新记录\n\n'
  }

  if (!content.endsWith('\n')) content += '\n'
  content += line
  fs.writeFileSync(changelog, content, 'utf8')
  console.log('[docs:auto] appended DOC_CHANGELOG entry')
}

function check(staged) {
  const needDoc = hasCodeChanges(staged)
  const docChanged = hasDocChanges(staged)
  if (needDoc && !docChanged) {
    console.error('[docs:check] 检测到代码/配置改动，但未包含 docs 变更。请先更新技术文档后再提交。')
    process.exit(1)
  }
  console.log('[docs:check] ok')
}

const mode = process.argv.includes('--check') ? 'check' : 'auto'
const staged = getStagedFiles()

if (mode === 'auto') {
  if (hasCodeChanges(staged)) {
    appendLog(staged)
    // stage changelog if changed
    run('git add docs/zh/DOC_CHANGELOG.md')
  } else {
    console.log('[docs:auto] no code/config changes, skip')
  }
  process.exit(0)
}

check(staged)

