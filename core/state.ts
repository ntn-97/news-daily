/**
 * Toàn bộ dữ liệu đã lưu, dạng một object JSON. Cùng một khuôn chạy ở ba nơi:
 * - server trên Mac: file data/state.json
 * - extension Chrome: chrome.storage.local
 * - GitHub Actions: state.json đăng kèm trang, lượt sau tải về đọc tiếp
 *
 * Giữ bài 3 ngày (bản tin chỉ xem 30 giờ, phần dư để biết bài nào đã thấy) và giá 10 ngày
 * (đủ so "hôm qua"). Cỡ file khoảng 1–2 MB.
 */
import type { CrudeOil, SourceError, Trend } from '../shared/types.ts'
import type { RawFuelRow, RawFxRow, RawGoldRow } from './prices.ts'
import type { Article } from './rank.ts'

export interface PricePoint {
  at: string
  value: number
}

export interface State {
  v: 1
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
  /** Lần tải giá gần nhất — để không gọi VCB dày hơn 5 phút, giá xăng dày hơn 2 giờ, kể cả sau khởi động lại */
  pricesFetchedAt: string | null
  fuelFetchedAt: string | null
  refreshedAt: string | null
  errors: SourceError[]
}

export function emptyState(): State {
  return {
    v: 1,
    articles: [],
    prices: {},
    changes: {},
    gold: null,
    goldWorld: null,
    fx: null,
    fuel: null,
    trends: [],
    pricesFetchedAt: null,
    fuelFetchedAt: null,
    refreshedAt: null,
    errors: [],
  }
}

/** Đọc state đã lưu; khuôn lạ (phiên bản cũ, file hỏng) thì bắt đầu lại từ đầu */
export function reviveState(raw: unknown): State {
  if (raw && typeof raw === 'object' && (raw as State).v === 1 && Array.isArray((raw as State).articles)) {
    return { ...emptyState(), ...(raw as State) }
  }
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
