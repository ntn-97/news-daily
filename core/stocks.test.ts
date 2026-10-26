import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { buildBrief } from './brief.ts'
import { emptyState } from './state.ts'
import {
  extractTickers,
  inTradingHours,
  isOutlookColumn,
  parseVietstockNotes,
  parseVndIndices,
  parseVndStocks,
} from './stocks.ts'

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8')

describe('parseVndIndices', () => {
  it('lấy 4 chỉ số của phiên mới nhất, bỏ dòng phiên trước', () => {
    const { session, time, indices } = parseVndIndices(fixture('vnd-indices.json'))
    expect(session).toBe('2026-10-26')
    expect(time).toBe('15:33:00')
    expect(indices.map((i) => i.label)).toEqual(['VN-Index', 'VN30', 'HNX-Index', 'UPCoM'])
    expect(indices[0]).toMatchObject({
      code: 'VNINDEX',
      close: 1763.55,
      value: 11_874_734_496_060,
      advances: 97,
      declines: 203,
      noChange: 65,
    })
    expect(indices[0]!.pctChange).toBeCloseTo(-0.6, 2)
  })
  it('thiếu VN-Index hoặc điểm lệch đơn vị thì ném lỗi', () => {
    const doc = JSON.parse(fixture('vnd-indices.json')) as { data: { code: string; close: number }[] }
    expect(() => parseVndIndices(JSON.stringify({ data: doc.data.filter((r) => r.code !== 'VNINDEX') }))).toThrow(
      /VN-Index/,
    )
    const scaled = doc.data.map((r) => (r.code === 'VNINDEX' ? { ...r, close: r.close * 1000 } : r))
    expect(() => parseVndIndices(JSON.stringify({ data: scaled }))).toThrow(/VNINDEX/)
  })
})

describe('parseVndStocks', () => {
  it('đọc mã tăng / giảm mạnh, giá theo nghìn đồng', () => {
    const gainers = parseVndStocks(fixture('vnd-gainers.json'))
    expect(gainers.map((s) => s.code)).toEqual(['VGC', 'GAS', 'OCB', 'VJC', 'BSI'])
    expect(gainers[0]).toEqual({ code: 'VGC', close: 46.3, pctChange: 4.0449, value: 202_554_805_000, ceiling: false, floor: false })
    expect(parseVndStocks(fixture('vnd-losers.json'))[0]).toMatchObject({ code: 'LPS', close: 17.5, pctChange: -6.4171 })
  })
  it('đánh dấu mã đóng cửa ở giá trần / sàn', () => {
    const row = { code: 'AAA', close: 10.7, pctChange: 6.97, nmValue: 1, ceilingPrice: 10.7, floorPrice: 9.3 }
    expect(parseVndStocks(JSON.stringify({ data: [row] }))[0]).toMatchObject({ ceiling: true, floor: false })
  })
  it('phiên chưa có số liệu thì trả mảng rỗng; giá tính bằng đồng thì ném lỗi', () => {
    expect(parseVndStocks('{"data":[]}')).toEqual([])
    const row = { code: 'VGC', close: 46_300, pctChange: 4, nmValue: 1 }
    expect(() => parseVndStocks(JSON.stringify({ data: [row] }))).toThrow(/VGC/)
    expect(() => parseVndStocks('{"error":"x"}')).toThrow()
  })
})

describe('extractTickers', () => {
  it('lấy mã 3 ký tự viết hoa trong tiêu đề', () => {
    expect(extractTickers('CTD, TCB và PNJ có gì đáng chú ý?')).toEqual(['CTD', 'TCB', 'PNJ'])
    expect(extractTickers('SAB - Lợi thế còn đủ lớn trong thị trường đang dịch chuyển? (Kỳ 2)')).toEqual(['SAB'])
  })
  it('bỏ công ty chứng khoán đứng đầu tiêu đề và chữ viết tắt trùng mã', () => {
    expect(extractTickers('SSI: Khuyến nghị mua FPT, giá mục tiêu 80.000 đồng')).toEqual(['FPT'])
    expect(extractTickers('Giá USD tăng, CEO ngân hàng ở TP. HCM nói gì về lãi suất?')).toEqual([])
    expect(extractTickers('Góc nhìn 23/10: Áp lực chốt lời xuất hiện?')).toEqual([])
    expect(extractTickers('HĐQT thông qua phương án tăng vốn, TPHCM')).toEqual([])
  })
})

