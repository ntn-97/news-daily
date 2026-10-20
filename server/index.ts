/**
 * Server chạy trên Mac (`npm run dev` / `npm start`): làm mới định kỳ, lưu state vào data/state.json,
 * trả bản tin cho web. Chạy production thì phục vụ luôn bản build ở dist/.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'

import { buildBrief } from '../core/brief.ts'
import { REFRESH_INTERVAL_MS, refreshState } from '../core/refresh.ts'
import { reviveState, type State } from '../core/state.ts'
import type { Brief } from '../shared/types.ts'
import { nodeFetchText } from './fetch.ts'

const PORT = Number(process.env.PORT ?? 4600)
/** Bấm "Làm mới" liên tục cũng không tải lại nguồn dày hơn thế này */
const MANUAL_MIN_GAP_MS = 60_000

const dataDir = fileURLToPath(new URL('../data/', import.meta.url))
const statePath = process.env.BAN_TIN_STATE ?? `${dataDir}state.json`
mkdirSync(dataDir, { recursive: true })

const state: State = reviveState(existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null)

function save() {
  // Ghi ra file tạm rồi đổi tên: tắt máy giữa chừng không làm hỏng file cũ
  writeFileSync(`${statePath}.tmp`, JSON.stringify(state))
  renameSync(`${statePath}.tmp`, statePath)
}

/** Gộp tin tốn vài trăm ms: giữ kết quả 1 phút hoặc tới lượt làm mới sau */
let cache: { at: number; brief: Brief } | null = null
function brief(): Brief {
  if (!cache || Date.now() - cache.at > 60_000) cache = { at: Date.now(), brief: buildBrief(state) }
  return { ...cache.brief, refreshing: running !== null }
}

let running: Promise<void> | null = null
let startedAt = 0

/** Chạy một lượt làm mới; đang có lượt chạy thì dùng chung lượt đó */
function refresh(manual = false): Promise<void> {
  if (running) return running
  if (manual && Date.now() - startedAt < MANUAL_MIN_GAP_MS) return Promise.resolve()
  startedAt = Date.now()
  running = (async () => {
    try {
      const errors = await refreshState(state, nodeFetchText)
      save()
      cache = null
      const failed = errors.length ? ` — ${errors.length} nguồn lỗi` : ''
      console.log(`[${new Date().toLocaleTimeString('vi-VN')}] Làm mới xong${failed}`)
      for (const e of errors) console.warn(`  ✗ ${e.source}: ${e.message}`)
    } finally {
      running = null
    }
  })()
  return running
}

const app = new Hono()

app.get('/api/brief', (c) => c.json(brief()))

/** Chờ lượt làm mới xong rồi trả bản tin mới — web hiện vòng xoay trong lúc chờ (thường < 15 giây) */
app.post('/api/refresh', async (c) => {
  await refresh(true)
  return c.json(brief())
})

if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

/** Địa chỉ trong mạng LAN để mở trên điện thoại */
function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) return a.address
  }
  return null
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Bản Tin Sáng API chạy tại http://localhost:${info.port}`)
  if (process.env.NODE_ENV === 'production') {
    const ip = lanAddress()
    if (ip) console.log(`Mở trên điện thoại (cùng wifi): http://${ip}:${info.port}`)
  }
  void refresh()
  setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
})
