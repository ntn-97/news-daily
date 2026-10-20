/**
 * Một lượt làm mới: tải RSS + Google Trends + giá, ghi vào state. Không biết mình chạy ở đâu —
 * nơi gọi đưa vào hàm tải (`FetchText`) và tự lo lưu state, chạy định kỳ, chống chạy chồng.
 *
 * Một nguồn hỏng không làm hỏng cả lượt: lỗi được ghi lại theo nguồn để giao diện báo,
 * còn dữ liệu cũ của nguồn đó vẫn giữ nguyên.
 */
import type { SourceError } from '../shared/types.ts'
import { articleId, canonicalLink } from './ids.ts'
import {
  GOLD_API_URL,
  PNJ_URL,
  VCB_URL,
  WEBGIA_FUEL_URL,
  parseGoldApi,
  parsePnj,
  parseVcb,
  parseWebgiaFuel,
} from './prices.ts'
import { isSocialBuzz, type Article } from './rank.ts'
import { parseFeed } from './rss.ts'
import { FEEDS, GOOGLE_TRENDS_URL, type FeedSource } from './sources.ts'
import { addArticles, pruneState, recordPrice, type State } from './state.ts'
import { parseGoogleTrends } from './trends.ts'

/** Tải nội dung một URL dạng chữ; HTTP lỗi thì ném lỗi */
export type FetchText = (url: string) => Promise<string>

/** Số request song song khi tải RSS — vài chục feed, mỗi 20 phút một lần, không cần nhanh hơn */
const CONCURRENCY = 6
/** VCB ghi rõ chỉ nên gọi 5 phút / lần */
const PRICE_MIN_GAP_MS = 5 * 60_000
/** Giá xăng chỉ đổi theo kỳ điều hành, vài ngày một lần */
const FUEL_MIN_GAP_MS = 2 * 3_600_000

export const REFRESH_INTERVAL_MS = 20 * 60_000

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i]!)
      }
    }),
  )
  return out
}

function feedLabel(f: FeedSource) {
  return `${f.source} · ${new URL(f.url).pathname.replace(/^\/(rss\/)?|\.rss$/g, '')}`
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

async function attempt(source: string, errors: SourceError[], at: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (err) {
    errors.push({ source, message: message(err), at })
  }
}

async function refreshNews(state: State, fetchText: FetchText, errors: SourceError[], nowIso: string) {
  const results = await mapLimit(FEEDS, CONCURRENCY, async (f) => {
    try {
      return parseFeed(await fetchText(f.url))
    } catch (err) {
      errors.push({ source: feedLabel(f), message: message(err), at: nowIso })
      return []
    }
  })
  // Ghi theo đúng thứ tự FEEDS: bài nằm ở hai chuyên mục thì thuộc chuyên mục của nguồn đứng trước
  const articles: Article[] = FEEDS.flatMap((f, i) =>
    results[i]!
      .filter((it) => !f.onlySocial || isSocialBuzz(it.title, it.summary))
      .map((it) => ({
        id: articleId(it.link),
        section: f.section,
        source: f.source,
        title: it.title,
        link: canonicalLink(it.link),
        summary: it.summary,
        image: it.image,
        // Không ghi giờ, hoặc giờ ở tương lai (báo ghi sai múi giờ) → lấy lúc thấy bài
        publishedAt: it.publishedAt && it.publishedAt <= nowIso ? it.publishedAt : nowIso,
      })),
  )
  addArticles(state, articles)

  await attempt('Google Trends', errors, nowIso, async () => {
    state.trends = parseGoogleTrends(await fetchText(GOOGLE_TRENDS_URL))
  })
}

async function refreshPrices(state: State, fetchText: FetchText, errors: SourceError[], now: number) {
  const at = new Date(now).toISOString()
  const since = (iso: string | null) => (iso ? now - Date.parse(iso) : Infinity)
  const jobs: Promise<void>[] = []
  if (since(state.pricesFetchedAt) >= PRICE_MIN_GAP_MS) {
    state.pricesFetchedAt = at
    jobs.push(
      attempt('Giá vàng PNJ', errors, at, async () => {
        const gold = parsePnj(await fetchText(PNJ_URL))
        for (const r of gold.rows) {
          recordPrice(state, `${r.key}-buy`, r.buy, at)
          recordPrice(state, `${r.key}-sell`, r.sell, at)
        }
        state.gold = gold
      }),
      attempt('Vàng thế giới', errors, at, async () => {
        const usd = parseGoldApi(await fetchText(GOLD_API_URL))
        recordPrice(state, 'gold-world-usd', usd, at)
        state.goldWorld = usd
      }),
      attempt('Tỷ giá Vietcombank', errors, at, async () => {
        const fx = parseVcb(await fetchText(VCB_URL))
        for (const r of fx.rows) recordPrice(state, `fx-${r.code}-sell`, r.sell, at)
        state.fx = fx
      }),
    )
  }
  if (since(state.fuelFetchedAt) >= FUEL_MIN_GAP_MS) {
    state.fuelFetchedAt = at
    jobs.push(
      attempt('Giá xăng dầu', errors, at, async () => {
        const fuel = parseWebgiaFuel(await fetchText(WEBGIA_FUEL_URL))
        for (const r of fuel.rows) recordPrice(state, r.key, r.region1, at)
        state.fuel = fuel
      }),
    )
  }
  await Promise.all(jobs)
}

/** Chạy một lượt, sửa thẳng vào `state`. Trả về danh sách nguồn lỗi (cũng ghi vào state.errors) */
export async function refreshState(state: State, fetchText: FetchText, now = Date.now()): Promise<SourceError[]> {
  const errors: SourceError[] = []
  await Promise.all([
    refreshNews(state, fetchText, errors, new Date(now).toISOString()),
    refreshPrices(state, fetchText, errors, now),
  ])
  pruneState(state, now)
  state.errors = errors
  state.refreshedAt = new Date().toISOString()
  return errors
}
