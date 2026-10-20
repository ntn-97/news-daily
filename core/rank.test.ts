import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { buildSections, clusterArticles, properNouns, sectionOf, tagsFor, type Article } from './rank.ts'

/** 509 bài thật của 4 mục trong 30 giờ tính tới 15:39 ngày 20/10/2026 */
const REAL: Article[] = JSON.parse(
  readFileSync(new URL('./__fixtures__/articles-2026-10-20.json', import.meta.url), 'utf8'),
)
const NOW = Date.parse('2026-10-20T08:40:00Z')

function groupOfTitle(groups: Article[][], title: string) {
  const g = groups.find((g) => g.some((a) => a.title === title))
  if (!g) throw new Error(`không thấy bài "${title}"`)
  return g.map((a) => a.title)
}

describe('gộp bài trùng trên dữ liệu thật', () => {
  const groups = clusterArticles(REAL)

  it('gộp cùng một việc dù mỗi báo đặt tít một kiểu', () => {
    expect(groupOfTitle(groups, "Ông Trump muốn New Mexico lập tức đổi thành 'New America'")).toHaveLength(4)
    expect(groupOfTitle(groups, 'Rò rỉ hóa chất ở Hà Nội, 40 người vào viện')).toContain(
      'Rò rỉ khí hóa chất, hơn 40 người nhập viện',
    )
    expect(groupOfTitle(groups, 'Máy bay bốc cháy ngùn ngụt ngay trước khi cất cánh tại Peru')).toContain(
      'Máy bay Airbus phát hỏa ở động cơ trước giờ cất cánh ở Peru',
    )
  })

  it('không gộp hai việc cùng khuôn chữ ở hai nơi', () => {
    expect(groupOfTitle(groups, 'Hà Tĩnh điều động, luân chuyển, bổ nhiệm 10 cán bộ chủ chốt')).toHaveLength(1)
    expect(groupOfTitle(groups, 'Phạt tài xế xe tải vào đường cấm, làm hỏng biển báo trên cầu Yên Bái')).not.toContain(
      'Chủ xe tải bị phạt 10 triệu đồng vì để tài xế chạy quá thời gian quy định',
    )
  })

  it('một báo không đứng hai lần trong một nhóm', () => {
    for (const g of groups) expect(new Set(g.map((a) => a.source)).size).toBe(g.length)
  })

  it('không bài nào bị mất hay lặp', () => {
    expect(groups.flat()).toHaveLength(REAL.length)
  })
})

describe('buildSections', () => {
  const sections = buildSections(REAL, NOW, 40)

  it('mỗi chuyện chỉ nằm ở một mục', () => {
    const ids = Object.values(sections).flatMap((s) => s.map((x) => x.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('chuyện nhiều báo cùng đưa xếp trên chuyện một báo cùng độ mới', () => {
    const at = '2026-10-20T08:00:00Z'
    const mk = (id: string, source: string, title: string): Article => ({
      id, section: 'vn', source, title, link: `https://x.vn/${id}`, summary: '', image: null, publishedAt: at,
    })
    const out = buildSections(
      [
        mk('a', 'A', 'Một chuyện chỉ một báo đưa về cầu Long Biên'),
        mk('b1', 'A', 'Sạt lở sông Tiền cuốn sập 2 căn nhà ở Đồng Tháp'),
        mk('b2', 'B', 'Sạt lở sông Tiền cuốn sập hai căn nhà tại Đồng Tháp'),
        mk('c', 'C', 'Đồng Tháp: sạt lở sông Tiền, 2 căn nhà bị cuốn sập'),
        mk('d', 'D', 'Hà Nội công bố danh mục cây cấm trồng'),
      ],
      NOW,
      10,
    )
    expect(out.vn[0]!.related.length).toBeGreaterThan(0)
    expect(out.vn[0]!.title).toMatch(/Sạt lở sông Tiền/)
  })
})

describe('nhãn', () => {
  it('phốt: nhận cả khi chữ nằm trong sapo', () => {
    expect(tagsFor('drama', 'Thuý Ngân lên tiếng', 'Nữ diễn viên đáp trả ồn ào trang phục')).toContain('drama')
    expect(tagsFor('drama', 'Đồng Lan hát về khát khao của phái đẹp', 'Ca sĩ ra MV mới')).not.toContain('drama')
  })
  it('địa chính trị: xung đột, ngoại giao — không phải mọi tin có chữ "Mỹ"', () => {
    expect(tagsFor('world', 'Mỹ hoãn chuyển tên lửa Patriot cho Ukraine', '')).toContain('geo')
    expect(tagsFor('world', 'Tỉ phú Musk hứa tặng cổ phiếu SpaceX cho mọi trẻ em ở Mỹ', '')).not.toContain('geo')
  })
  it('chỉ gắn nhãn phù hợp với mục', () => {
    expect(tagsFor('vn', 'Dân mạng bức xúc vì clip', '')).toEqual([])
    expect(tagsFor('hot', 'Dân mạng bức xúc vì clip', '')).toEqual(['drama', 'viral'])
  })
})

describe('properNouns', () => {
  it('lấy chữ viết hoa trừ chữ đầu câu', () => {
    expect([...properNouns('Chủ tịch TP.HCM điều động cán bộ')]).toEqual(['tp', 'hcm'])
    expect([...properNouns('Hà Tĩnh điều động cán bộ')]).toEqual(['tĩnh'])
  })
})

describe('sectionOf', () => {
  it('theo mục có nhiều bài nhất, hoà thì theo bài đại diện', () => {
    const a = (section: Article['section']) => ({ section }) as Article
    expect(sectionOf([a('hot'), a('vn'), a('vn')])).toBe('vn')
    expect(sectionOf([a('hot'), a('vn')])).toBe('hot')
  })
})
