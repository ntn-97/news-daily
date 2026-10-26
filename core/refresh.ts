/**
 * Một lượt làm mới: tải RSS + Google Trends + giá + chứng khoán, ghi vào state. Không biết mình chạy ở đâu —
 * nơi gọi đưa vào hàm tải (`FetchText`) và tự lo lưu state, chạy định kỳ, chống chạy chồng.
 *
 * Một nguồn hỏng không làm hỏng cả lượt: lỗi được ghi lại theo nguồn để giao diện báo,
 * còn dữ liệu cũ của nguồn đó vẫn giữ nguyên.
 */
import type { MarketStock, SourceError } from '../shared/types.ts'
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
import {
  PICK_DAYS,
  VIETSTOCK_EXPERT_URL,
  VIETSTOCK_OUTLOOK_URL,
  VND_INDICES_URL,
  inTradingHours,
  parseVietstockNotes,
  parseVndIndices,
  parseVndStocks,
  vndMoversUrl,
  vndQuotesUrl,
} from './stocks.ts'
import { parseGoogleTrends } from './trends.ts'

/** Tải nội dung một URL dạng chữ; HTTP lỗi thì ném lỗi */
export type FetchText = (url: string) => Promise<string>

/** Số request song song khi tải RSS — vài chục feed, mỗi 20 phút một lần, không cần nhanh hơn */
const CONCURRENCY = 6
/** VCB ghi rõ chỉ nên gọi 5 phút / lần */
const PRICE_MIN_GAP_MS = 5 * 60_000
/** Giá xăng chỉ đổi theo kỳ điều hành, vài ngày một lần */
const FUEL_MIN_GAP_MS = 2 * 3_600_000
/** Chứng khoán trong phiên: ngắn hơn chu kỳ 20 phút một chút để lượt nào cũng tải, nhưng bấm "Làm mới" liên tục
 *  thì không. Ngoài giờ chỉ số đứng yên, 2 giờ / lần là đủ bắt bài nhận định đăng buổi tối */
const MARKET_SESSION_GAP_MS = 15 * 60_000
const MARKET_OFF_HOURS_GAP_MS = 2 * 3_600_000
/** Mỗi lượt hỏi giá tối đa ngần này mã được chuyên gia nhắc tới */
const MAX_QUOTES = 40

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

async function refreshMarket(state: State, fetchText: FetchText, errors: SourceError[], now: number) {
  const at = new Date(now).toISOString()
  const gap = inTradingHours(now) ? MARKET_SESSION_GAP_MS : MARKET_OFF_HOURS_GAP_MS
  if (state.marketFetchedAt && now - Date.parse(state.marketFetchedAt) < gap) return
  state.marketFetchedAt = at

  await Promise.all([
    attempt('Chứng khoán VNDirect', errors, at, async () => {
      const { session, time, indices } = parseVndIndices(await fetchText(VND_INDICES_URL))
      const [gainers, losers] = await Promise.all([
        fetchText(vndMoversUrl(session, 'desc')).then(parseVndStocks),
        fetchText(vndMoversUrl(session, 'asc')).then(parseVndStocks),
      ])
      // Nguồn chưa có giá cổ phiếu của phiên đang chạy: giữ danh sách phiên trước, giao diện ghi rõ phiên nào
      const prev = state.market
      const fresh = gainers.length > 0 || losers.length > 0
      state.market = {
        session,
        time,
        indices,
        moversSession: fresh ? session : (prev?.moversSession ?? session),
        gainers: fresh ? gainers : (prev?.gainers ?? []),
        losers: fresh ? losers : (prev?.losers ?? []),
      }
    }),
    attempt('Vietstock nhận định', errors, at, async () => {
      state.marketOutlook = parseVietstockNotes(await fetchText(VIETSTOCK_OUTLOOK_URL))
    }),
  ])

  // Chạy sau VNDirect: cần phiên giao dịch để hỏi giá các mã được nhắc tới
  const session = state.market?.session
  if (!session) return
  await attempt('Vietstock ý kiến chuyên gia', errors, at, async () => {
    const notes = parseVietstockNotes(await fetchText(VIETSTOCK_EXPERT_URL))
    const cut = new Date(now - PICK_DAYS * 864e5).toISOString()
    const candidates = [...new Set(notes.filter((n) => n.publishedAt >= cut).flatMap((n) => n.tickers))]
    let quotes: Record<string, MarketStock> = {}
    if (candidates.length > 0) {
      const stocks = parseVndStocks(await fetchText(vndQuotesUrl(session, candidates.slice(0, MAX_QUOTES))))
      quotes = Object.fromEntries(stocks.map((s) => [s.code, s]))
    }
    // Chỉ giữ mã VNDirect trả về giá: chữ viết hoa trong tiêu đề chưa chắc là mã cổ phiếu
    state.marketExpert = notes.map((n) => ({ ...n, tickers: n.tickers.filter((t) => t in quotes) }))
    state.marketQuotes = quotes
  })
}

/** Chạy một lượt, sửa thẳng vào `state`. Trả về danh sách nguồn lỗi (cũng ghi vào state.errors) */
export async function refreshState(state: State, fetchText: FetchText, now = Date.now()): Promise<SourceError[]> {
  const errors: SourceError[] = []
  await Promise.all([
    refreshNews(state, fetchText, errors, new Date(now).toISOString()),
    refreshPrices(state, fetchText, errors, now),
    refreshMarket(state, fetchText, errors, now),
  ])
  pruneState(state, now)
  state.errors = errors
  state.refreshedAt = new Date().toISOString()
  return errors
}
