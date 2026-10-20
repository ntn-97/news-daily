/**
 * Bóc giá vàng, xăng dầu, tỷ giá. Mỗi nguồn có một hàm bóc dữ liệu thuần, test bằng file thật trong
 * __fixtures__. Bóc lệch khuôn thì ném lỗi, không trả số rỗng: giá sai mà trông như thật còn tệ hơn
 * không có giá.
 *
 * Nguồn (thử ngày 20/10/2026):
 * - Vàng trong nước: API công khai của PNJ. SJC chặn bằng Cloudflare, DOJI đang tắt API.
 * - Vàng thế giới: api.gold-api.com, không cần khoá.
 * - Tỷ giá: XML Vietcombank (VCB ghi chú chỉ nên gọi 5 phút một lần).
 * - Xăng dầu: bảng giá Petrolimex chép lại trên webgia.com. Trang Petrolimex tải giá bằng JS qua API
 *   có mã hoá; webgia trả HTML tĩnh, kèm giá dầu thô WTI / Brent.
 */
import { XMLParser } from 'fast-xml-parser'

import type { CrudeOil } from '../shared/types.ts'
import { stripHtml } from './rss.ts'

/** "26,123.00" (kiểu Mỹ của VCB) hoặc "29.050" (kiểu Việt của webgia) → số; "-" → null */
function num(raw: string | undefined, style: 'us' | 'vi'): number | null {
  if (!raw) return null
  const s = raw.trim()
  if (s === '' || s === '-') return null
  const cleaned = style === 'us' ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.')
  const n = Number(cleaned.replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

// ── Vàng PNJ ─────────────────────────────────────────────────────────────────────────────────

export interface RawGoldRow {
  key: string
  label: string
  buy: number
  sell: number
}

/** PNJ niêm yết theo nghìn đồng / chỉ; 1 lượng = 10 chỉ → nhân 10.000 ra đồng / lượng */
const PNJ_TO_VND_PER_LUONG = 10_000

const PNJ_ROWS = [
  { masp: 'SJC', key: 'gold-sjc', label: 'Vàng miếng SJC' },
  { masp: 'N24K', key: 'gold-ring', label: 'Nhẫn trơn 999.9' },
] as const

export function parsePnj(json: string): { rows: RawGoldRow[]; sourceTime: string } {
  const doc = JSON.parse(json) as {
    data?: { masp: string; giamua: number | string; giaban: number | string }[]
    updateDate?: string
  }
  if (!Array.isArray(doc.data)) throw new Error('PNJ: không có bảng giá')
  const rows = PNJ_ROWS.map(({ masp, key, label }) => {
    const r = doc.data!.find((d) => d.masp === masp)
    const buy = Number(r?.giamua)
    const sell = Number(r?.giaban)
    // Giá một chỉ vàng 999.9 phải nằm trong khoảng hợp lý (nghìn đồng); ngoài khoảng là đổi đơn vị
    if (!r || !(buy > 1_000 && buy < 100_000) || !(sell > 1_000 && sell < 100_000)) {
      throw new Error(`PNJ: thiếu hoặc lệch đơn vị giá ${masp}`)
    }
    return { key, label, buy: buy * PNJ_TO_VND_PER_LUONG, sell: sell * PNJ_TO_VND_PER_LUONG }
  })
  return { rows, sourceTime: doc.updateDate ?? '' }
}

export const PNJ_URL = 'https://edge-api.pnj.io/ecom-frontend/v1/get-gold-price?zone=00'

// ── Vàng thế giới ────────────────────────────────────────────────────────────────────────────

export function parseGoldApi(json: string): number {
  const doc = JSON.parse(json) as { symbol?: string; price?: number }
  if (doc.symbol !== 'XAU' || !(Number(doc.price) > 100)) throw new Error('gold-api: dữ liệu lạ')
  return Number(doc.price)
}

export const GOLD_API_URL = 'https://api.gold-api.com/price/XAU'

/** Một lượng = 37,5 g; một ounce troy = 31,1034768 g */
export const OUNCE_PER_LUONG = 37.5 / 31.1034768

// ── Tỷ giá Vietcombank ───────────────────────────────────────────────────────────────────────

export interface RawFxRow {
  code: string
  buy: number | null
  sell: number
}

export const FX_CODES = ['USD', 'EUR', 'JPY', 'CNY', 'KRW'] as const

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseAttributeValue: false })

