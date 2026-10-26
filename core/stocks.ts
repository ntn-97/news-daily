/**
 * Chứng khoán trong nước: chỉ số, mã tăng / giảm mạnh trong phiên, bài nhận định và mã được chuyên gia nhắc tới.
 * Bóc lệch khuôn thì ném lỗi như giá vàng: chỉ số sai đơn vị mà trông như thật còn tệ hơn không có.
 *
 * Nguồn (thử ngày 26/10/2026):
 * - Chỉ số và giá cổ phiếu: API công khai của VNDirect. Lọc và sắp xếp ngay trên server (theo sàn, ngày,
 *   giá trị khớp lệnh) nên mỗi lượt chỉ vài request nhỏ. Giá cổ phiếu tính bằng nghìn đồng.
 * - Bài nhận định: RSS Vietstock "Nhận định thị trường" và "Ý kiến chuyên gia". Bài ý kiến chuyên gia hay có
 *   dạng "CTD, TCB và PNJ có gì đáng chú ý?" — tóm tắt khuyến nghị của các công ty chứng khoán. Mã trong tiêu
 *   đề được hỏi lại VNDirect để chắc là mã thật trước khi hiện.
 * - Đã thử, không dùng: khuyến nghị của VNDirect (/v4/recommendations) dừng cập nhật từ 23/07/2026;
 *   API TCBS chặn bằng Cloudflare.
 */
import type { MarketIndex, MarketNote, MarketStock } from '../shared/types.ts'
import { canonicalLink } from './ids.ts'
import { parseFeed } from './rss.ts'

export const VND_API = 'https://api-finfo.vndirect.com.vn/v4'
export const VIETSTOCK_OUTLOOK_URL = 'https://vietstock.vn/1636/nhan-dinh-phan-tich/nhan-dinh-thi-truong.rss'
export const VIETSTOCK_EXPERT_URL = 'https://vietstock.vn/145/chung-khoan/y-kien-chuyen-gia.rss'

// ── Chỉ số ───────────────────────────────────────────────────────────────────────────────────

/** Thứ tự hiện trên trang, kèm khoảng điểm hợp lý: ngoài khoảng là nguồn đổi đơn vị */
const INDICES = [
  { code: 'VNINDEX', label: 'VN-Index', min: 200, max: 10_000 },
  { code: 'VN30', label: 'VN30', min: 200, max: 10_000 },
  { code: 'HNX', label: 'HNX-Index', min: 30, max: 2_000 },
  { code: 'UPCOM', label: 'UPCoM', min: 20, max: 1_000 },
] as const

/** Lấy dư một phiên: sắp theo ngày giảm dần, mỗi chỉ số giữ dòng mới nhất */
export const VND_INDICES_URL = `${VND_API}/vnmarket_prices?sort=date:desc&size=8&q=code:${INDICES.map((i) => i.code).join(',')}`

interface VndIndexRow {
  code?: string
  date?: string
  time?: string
  close?: number
  change?: number
  pctChange?: number
  nmValue?: number
  advances?: number
  declines?: number
  noChange?: number
}

