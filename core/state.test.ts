import { describe, expect, it } from 'vitest'

import { buildBrief } from './brief.ts'
import { addArticles, emptyState, priceAtOrBefore, pruneState, recordPrice, reviveState } from './state.ts'

const iso = (h: number) => new Date(Date.UTC(2026, 9, 20, h)).toISOString()

describe('recordPrice', () => {
  it('giá không đổi thì tối đa một điểm / giờ', () => {
    const s = emptyState()
    recordPrice(s, 'k', 100, '2026-10-20T00:00:00.000Z')
    recordPrice(s, 'k', 100, '2026-10-20T00:20:00.000Z')
    recordPrice(s, 'k', 100, '2026-10-20T01:00:00.000Z')
    expect(s.prices.k!.map((p) => p.at)).toEqual(['2026-10-20T00:00:00.000Z', '2026-10-20T01:00:00.000Z'])
  })
  it('giá đổi thì ghi ngay và nhớ giá cũ (kỳ điều chỉnh trước của xăng)', () => {
    const s = emptyState()
    recordPrice(s, 'k', 28_250, iso(0))
    recordPrice(s, 'k', 27_950, iso(0).replace('00:00', '00:20'))
    expect(s.prices.k).toHaveLength(2)
    expect(s.changes.k).toEqual({ value: 28_250, at: '2026-10-20T00:20:00.000Z' })
  })
})

describe('priceAtOrBefore', () => {
  it('lấy điểm gần nhất không vượt mốc', () => {
    const s = emptyState()
    for (const h of [1, 3, 5]) recordPrice(s, 'k', h * 10, iso(h))
    expect(priceAtOrBefore(s, 'k', iso(4))).toEqual({ at: iso(3), value: 30 })
    expect(priceAtOrBefore(s, 'k', iso(0))).toBeNull()
  })
})

describe('pruneState', () => {
  it('bỏ bài quá 3 ngày, giá quá 10 ngày nhưng luôn giữ giá mới nhất', () => {
    const s = emptyState()
    const now = Date.parse(iso(12))
    const old = new Date(now - 4 * 864e5).toISOString()
    addArticles(s, [
      { id: 'a', section: 'vn', source: 'A', title: 'cũ', link: 'https://a', summary: '', image: null, publishedAt: old },
      { id: 'b', section: 'vn', source: 'A', title: 'mới', link: 'https://b', summary: '', image: null, publishedAt: iso(11) },
    ])
    recordPrice(s, 'fuel', 1, new Date(now - 20 * 864e5).toISOString())
    pruneState(s, now)
    expect(s.articles.map((a) => a.id)).toEqual(['b'])
    expect(s.prices.fuel).toHaveLength(1)
  })
  it('không thêm trùng bài đã có', () => {
    const s = emptyState()
    const a = { id: 'a', section: 'vn' as const, source: 'A', title: 't', link: 'https://a', summary: '', image: null, publishedAt: iso(1) }
    expect(addArticles(s, [a, a])).toBe(1)
    expect(addArticles(s, [a])).toBe(0)
  })
})

describe('reviveState', () => {
  it('file hỏng hay khuôn cũ thì bắt đầu lại từ trống', () => {
    expect(reviveState(null)).toEqual(emptyState())
    expect(reviveState({ v: 0, articles: [] })).toEqual(emptyState())
    expect(reviveState('rác')).toEqual(emptyState())
  })
})

describe('buildBrief', () => {
  it('so giá vàng với điểm cách ≥ 20 giờ; ngày đầu chưa có thì để trống', () => {
    const s = emptyState()
    s.gold = { rows: [{ key: 'gold-sjc', label: 'SJC', buy: 139_000_000, sell: 142_000_000 }], sourceTime: '' }
    recordPrice(s, 'gold-sjc-sell', 141_500_000, iso(0))
    recordPrice(s, 'gold-sjc-sell', 142_000_000, iso(22))
    const now = Date.parse(iso(22))
    const row = buildBrief(s, now).gold!.rows[0]!
    expect(row.sell).toEqual({ value: 142_000_000, prev: 141_500_000, prevAt: iso(0) })
    expect(row.buy.prev).toBeNull()
  })
})