export function parseVcb(text: string): { rows: RawFxRow[]; sourceTime: string } {
  const doc = xml.parse(text) as {
    ExrateList?: { DateTime?: string; Exrate?: Record<string, string>[] | Record<string, string> }
  }
  const list = doc.ExrateList?.Exrate
  const all = Array.isArray(list) ? list : list ? [list] : []
  const rows = FX_CODES.map((code) => {
    const r = all.find((x) => x['@_CurrencyCode'] === code)
    const sell = num(r?.['@_Sell'], 'us')
    if (sell === null) throw new Error(`VCB: thiếu tỷ giá bán ${code}`)
    return { code, buy: num(r?.['@_Buy'], 'us'), sell }
  })
  return { rows, sourceTime: vcbTime(doc.ExrateList?.DateTime ?? '') }
}

/** VCB ghi giờ kiểu Mỹ "10/20/2026 3:16:33 PM" → "15:16:33 20/10/2026" cho giống các nguồn khác */
export function vcbTime(raw: string): string {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)/i.exec(raw)
  if (!m) return raw
  const [, mo, d, y, hRaw, mi, s, ap] = m
  const h = (Number(hRaw) % 12) + (ap!.toUpperCase() === 'PM' ? 12 : 0)
  return `${String(h).padStart(2, '0')}:${mi}:${s} ${d!.padStart(2, '0')}/${mo!.padStart(2, '0')}/${y}`
}

export const VCB_URL = 'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx'

// ── Xăng dầu Petrolimex (qua webgia.com) ────────────────────────────────────────────────────

export interface RawFuelRow {
  key: string
  label: string
  region1: number
  region2: number
}

function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function parseWebgiaFuel(html: string): { rows: RawFuelRow[]; sourceTime: string; crude: CrudeOil[] } {
  const time = /Cập nhật lúc\s*([\d:]+\s+[\d/]+)/.exec(html)?.[1] ?? ''
  // Bảng giá là bảng đầu tiên có tiêu đề cột "Vùng 1"
  const table = /<table[^>]*>(?:(?!<\/table>)[\s\S])*?Vùng 1[\s\S]*?<\/table>/.exec(html)?.[0]
  if (!table) throw new Error('webgia: không thấy bảng giá xăng dầu')
  const body = /<tbody[^>]*>([\s\S]*?)<\/tbody>/.exec(table)?.[1] ?? ''
  const rows: RawFuelRow[] = []
  for (const tr of body.split(/<tr[^>]*>/).slice(1)) {
    // Dòng giá: một ô <th> tên mặt hàng + hai ô <td> giá. Dòng "Đơn vị: đồng / lít" không có <th>
    const label = stripHtml(/<th[^>]*>([\s\S]*?)<\/th>/.exec(tr)?.[1] ?? '')
    if (!label) continue
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => stripHtml(m[1]!))
    const region1 = num(cells[0], 'vi')
    const region2 = num(cells[1], 'vi')
    // Giá một lít xăng dầu bán lẻ phải nằm trong khoảng hợp lý (đồng)
    if (!label || region1 === null || region2 === null || region1 < 5_000 || region1 > 100_000) {
      throw new Error(`webgia: dòng giá lệch khuôn "${label}"`)
    }
    rows.push({ key: `fuel-${slug(label)}`, label, region1, region2 })
  }
  if (rows.length === 0) throw new Error('webgia: bảng giá xăng dầu rỗng')

  // Giá dầu thô ở khung bên: không bắt buộc, thiếu thì bỏ qua
  const crude: CrudeOil[] = []
  for (const name of ['WTI', 'Brent'] as const) {
    const m = new RegExp(`>${name}</a></td>\\s*<td[^>]*>\\$([\\d.,]+)</td>\\s*<td[^>]*>([+-]?[\\d.,]+)</td>`).exec(html)
    const price = num(m?.[1], 'us')
    const change = num(m?.[2], 'us')
    if (price !== null && change !== null) crude.push({ name, usdPerBarrel: price, change })
  }
  return { rows, sourceTime: time, crude }
}

export const WEBGIA_FUEL_URL = 'https://webgia.com/gia-xang-dau/petrolimex/'
