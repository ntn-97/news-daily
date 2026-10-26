/**
 * Ghép bản tin từ state: tin đã gộp + xếp hạng theo từng mục, bảng giá có so sánh, chứng khoán, Google Trends.
 * Hàm thuần — server, extension và GitHub Actions đều gọi cùng một hàm này.
 */
import {
  SECTIONS,
  type Brief,
  type FuelBoard,
  type FxBoard,
  type GoldBoard,
  type MarketBoard,
  type MarketNote,
  type Quote,
} from '../shared/types.ts'
import { OUNCE_PER_LUONG } from './prices.ts'
import { buildSections } from './rank.ts'
import { priceAtOrBefore, type State } from './state.ts'
import { PICK_DAYS, isOutlookColumn } from './stocks.ts'

/** Bản tin buổi sáng gom tin từ ~30 giờ qua: đủ phủ từ sáng hôm trước tới giờ đọc */
const WINDOW_HOURS = 30
const STORIES_PER_SECTION = 40
/** So "hôm qua" với giá ghi được cách đây ít nhất ngần này giờ */
const DAY_AGO_HOURS = 20
/** Nhận định thị trường chỉ đáng đọc trong vài ngày; qua cuối tuần vẫn còn bài "Góc nhìn tuần" */
const OUTLOOK_HOURS = 72
const OUTLOOK_COUNT = 4
const PICK_COUNT = 6

function dayQuote(state: State, key: string, value: number, now: number): Quote {
  const p = priceAtOrBefore(state, key, new Date(now - DAY_AGO_HOURS * 3.6e6).toISOString())
  return { value, prev: p?.value ?? null, prevAt: p?.at ?? null }
}

/** Xăng dầu: so với giá của kỳ điều chỉnh trước, không phải hôm qua */
function changeQuote(state: State, key: string, value: number): Quote {
  const c = state.changes[key]
  return { value, prev: c?.value ?? null, prevAt: c?.at ?? null }
}

function goldBoard(state: State, now: number, usdSell: number | null): GoldBoard | null {
  const { gold, goldWorld } = state
  if (!gold && goldWorld === null) return null
  return {
    rows: (gold?.rows ?? []).map((r) => ({
      key: r.key,
      label: r.label,
      buy: dayQuote(state, `${r.key}-buy`, r.buy, now),
      sell: dayQuote(state, `${r.key}-sell`, r.sell, now),
    })),
    sourceTime: gold?.sourceTime ?? '',
    world:
      goldWorld === null
        ? null
        : {
            usdPerOunce: dayQuote(state, 'gold-world-usd', goldWorld, now),
            vndPerLuong: usdSell === null ? null : goldWorld * OUNCE_PER_LUONG * usdSell,
          },
  }
}

function fxBoard(state: State, now: number): FxBoard | null {
  if (!state.fx) return null
  return {
    rows: state.fx.rows.map((r) => ({
      code: r.code,
      buy: r.buy,
      sell: dayQuote(state, `fx-${r.code}-sell`, r.sell, now),
    })),
    sourceTime: state.fx.sourceTime,
  }
}

function fuelBoard(state: State): FuelBoard | null {
  if (!state.fuel) return null
  return {
    rows: state.fuel.rows.map((r) => ({
      key: r.key,
      label: r.label,
      price: changeQuote(state, r.key, r.region1),
      region2: r.region2,
    })),
    sourceTime: state.fuel.sourceTime,
    crude: state.fuel.crude,
  }
}

const newestFirst = (a: MarketNote, b: MarketNote) => b.publishedAt.localeCompare(a.publishedAt)

function marketBoard(state: State, now: number): MarketBoard | null {
  if (!state.market) return null
  const outlookCut = new Date(now - OUTLOOK_HOURS * 3.6e6).toISOString()
  const pickCut = new Date(now - PICK_DAYS * 864e5).toISOString()
  // Bài chuyên gia không nhắc mã nào, thuộc loạt "Góc nhìn 23/10: ..." là nhận định chung
  const general = state.marketExpert.filter((n) => n.tickers.length === 0 && isOutlookColumn(n.title))
  const seen = new Set<string>()
  const outlook = [...state.marketOutlook, ...general]
    .filter((n) => n.publishedAt >= outlookCut && !seen.has(n.link) && seen.add(n.link))
    .sort(newestFirst)
    .slice(0, OUTLOOK_COUNT)
  const picks = state.marketExpert
    .filter((n) => n.tickers.length > 0 && n.publishedAt >= pickCut)
    .sort(newestFirst)
    .slice(0, PICK_COUNT)
  return { ...state.market, outlook, picks, quotes: state.marketQuotes }
}

export function buildBrief(state: State, now = Date.now()): Brief {
  const since = new Date(now - WINDOW_HOURS * 3.6e6).toISOString()
  const fx = fxBoard(state, now)
  const usdSell = fx?.rows.find((r) => r.code === 'USD')?.sell.value ?? null
  const stories = buildSections(
    state.articles.filter((a) => a.publishedAt >= since),
    now,
    STORIES_PER_SECTION,
  )
  return {
    sections: SECTIONS.map((s) => ({ ...s, stories: stories[s.id] })),
    gold: goldBoard(state, now, usdSell),
    fuel: fuelBoard(state),
    fx,
    market: marketBoard(state, now),
    trends: state.trends,
    refreshedAt: state.refreshedAt,
    refreshing: false,
    errors: state.errors,
  }
}
