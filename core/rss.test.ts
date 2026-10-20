import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { canonicalLink } from './ids.ts'
import { decodeEntities, parseFeed, parseFeedDate } from './rss.ts'

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8')

describe('decodeEntities', () => {
  it('giải mã thực thể chữ có dấu kiểu Thanh Niên, phân biệt hoa thường', () => {
    expect(decodeEntities('Ng&agrave;y 20.10, m&agrave;n tặng qu&agrave;')).toBe('Ngày 20.10, màn tặng quà')
    expect(decodeEntities('&Ocirc;ng Trump k&ecirc;u gọi')).toBe('Ông Trump kêu gọi')
    expect(decodeEntities('&Yacute; huy động')).toBe('Ý huy động')
  })
  it('giải mã thực thể số và giữ nguyên thực thể lạ', () => {
    expect(decodeEntities('Ti&#7871;ng Vi&#x1EC7;t')).toBe('Tiếng Việt')
    expect(decodeEntities('a &foo; b')).toBe('a &foo; b')
  })
})

describe('parseFeedDate', () => {
  it('đọc được múi giờ "+07" của Kenh14 mà Date.parse không đọc được', () => {
    expect(parseFeedDate('Tue, 20 Oct 2026 15:31:15 +07')).toBe('2026-10-20T08:31:15.000Z')
  })
  it('đọc +0700, GMT và GMT+7', () => {
    expect(parseFeedDate('Tue, 20 Oct 2026 14:21:17 +0700')).toBe('2026-10-20T07:21:17.000Z')
    expect(parseFeedDate('Tue, 20 Oct 2026 04:42:39 GMT')).toBe('2026-10-20T04:42:39.000Z')
    expect(parseFeedDate('Tue, 20 Oct 2026 15:00:00 GMT+7')).toBe('2026-10-20T08:00:00.000Z')
  })
  it('trả null khi không đọc được', () => {
    expect(parseFeedDate('hôm qua')).toBeNull()
    expect(parseFeedDate('')).toBeNull()
  })
})

describe('parseFeed trên RSS thật', () => {
  it('VnExpress: ảnh từ enclosure, sapo bỏ thẻ HTML', () => {
    const items = parseFeed(fixture('vnexpress.rss'))
    expect(items.length).toBeGreaterThan(30)
    const first = items[0]!
    expect(first.title).toBe('Bộ trưởng Quốc phòng Mỹ bất ngờ thăm Israel')
    expect(first.link).toBe('https://vnexpress.net/bo-truong-quoc-phong-my-bat-ngo-tham-israel-5134482.html')
    expect(first.image).toMatch(/^https:\/\/i1-vnexpress\.vnecdn\.net\/.+&h=0&q=100/)
    expect(first.summary).toMatch(/^Bộ trưởng Quốc phòng Hegseth bí mật tới Israel/)
    expect(first.publishedAt).toBe('2026-10-20T07:21:17.000Z')
  })

  it('Kenh14: tiêu đề CDATA, giờ "+07"', () => {
    const items = parseFeed(fixture('kenh14.rss'))
    expect(items.length).toBeGreaterThan(30)
    expect(items.every((i) => i.publishedAt !== null)).toBe(true)
    expect(items.every((i) => i.image?.startsWith('https://'))).toBe(true)
  })

  it('Dân trí: ảnh trong description nháy đơn, bỏ "(Dân trí) - " đầu sapo', () => {
    const first = parseFeed(fixture('dantri.rss'))[0]!
    expect(first.image).toBe('https://icdn.dantri.com.vn/2026/10/20/sieu-giau-afp11zon-1792478012053.jpg')
    expect(first.summary).toMatch(/^Khảo sát chỉ ra/)
  })

  it('BBC: ảnh từ media:thumbnail', () => {
    const first = parseFeed(fixture('bbc.rss'))[0]!
    expect(first.title).toBe('Vì sao tòa án Anh ra lệnh phong tỏa tài sản toàn cầu của Vietjet?')
    expect(first.image).toMatch(/^https:\/\/ichef\.bbci\.co\.uk\//)
  })

  it('trang lỗi HTML thì ném lỗi, không lặng lẽ thành 0 bài', () => {
    expect(() => parseFeed('<!DOCTYPE html><html><body>504 Gateway Time-out</body></html>')).toThrow()
  })
})

describe('canonicalLink', () => {
  it('bỏ tham số theo dõi để cùng bài không thành hai id', () => {
    expect(canonicalLink('https://www.bbc.com/vietnamese/articles/cm9?at_medium=RSS&at_campaign=rss')).toBe(
      'https://www.bbc.com/vietnamese/articles/cm9',
    )
    expect(canonicalLink('https://x.vn/a.html?id=5&utm_source=fb#top')).toBe('https://x.vn/a.html?id=5')
  })
})
