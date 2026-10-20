/**
 * Chạy trên GitHub Actions: lấy state của lượt trước từ chính trang đã đăng (state.json),
 * làm mới, rồi ghi brief.json + state.json vào thư mục web tĩnh sắp đăng.
 * Không commit dữ liệu vào git: state sống trên trang, nên repo không phình theo thời gian.
 *
 *   SITE_URL=https://<user>.github.io/<repo>/ node scripts/publish-brief.ts dist-static
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { buildBrief } from '../core/brief.ts'
import { refreshState } from '../core/refresh.ts'
import { emptyState, reviveState, type State } from '../core/state.ts'
import { nodeFetchText } from '../server/fetch.ts'

const outDir = process.argv[2]
if (!outDir) throw new Error('Thiếu thư mục đích, vd: node scripts/publish-brief.ts dist-static')

async function loadPrevious(): Promise<State> {
  const site = process.env.SITE_URL
  if (!site) return emptyState()
  const url = new URL('state.json', site.endsWith('/') ? site : `${site}/`).toString()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: 'no-store' })
    if (res.status === 404) {
      console.log(`Chưa có ${url} — lần đăng đầu tiên, bắt đầu từ trống`)
      return emptyState()
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return reviveState(await res.json())
  } catch (err) {
    // Mất state thì chỉ mất lịch sử giá và dấu "đã thấy"; vẫn đăng bản tin mới
    console.warn(`Không tải được state cũ (${(err as Error).message}) — bắt đầu từ trống`)
    return emptyState()
  }
}

const state = await loadPrevious()
const errors = await refreshState(state, nodeFetchText)
for (const e of errors) console.warn(`✗ ${e.source}: ${e.message}`)

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'state.json'), JSON.stringify(state))
const brief = buildBrief(state)
writeFileSync(join(outDir, 'brief.json'), JSON.stringify(brief))
const counts = brief.sections.map((s) => `${s.title}: ${s.stories.length}`).join(', ')
console.log(`Đã ghi bản tin (${counts}), ${errors.length} nguồn lỗi`)