describe('parseVietstockNotes', () => {
  it('đọc bài ý kiến chuyên gia kèm mã nhắc tới, link https', () => {
    const notes = parseVietstockNotes(fixture('vietstock-chuyen-gia.rss'))
    expect(notes[0]).toMatchObject({
      title: 'CTD, TCB và PNJ có gì đáng chú ý?',
      source: 'Vietstock',
      publishedAt: '2026-10-26T07:11:11.000Z',
      tickers: ['CTD', 'TCB', 'PNJ'],
    })
    expect(notes.every((n) => n.link.startsWith('https://vietstock.vn/'))).toBe(true)
  })
  it('bỏ bài phái sinh, chứng quyền khỏi nhận định thị trường', () => {
    const titles = parseVietstockNotes(fixture('vietstock-nhan-dinh.rss')).map((n) => n.title)
    expect(titles[0]).toBe('Nhịp đập Thị trường 26/10: Lùi về dưới mốc tham chiếu, thị trường phân hóa rõ nét')
    expect(titles.some((t) => /phái sinh|chứng quyền/i.test(t))).toBe(false)
  })
  it('chỉ loạt "Góc nhìn" là nhận định chung', () => {
    expect(isOutlookColumn('Góc nhìn tuần 26-30/10: Đừng FOMO ở vùng cản')).toBe(true)
    expect(isOutlookColumn('Minh bạch thị trường vàng cần bắt đầu từ dữ liệu và sự đồng thuận')).toBe(false)
  })
})

describe('inTradingHours', () => {
  // Giờ Việt Nam = UTC+7; 26/10/2026 là thứ Hai
  const vn = (day: number, h: number, m = 0) => Date.UTC(2026, 9, day, h - 7, m)
  it('thứ Hai–Sáu 8:45–15:15 giờ Việt Nam', () => {
    expect(inTradingHours(vn(26, 10))).toBe(true)
    expect(inTradingHours(vn(26, 8, 30))).toBe(false)
    expect(inTradingHours(vn(26, 15, 30))).toBe(false)
    expect(inTradingHours(vn(25, 10))).toBe(false) // Chủ nhật
  })
})

describe('buildBrief: chứng khoán', () => {
  it('bài chuyên gia có mã vào mục mã được nhắc tới, loạt "Góc nhìn" vào nhận định', () => {
    const s = emptyState()
    const now = Date.parse('2026-10-26T09:00:00.000Z')
    s.market = { session: '2026-10-26', time: '15:33:00', indices: [], moversSession: '2026-10-26', gainers: [], losers: [] }
    const note = (title: string, hoursAgo: number, tickers: string[] = []) => ({
      title,
      link: `https://vietstock.vn/${encodeURIComponent(title)}`,
      source: 'Vietstock',
      publishedAt: new Date(now - hoursAgo * 3.6e6).toISOString(),
      tickers,
    })
    s.marketOutlook = [note('Nhịp đập Thị trường 26/10', 3), note('Nhịp đập Thị trường 20/10', 150)]
    s.marketExpert = [
      note('CTD, TCB và PNJ có gì đáng chú ý?', 2, ['CTD', 'TCB', 'PNJ']),
      note('Góc nhìn 27/10: Thận trọng', 1),
      note('Minh bạch thị trường vàng', 1),
      note('ANV, PDR và PLX có gì hấp dẫn?', 24 * 8, ['ANV', 'PDR', 'PLX']),
    ]
    const market = buildBrief(s, now).market!
    expect(market.outlook.map((n) => n.title)).toEqual(['Góc nhìn 27/10: Thận trọng', 'Nhịp đập Thị trường 26/10'])
    expect(market.picks.map((n) => n.title)).toEqual(['CTD, TCB và PNJ có gì đáng chú ý?'])
  })
})
