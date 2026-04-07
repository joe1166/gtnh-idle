import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import path from 'node:path'

function isLoopback(addr?: string | null): boolean {
  if (!addr) return false
  // Node may report IPv4 as ::ffff:127.0.0.1
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

function readReqBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: any) => { data += String(chunk) })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function parseLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else { inQuotes = !inQuotes }
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}

function parseCSV(text: string): { headers: string[], rows: Record<string, string>[] } {
  const normalized = text.replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  const lines = normalized.split('\n').filter(l => l.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = parseLine(lines[0]).map(h => h.trim())
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim() })
    return row
  })

  return { headers, rows }
}

function escapeCSVCell(s: string): string {
  const str = String(s ?? '')
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function stringifyCSV(headers: string[], rows: Record<string, string>[]): string {
  const out: string[] = []
  out.push(headers.map(escapeCSVCell).join(','))
  for (const r of rows) {
    out.push(headers.map(h => escapeCSVCell(r[h] ?? '')).join(','))
  }
  out.push('')
  return out.join('\n')
}

function getPrefix(key: string): string {
  const idx = key.indexOf('.')
  return idx === -1 ? key : key.slice(0, idx)
}

function sortRowsPrefixGrouped(rows: Record<string, string>[]): Record<string, string>[] {
  const byPrefix = new Map<string, Record<string, string>[]>()
  for (const r of rows) {
    const k = String(r.key ?? '').trim()
    if (!k) continue
    const p = getPrefix(k)
    if (!byPrefix.has(p)) byPrefix.set(p, [])
    byPrefix.get(p)!.push(r)
  }

  const prefixes = Array.from(byPrefix.keys()).sort((a, b) => a.localeCompare(b))
  const sorted: Record<string, string>[] = []
  for (const p of prefixes) {
    const group = byPrefix.get(p)!
    group.sort((a, b) => String(a.key).localeCompare(String(b.key)))
    sorted.push(...group)
  }
  return sorted
}

function upsertKey(headers: string[], rows: Record<string, string>[], key: string): boolean {
  const k = String(key ?? '').trim()
  if (!k) return false
  let row = rows.find(r => String(r.key).trim() === k)
  if (row) return false

  row = {}
  for (const h of headers) row[h] = ''
  row.key = k
  rows.push(row)
  return true
}

function i18nCapturePlugin() {
  const root = process.cwd()
  const csvPath = path.resolve(root, 'tables/locale.csv')
  let lastWriteAt = 0
  let pendingKeys = new Set<string>()
  let flushTimer: NodeJS.Timeout | null = null

  function flush() {
    flushTimer = null
    const keys = Array.from(pendingKeys)
    pendingKeys = new Set<string>()
    if (keys.length === 0) return

    const text = fs.readFileSync(csvPath, 'utf-8')
    const { headers, rows } = parseCSV(text)
    if (headers.length === 0 || !headers.includes('key')) return

    let added = 0
    for (const k of keys) {
      if (upsertKey(headers, rows, k)) added++
    }

    if (added > 0) {
      const sorted = sortRowsPrefixGrouped(rows)
      fs.writeFileSync(csvPath, '\ufeff' + stringifyCSV(headers, sorted), 'utf-8')
    }
    lastWriteAt = Date.now()
  }

  function scheduleFlush() {
    if (flushTimer) return
    flushTimer = setTimeout(flush, 300)
  }

  return {
    name: 'dev-i18n-capture',
    apply: 'serve',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.method !== 'POST' || req.url !== '/__i18n/report') return next()

        if (!isLoopback(req.socket?.remoteAddress)) {
          res.statusCode = 403
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'forbidden' }))
          return
        }

        let bodyText = ''
        try {
          bodyText = await readReqBody(req)
        } catch {
          res.statusCode = 400
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'bad_body' }))
          return
        }

        let payload: any
        try {
          payload = bodyText ? JSON.parse(bodyText) : {}
        } catch {
          res.statusCode = 400
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'bad_json' }))
          return
        }

        const keys: string[] = []
        if (typeof payload.key === 'string') keys.push(payload.key)
        if (Array.isArray(payload.keys)) keys.push(...payload.keys.filter((k: any) => typeof k === 'string'))
        if (Array.isArray(payload.events)) {
          for (const e of payload.events) {
            if (e && typeof e.key === 'string') keys.push(e.key)
          }
        }

        const uniq = Array.from(new Set(keys.map(k => String(k).trim()).filter(Boolean)))
        for (const k of uniq) pendingKeys.add(k)
        scheduleFlush()

        // respond immediately; write happens in debounced flush
        res.statusCode = 200
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ ok: true, queued: uniq.length, lastWriteAt }))
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), i18nCapturePlugin()],
  resolve: { alias: { '@': '/src' } },
})
