/**
 * Toàn bộ dữ liệu đã lưu, dạng một object JSON. Cùng một khuôn chạy ở ba nơi:
 * - server trên Mac: file data/state.json
 * - extension Chrome: chrome.storage.local
 * - GitHub Actions: state.json đăng kèm trang, lượt sau tải về đọc tiếp
 *
 * Giữ bài 3 ngày (bản tin chỉ xem 30 giờ, phần dư để biết bài nào đã thấy) và giá 10 ngày
 * (đủ so "hôm qua"). Cỡ file khoảng 1–2 MB.
 */
import type { CrudeOil, MarketIndex, MarketNote, MarketStock, SourceError, Trend } from '../shared/types.ts'
import type { RawFuelRow, RawFxRow, RawGoldRow } from './prices.ts'
import type { Article } from './rank.ts'

export interface PricePoint {
  at: string
  value: number
}

export interface State {
  v: 2
  articles: Article[]
  /** Giá theo thời gian của từng mã (vd. "gold-sjc-sell"). Giá không đổi thì tối đa một điểm / giờ */
  prices: Record<string, PricePoint[]>
  /** Giá cũ ngay trước lần đổi giá gần nhất — với xăng dầu chính là giá kỳ điều chỉnh trước */
  changes: Record<string, PricePoint>
  gold: { rows: RawGoldRow[]; sourceTime: string } | null
  goldWorld: number | null
  fx: { rows: RawFxRow[]; sourceTime: string } | null
  fuel: { rows: RawFuelRow[]; sourceTime: string; crude: CrudeOil[] } | null
  trends: Trend[]
  /** Chỉ số của phiên gần nhất; danh sách tăng / giảm có phiên riêng (xem MarketBoard.moversSession) */
  market: {
    session: string
    time: string
    indices: MarketIndex[]
    moversSession: string
    gainers: MarketStock[]
    losers: MarketStock[]
  } | null
  /** Giá phiên gần nhất của các mã được chuyên gia nhắc tới */
  marketQuotes: Record<string, MarketStock>
  /** RSS "Nhận định thị trường" */
  marketOutlook: MarketNote[]
  /** RSS "Ý kiến chuyên gia"; `tickers` chỉ còn mã VNDirect xác nhận — bài không có mã là nhận định chung */
  marketExpert: MarketNote[]
  /** Lần tải giá gần nhất — để không gọi VCB dày hơn 5 phút, giá xăng dày hơn 2 giờ, kể cả sau khởi động lại */
  pricesFetchedAt: string | null
  fuelFetchedAt: string | null
  marketFetchedAt: string | null
  refreshedAt: string | null
  errors: SourceError[]
}

export function emptyState(): State {
  return {
    v: 2,
    articles: [],
    prices: {},
    changes: {},
    gold: null,
    goldWorld: null,
    fx: null,
    fuel: null,
    trends: [],
    market: null,
    marketQuotes: {},
    marketOutlook: [],
    marketExpert: [],
    pricesFetchedAt: null,
    fuelFetchedAt: null,
    marketFetchedAt: null,
    refreshedAt: null,
    errors: [],
  }
}

/**
 * Đọc state đã lưu; khuôn lạ (file hỏng, phiên bản không biết) thì bắt đầu lại từ đầu.
 * v1 chỉ thiếu các trường chứng khoán (v2 thêm vào), nên nâng lên v2 bằng giá trị trống thay vì bỏ cả
 * lịch sử giá 10 ngày — mất lịch sử thì mũi tên so "hôm qua" biến mất một ngày.
 */
export function reviveState(raw: unknown): State {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as State).articles)) return emptyState()
  const v = (raw as { v?: unknown }).v
  if (v === 2) return { ...emptyState(), ...(raw as State) }
  if (v === 1) return { ...emptyState(), ...(raw as Omit<State, 'v'>), v: 2 }
  return emptyState()
}

const ARTICLE_DAYS = 3
const PRICE_DAYS = 10
/** Giá không đổi thì chỉ ghi thêm điểm mới sau ngần này — đủ mịn để so "hôm qua" mà file không phình */
const SAME_PRICE_GAP_MS = 55 * 60_000

/** Thêm bài chưa có (theo id). Trả về số bài mới */
export function addArticles(state: State, articles: Article[]): number {
  const seen = new Set(state.articles.map((a) => a.id))
  let added = 0
  for (const a of articles) {
    if (seen.has(a.id)) continue
    seen.add(a.id)
    state.articles.push(a)
    added++
  }
  return added
}

export function recordPrice(state: State, key: string, value: number, at: string) {
  const points = (state.prices[key] ??= [])
  const last = points.at(-1)
  if (last) {
    if (last.value !== value) state.changes[key] = { value: last.value, at }
    else if (Date.parse(at) - Date.parse(last.at) < SAME_PRICE_GAP_MS) return
  }
  points.push({ at, value })
}

/** Giá gần nhất ghi được tại hoặc trước thời điểm `iso` */
export function priceAtOrBefore(state: State, key: string, iso: string): PricePoint | null {
  const points = state.prices[key] ?? []
  for (let i = points.length - 1; i >= 0; i--) if (points[i]!.at <= iso) return points[i]!
  return null
}

export function pruneState(state: State, now: number) {
  const articleCut = new Date(now - ARTICLE_DAYS * 864e5).toISOString()
  state.articles = state.articles.filter((a) => a.publishedAt >= articleCut)
  const priceCut = new Date(now - PRICE_DAYS * 864e5).toISOString()
  for (const [key, points] of Object.entries(state.prices)) {
    const kept = points.filter((p) => p.at >= priceCut)
    // Luôn giữ điểm mới nhất để còn biết giá hiện tại có đổi hay không
    state.prices[key] = kept.length ? kept : points.slice(-1)
  }
}