function vndRows<T>(json: string, what: string): T[] {
  const doc = JSON.parse(json) as { data?: T[] }
  if (!Array.isArray(doc.data)) throw new Error(`VNDirect: không có dữ liệu ${what}`)
  return doc.data
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function parseVndIndices(json: string): { session: string; time: string; indices: MarketIndex[] } {
  const rows = vndRows<VndIndexRow>(json, 'chỉ số')
  const session = rows.find((r) => r.code === 'VNINDEX')?.date
  if (!session || !/^\d{4}-\d{2}-\d{2}$/.test(session)) throw new Error('VNDirect: thiếu VN-Index')
  const indices: MarketIndex[] = []
  let time = ''
  for (const { code, label, min, max } of INDICES) {
    // Chỉ lấy chỉ số cùng phiên với VN-Index; thiếu phiên đó thì bỏ hẳn chỉ số, không lấy phiên cũ
    const r = rows.find((x) => x.code === code && x.date === session)
    if (!r) continue
    const { close, change, pctChange, nmValue, advances, declines, noChange } = r
    if (
      !isNum(close) || close < min || close > max ||
      !isNum(change) || !isNum(pctChange) || Math.abs(pctChange) > 20 ||
      !isNum(nmValue) || nmValue < 0 ||
      !isNum(advances) || !isNum(declines) || !isNum(noChange)
    ) {
      throw new Error(`VNDirect: chỉ số ${code} lệch khuôn`)
    }
    if (code === 'VNINDEX') time = r.time ?? ''
    indices.push({ code, label, close, change, pctChange, value: nmValue, advances, declines, noChange })
  }
  return { session, time, indices }
}

// ── Cổ phiếu ─────────────────────────────────────────────────────────────────────────────────

/** Mã khớp lệnh dưới ngần này (đồng) không xếp vào tăng / giảm mạnh: mã ít thanh khoản kịch trần chỉ vài lô */
export const MOVER_MIN_VALUE = 10_000_000_000
export const MOVERS_SIZE = 5

/** Mã tăng (desc) hoặc giảm (asc) mạnh nhất sàn HOSE trong phiên, chỉ cổ phiếu (bỏ ETF, chứng quyền) */
export function vndMoversUrl(session: string, order: 'desc' | 'asc') {
  return `${VND_API}/stock_prices?sort=pctChange:${order}&size=${MOVERS_SIZE}&q=floor:HOSE~type:STOCK~date:${session}~nmValue:gte:${MOVER_MIN_VALUE}`
}

export function vndQuotesUrl(session: string, codes: string[]) {
  return `${VND_API}/stock_prices?size=${codes.length}&q=code:${codes.join(',')}~date:${session}`
}

interface VndStockRow {
  code?: string
  close?: number
  pctChange?: number
  nmValue?: number
  ceilingPrice?: number
  floorPrice?: number
}

/** Mảng rỗng là hợp lệ (phiên chưa có số liệu); dòng lệch khuôn thì ném lỗi */
export function parseVndStocks(json: string): MarketStock[] {
  return vndRows<VndStockRow>(json, 'cổ phiếu').map((r) => {
    const { code, close, pctChange, nmValue, ceilingPrice, floorPrice } = r
    // Giá tính bằng nghìn đồng: quá 5.000 là nguồn đã đổi sang đồng. Biên độ lớn nhất là ±40% (UPCoM ngày đầu)
    if (
      typeof code !== 'string' || !/^[A-Z0-9]{3,10}$/.test(code) ||
      !isNum(close) || close <= 0 || close > 5_000 ||
      !isNum(pctChange) || Math.abs(pctChange) > 40 ||
      !isNum(nmValue) || nmValue < 0
    ) {
      throw new Error(`VNDirect: giá cổ phiếu ${code ?? '?'} lệch khuôn`)
    }
    return {
      code,
      close,
      pctChange,
      value: nmValue,
      ceiling: isNum(ceilingPrice) && close >= ceilingPrice,
      floor: isNum(floorPrice) && close <= floorPrice,
    }
  })
}

// ── Bài nhận định ────────────────────────────────────────────────────────────────────────────

/**
 * Chữ viết tắt hay gặp trong tin tài chính trùng với mã thật (USD, CEO, HCM của Chứng khoán HSC, VND của
 * VNDirect...) hoặc dễ bị nhầm là mã. Bỏ hẳn: thà sót một mã còn hơn gắn nhầm "TP. HCM" thành cổ phiếu HCM.
 */
const NOT_TICKERS = new Set([
  'USD', 'VND', 'CEO', 'CFO', 'ETF', 'IPO', 'GDP', 'FDI', 'CPI', 'PMI', 'ESG', 'EPS', 'ROE', 'ROA', 'NIM',
  'CAR', 'FED', 'ECB', 'BOJ', 'IMF', 'ATC', 'ATO', 'OTC', 'NAV', 'HCM', 'EVN', 'FTA', 'WTO', 'KRX',
])

/**
 * Mã cổ phiếu trong tiêu đề: 3 ký tự viết hoa đứng riêng. "SSI: ..." ở đầu tiêu đề là công ty chứng khoán
 * đưa ra nhận định, không phải mã được nhắc tới.
 */
export function extractTickers(title: string): string[] {
  const speaker = /^([A-Z][A-Z0-9]{2})\s*:/.exec(title)?.[1]
  const found = [...title.matchAll(/(?<![\p{L}\p{N}])[A-Z][A-Z0-9]{2}(?![\p{L}\p{N}])/gu)].map((m) => m[0])
  return [...new Set(found)].filter((t) => t !== speaker && !NOT_TICKERS.has(t))
}

/** Phái sinh, chứng quyền là sân riêng của dân lướt sóng: không đưa vào phần nhận định chung */
const NICHE = /phái sinh|chứng quyền/i

/** Mục "Ý kiến chuyên gia" lẫn bài vĩ mô, vàng...; trong số bài không nhắc mã, chỉ loạt "Góc nhìn" (nhận định
 *  phiên tới / tuần tới) là nhận định thị trường */
export const isOutlookColumn = (title: string) => /^Góc nhìn\b/i.test(title)

export function parseVietstockNotes(xml: string): MarketNote[] {
  return parseFeed(xml)
    .filter((it) => it.publishedAt !== null && !NICHE.test(it.title))
    .map((it) => ({
      title: it.title,
      // RSS Vietstock ghi link http://, trang chạy được https
      link: canonicalLink(it.link).replace(/^http:\/\//, 'https://'),
      source: 'Vietstock',
      publishedAt: it.publishedAt!,
      tickers: extractTickers(it.title),
    }))
}

/** Bài chuyên gia nhắc mã ra thưa (vài bài / tuần): giữ một tuần. Quá hạn thì không hỏi giá mã nữa */
export const PICK_DAYS = 7

// ── Lịch tải ─────────────────────────────────────────────────────────────────────────────────

/** Phiên HOSE 9:00–14:45, khớp lệnh thoả thuận tới 15:00 — lấy rộng ra 8:45–15:15 giờ Việt Nam, thứ Hai–Sáu */
export function inTradingHours(now: number): boolean {
  const vn = new Date(now + 7 * 3.6e6)
  const day = vn.getUTCDay()
  const minutes = vn.getUTCHours() * 60 + vn.getUTCMinutes()
  return day >= 1 && day <= 5 && minutes >= 8 * 60 + 45 && minutes <= 15 * 60 + 15
}
