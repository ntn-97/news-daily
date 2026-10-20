/**
 * Kiểu dữ liệu dùng chung giữa server (Node chạy thẳng .ts) và web.
 * Chỉ dùng cú pháp xoá được: không enum, không namespace.
 */

export const SECTIONS = [
  { id: 'hot', title: 'Nóng trên mạng', blurb: 'Chuyện đang lan trên Facebook, TikTok, Threads' },
  { id: 'drama', title: 'Drama & phốt', blurb: 'Showbiz, người nổi tiếng, ồn ào trên mạng' },
  { id: 'world', title: 'Thế giới & địa chính trị', blurb: 'Chiến sự, ngoại giao, các cường quốc' },
  { id: 'vn', title: 'Trong nước', blurb: 'Thời sự, chính sách, đời sống' },
] as const

export type SectionId = (typeof SECTIONS)[number]['id']

export const isSectionId = (v: unknown): v is SectionId => SECTIONS.some((s) => s.id === v)

/** geo: bài thế giới dính tới địa chính trị · drama: có mùi phốt, ồn ào · viral: đang lan trên MXH */
export type StoryTag = 'geo' | 'drama' | 'viral'

export interface RelatedLink {
  source: string
  title: string
  link: string
}

/** Một "câu chuyện" = một hoặc nhiều bài cùng sự việc, gộp từ các báo khác nhau */
export interface Story {
  id: string
  title: string
  link: string
  source: string
  summary: string
  image: string | null
  /** ISO. Lấy theo giờ báo đăng; báo không ghi giờ thì lấy lúc lần đầu thấy bài */
  publishedAt: string
  /** Các báo khác cùng đưa tin — càng nhiều báo, chuyện càng nóng */
  related: RelatedLink[]
  tags: StoryTag[]
}

export interface Section {
  id: SectionId
  title: string
  blurb: string
  stories: Story[]
}

/** Giá có so sánh: `prev` là giá ở mốc so sánh, `prevAt` là thời điểm của mốc đó */
export interface Quote {
  value: number
  prev: number | null
  prevAt: string | null
}

export interface GoldRow {
  key: string
  label: string
  /** đồng / lượng */
  buy: Quote
  sell: Quote
}

export interface GoldBoard {
  rows: GoldRow[]
  /** Giờ PNJ niêm yết, theo chữ của nguồn ("20/10/2026 10:06:14") */
  sourceTime: string
  world: {
    usdPerOunce: Quote
    /** Giá thế giới quy ra đồng / lượng theo tỷ giá bán USD Vietcombank; null nếu chưa có tỷ giá */
    vndPerLuong: number | null
  } | null
}

export interface FuelRow {
  key: string
  label: string
  /** đồng / lít, Vùng 1 */
  price: Quote
  region2: number
}

export interface CrudeOil {
  name: 'WTI' | 'Brent'
  usdPerBarrel: number
  change: number
}

export interface FuelBoard {
  rows: FuelRow[]
  /** Thời điểm Petrolimex áp dụng giá hiện tại ("14:00:24 15/10/2026") */
  sourceTime: string
  crude: CrudeOil[]
}

export interface FxRow {
  code: string
  buy: number | null
  sell: Quote
}

export interface FxBoard {
  rows: FxRow[]
  sourceTime: string
}

export interface Trend {
  keyword: string
  /** "2000+" — số lượt tìm ước lượng theo Google */
  traffic: string
  news: RelatedLink[]
}

export interface SourceError {
  source: string
  message: string
  at: string
}

export interface Brief {
  sections: Section[]
  gold: GoldBoard | null
  fuel: FuelBoard | null
  fx: FxBoard | null
  trends: Trend[]
  /** Lần làm mới gần nhất đã xong; null nếu server vừa khởi động và chưa lấy được gì */
  refreshedAt: string | null
  refreshing: boolean
  errors: SourceError[]
}
