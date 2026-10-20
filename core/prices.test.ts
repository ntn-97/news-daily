import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { parseGoldApi, parsePnj, parseVcb, parseWebgiaFuel, vcbTime } from './prices.ts'
import { parseGoogleTrends } from './trends.ts'

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8')

describe('parsePnj', () => {
  it('đổi nghìn đồng / chỉ ra đồng / lượng', () => {
    const { rows, sourceTime } = parsePnj(fixture('pnj.json'))
    expect(rows).toEqual([
      { key: 'gold-sjc', label: 'Vàng miếng SJC', buy: 139_600_000, sell: 142_600_000 },
      { key: 'gold-ring', label: 'Nhẫn trơn 999.9', buy: 138_500_000, sell: 141_500_000 },
    ])
    expect(sourceTime).toBe('20/10/2026 10:06:14')
  })
  it('PNJ đổi đơn vị thì ném lỗi thay vì hiện giá sai 10.000 lần', () => {
    const json = JSON.stringify({ data: [{ masp: 'SJC', giamua: 139_600_000, giaban: 142_600_000 }] })
    expect(() => parsePnj(json)).toThrow(/đơn vị/)
  })
})

describe('parseGoldApi', () => {
  it('lấy giá USD / ounce', () => {
    expect(parseGoldApi(fixture('gold-api.json'))).toBeCloseTo(4122.3, 1)
  })
})

describe('parseVcb', () => {
  it('đọc số kiểu Mỹ của Vietcombank', () => {
    const { rows, sourceTime } = parseVcb(fixture('vcb.xml'))
    expect(rows.find((r) => r.code === 'USD')).toEqual({ code: 'USD', buy: 25_650, sell: 26_060 })
    expect(rows.find((r) => r.code === 'JPY')).toEqual({ code: 'JPY', buy: 157.21, sell: 168.04 })
    expect(sourceTime).toBe('15:30:03 20/10/2026')
  })
  it('đổi giờ AM/PM sang 24 giờ', () => {
    expect(vcbTime('10/20/2026 3:16:33 PM')).toBe('15:16:33 20/10/2026')
    expect(vcbTime('1/2/2026 12:05:00 AM')).toBe('00:05:00 02/01/2026')
    expect(vcbTime('1/2/2026 12:05:00 PM')).toBe('12:05:00 02/01/2026')
  })
})

describe('parseWebgiaFuel', () => {
  it('đọc bảng giá Petrolimex, bỏ dòng tiêu đề và dòng đơn vị', () => {
    const { rows, sourceTime, crude } = parseWebgiaFuel(fixture('webgia-petrolimex.html'))
    expect(rows.map((r) => r.label)).toEqual([
      'Xăng E10 RON 95 mức 5',
      'Xăng E10 RON 95 mức 3',
      'Xăng E5 RON 92 mức 2',
      'Dầu DO 0,001S mức 5',
      'Dầu DO 0,05S mức 2',
      'Dầu hỏa 2-K',
    ])
    expect(rows[1]).toEqual({ key: 'fuel-xang-e10-ron-95-muc-3', label: 'Xăng E10 RON 95 mức 3', region1: 28_250, region2: 28_810 })
    expect(sourceTime).toBe('14:00:24 15/10/2026')
    expect(crude).toEqual([
      { name: 'WTI', usdPerBarrel: 99.39, change: 0.85 },
      { name: 'Brent', usdPerBarrel: 110.56, change: 1.01 },
    ])
  })
  it('trang đổi khuôn thì ném lỗi', () => {
    expect(() => parseWebgiaFuel('<html><body>Bảo trì</body></html>')).toThrow()
  })
})

describe('parseGoogleTrends', () => {
  it('lấy từ khoá, lượt tìm và bài báo liên quan', () => {
    const trends = parseGoogleTrends(fixture('google-trends.xml'))
    expect(trends).toHaveLength(10)
    expect(trends[0]).toMatchObject({ keyword: 'lương hưu', traffic: '2000+' })
    expect(trends[0]!.news[0]).toEqual({
      title: 'Năm 2027, chi trả trợ cấp thất nghiệp qua VNeID',
      link: 'https://laodong.vn/suc-khoe/nam-2027-chi-tra-tro-cap-that-nghiep-qua-vneid-1786202.ldo',
      source: 'Laodong.vn',
    })
  })
})
