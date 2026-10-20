/**
 * Gộp bài trùng giữa các báo thành "câu chuyện", gắn nhãn, chia mục và xếp hạng. Hàm thuần, có test.
 *
 * Gộp: so khớp tiêu đề + sapo bằng TF-IDF (từ đơn và cặp từ liền nhau) rồi cosine. Trọng số IDF
 * làm các từ ai cũng dùng ("bộ trưởng", "hà nội") nhẹ đi, còn tên riêng ("Hegseth", "Israel") nặng lên.
 * Gộp trên toàn bộ bài của mọi mục cùng lúc, để một chuyện vừa ở Kenh14 (mục "nóng") vừa ở Tuổi Trẻ
 * (mục "trong nước") chỉ hiện một lần.
 *
 * Xếp hạng: chuyện càng mới càng cao, càng nhiều báo cùng đưa càng cao — số báo đưa tin là tín hiệu
 * "nóng" đáng tin nhất mà RSS cho được (RSS không có lượt xem hay lượt chia sẻ).
 */
import { SECTIONS, type RelatedLink, type SectionId, type Story, type StoryTag } from '../shared/types.ts'

export interface Article {
  id: string
  section: SectionId
  source: string
  title: string
  link: string
  summary: string
  image: string | null
  publishedAt: string
}

/** Chữ thường, bỏ dấu câu, giữ dấu tiếng Việt. Bao bằng khoảng trắng để so cả cụm từ trọn vẹn */
export function normalize(s: string): string {
  const t = s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  return ` ${t} `
}

function hasAny(normalized: string, words: readonly string[]) {
  return words.some((w) => normalized.includes(` ${w} `))
}

/** Dấu hiệu phốt, ồn ào. Cụm từ trọn vẹn — "tố" đứng một mình sẽ dính cả "yếu tố", "tố tụng" */
export const DRAMA_WORDS = [
  'phốt', 'bóc phốt', 'drama', 'biến căng', 'có biến', 'lùm xùm', 'ồn ào', 'tranh cãi', 'chỉ trích',
  'bức xúc', 'phẫn nộ', 'bị tố', 'tố cáo', 'tố ngược', 'đáp trả', 'đăng đàn', 'xin lỗi', 'ngoại tình',
  'tiểu tam', 'ly hôn', 'đường ai nấy đi', 'rạn nứt', 'nghi vấn', 'lộ clip', 'lộ ảnh', 'khẩu chiến',
  'cà khịa', 'mỉa mai', 'đá xéo', 'tẩy chay', 'quỵt', 'antifan', 'hủy theo dõi', 'unfollow',
  'gây sốc', 'dậy sóng', 'phản ứng gắt', 'bị réo tên', 'bị chỉ trích', 'vạ miệng', 'phát ngôn gây',
  'cấm sóng', 'ấm ức', 'tố nhau', 'bóc mẽ', 'lật mặt', 'phủ nhận', 'đính chính', 'tin đồn',
] as const

/** Dấu hiệu chuyện đang lan trên mạng xã hội */
export const SOCIAL_WORDS = [
  'mạng xã hội', 'mxh', 'dân mạng', 'cư dân mạng', 'netizen', 'viral', 'trend', 'hot trend', 'clip',
  'facebook', 'tiktok', 'threads', 'instagram', 'youtube', 'livestream', 'bài đăng', 'đăng tải',
  'gây sốt', 'gây bão', 'xôn xao', 'rần rần', 'triệu view', 'triệu lượt xem', 'lượt xem', 'lượt thích',
  'bình luận', 'bi hài', 'gây chú ý', 'tiktoker', 'youtuber', 'kol', 'hot girl', 'hot boy', 'hội nhóm',
  'người nổi tiếng', 'hot', 'chia sẻ', 'meme', 'thả tim', 'gây tranh cãi', 'dậy sóng',
] as const

/**
 * Dấu hiệu địa chính trị trong mục thế giới: xung đột, quân sự, ngoại giao giữa các nước, và các điểm nóng.
 * Cố ý không có "Mỹ", "Trump", "tổng thống", "bầu cử": gần nửa mục thế giới nhắc tới, kể cả tin
 * nội bộ nước Mỹ hay chuyện tỷ phú, nên lọc theo đó thì như không lọc.
 */
export const GEO_WORDS = [
  'chiến sự', 'chiến tranh', 'xung đột', 'ngừng bắn', 'hòa đàm', 'đàm phán', 'thượng đỉnh', 'ngoại giao',
  'ngoại trưởng', 'quốc phòng', 'quân sự', 'quân đội', 'binh sĩ', 'tình báo', 'vũ khí', 'tên lửa',
  'hạt nhân', 'không kích', 'tập kích', 'tàu chiến', 'tập trận', 'uav', 'drone', 'đảo chính', 'trừng phạt',
  'cấm vận', 'thuế quan', 'đồng minh', 'căng thẳng', 'an ninh', 'nato', 'liên hợp quốc', 'brics', 'g7',
  'g20', 'asean', 'biển đông', 'đài loan', 'triều tiên', 'ukraine', 'nga', 'trung quốc', 'israel', 'iran',
  'gaza', 'hamas', 'hezbollah', 'houthi', 'syria', 'điện kremlin', 'lầu năm góc', 'putin', 'tập cận bình',
  'zelensky', 'netanyahu', 'kim jong un',
] as const

export function isSocialBuzz(title: string, summary: string) {
  const t = normalize(title) + normalize(summary)
  return hasAny(t, SOCIAL_WORDS) || hasAny(t, DRAMA_WORDS)
}

export function tagsFor(section: SectionId, title: string, summary: string): StoryTag[] {
  const tags: StoryTag[] = []
  const t = normalize(title)
  // Xét cả sapo: tiêu đề hay giấu chữ "phốt", "dân mạng", sapo mới nói thẳng
  const full = t + normalize(summary)
  if (section === 'world' && hasAny(t, GEO_WORDS)) tags.push('geo')
  if ((section === 'hot' || section === 'drama') && hasAny(full, DRAMA_WORDS)) tags.push('drama')
  if (section === 'hot' && hasAny(full, SOCIAL_WORDS)) tags.push('viral')
  return tags
}

// ── Gộp bài trùng ────────────────────────────────────────────────────────────────────────────

/** Từ chức năng: không mang nghĩa phân biệt sự việc */
const STOP = new Set(
  (
    'của và là có được cho với các những một này đã trong khi không bị đến từ ra về sau như thì lại vì để ' +
    'hơn nhiều rất cũng mới sẽ đang vẫn còn nhưng nếu thế nào gì ai đâu sao vậy đó ấy rồi làm lên xuống ' +
    'tại theo trên dưới giữa qua đi vào nói cùng chỉ hay hoặc mà nên phải bởi do việc người ông bà anh chị ' +
    'em cô chú loạt nhất năm ngày tháng giờ hôm nay tuần mỗi tất cả'
  ).split(' '),
)

function terms(title: string, summary: string): Map<string, number> {
  const tf = new Map<string, number>()
  const add = (term: string, w: number) => tf.set(term, (tf.get(term) ?? 0) + w)
  // Tiêu đề nặng gấp đôi sapo: sapo hay lan man sang bối cảnh chung
  for (const [text, w] of [
    [title, 2],
    [summary.slice(0, 220), 1],
  ] as const) {
    const words = normalize(text).trim().split(' ').filter(Boolean)
    for (let i = 0; i < words.length; i++) {
      const a = words[i]!
      if (!STOP.has(a) && a.length > 1) add(a, w)
      const b = words[i + 1]
      if (b && !(STOP.has(a) && STOP.has(b))) add(`${a}_${b}`, w)
    }
  }
  return tf
}

/**
 * Tên riêng trong tiêu đề: các chữ viết hoa, trừ chữ đầu câu (luôn viết hoa).
 * "Chủ tịch TP.HCM điều động cán bộ" → {tp, hcm}; "Hà Tĩnh điều động cán bộ" → {tĩnh}.
 */
export function properNouns(title: string): Set<string> {
  const words = title.normalize('NFC').split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  return new Set(words.slice(1).filter((w) => /^\p{Lu}/u.test(w)).map((w) => w.toLowerCase()))
}

type Vec = Map<string, number>

function tfidfVectors(docs: Map<string, number>[]): Vec[] {
  const df = new Map<string, number>()
  for (const d of docs) for (const t of d.keys()) df.set(t, (df.get(t) ?? 0) + 1)
  const n = docs.length
  return docs.map((d) => {
    const v: Vec = new Map()
    let norm = 0
    for (const [t, f] of d) {
      const dft = df.get(t)!
      // Từ chỉ xuất hiện ở đúng một bài không giúp ghép cặp; vẫn giữ trong chuẩn hoá độ dài
      // để bài dài nhiều chi tiết riêng không bị xem là giống mọi bài
      const w = (1 + Math.log(f)) * Math.log(1 + n / dft)
      if (dft >= 2) v.set(t, w)
      norm += w * w
    }
    norm = Math.sqrt(norm)
    if (norm > 0) for (const [t, w] of v) v.set(t, w / norm)
    return v
  })
}

function cosine(a: Vec, b: Vec): number {
  const [small, big] = a.size < b.size ? [a, b] : [b, a]
  let s = 0
  for (const [t, w] of small) {
    const o = big.get(t)
    if (o) s += w * o
  }
  return s
}

/**
 * Ngưỡng chọn bằng mắt trên 509 bài thật ngày 20/10/2026: từ 0,28 trở lên gần như mọi cặp gộp đều
 * đúng việc; 0,25–0,27 bắt đầu lẫn cặp sai ("phạt xe tải vào đường cấm" với "phạt xe tải chạy quá giờ")
 */
export const SAME_STORY = 0.28
/**
 * Hai tiêu đề đều có tên riêng mà không chung tên nào ("TP.HCM bổ nhiệm cán bộ" và "Hà Tĩnh bổ nhiệm
 * cán bộ") thường là hai việc cùng khuôn chữ ở hai nơi — phải giống hơn hẳn mới gộp
 */
export const SAME_STORY_NO_SHARED_NAME = 0.45
/** Hai bài cách nhau quá xa thì không còn là cùng một tin nóng */
const MAX_GAP_HOURS = 36

/**
 * Gộp các bài cùng sự việc. Trả về từng nhóm, phần tử đầu là bài đại diện.
 * Bài nhập nhóm có bài giống nó nhất (nếu đủ ngưỡng), và một báo không đứng hai lần trong một nhóm
 * (một báo hiếm khi đăng hai bài cùng việc trong một ngày; nếu có thì đó là bài tiếp diễn, nên tách).
 * `opts` chỉ để dò ngưỡng trong test.
 */
export function clusterArticles(
  articles: Article[],
  opts: { threshold?: number; onJoin?: (a: Article, b: Article, sim: number) => void } = {},
): Article[][] {
  const threshold = opts.threshold ?? SAME_STORY
  const sorted = [...articles].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
  const vecs = tfidfVectors(sorted.map((a) => terms(a.title, a.summary)))
  const names = sorted.map((a) => properNouns(a.title))
  const groups: { idx: number[]; sources: Set<string> }[] = []
  const groupOf: number[] = []

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!
    let best = -1
    let bestSim = 0
    let bestJ = -1
    for (let j = 0; j < i; j++) {
      const g = groups[groupOf[j]!]!
      if (g.sources.has(a.source)) continue
      const gapH = (Date.parse(a.publishedAt) - Date.parse(sorted[j]!.publishedAt)) / 3.6e6
      if (gapH > MAX_GAP_HOURS) continue
      const sim = cosine(vecs[i]!, vecs[j]!)
      if (sim <= bestSim || sim < threshold) continue
      const ni = names[i]!
      const nj = names[j]!
      const disjointNames = ni.size > 0 && nj.size > 0 && ![...ni].some((n) => nj.has(n))
      if (disjointNames && sim < SAME_STORY_NO_SHARED_NAME) continue
      bestSim = sim
      best = groupOf[j]!
      bestJ = j
    }
    if (best >= 0) {
      groups[best]!.idx.push(i)
      groups[best]!.sources.add(a.source)
      groupOf.push(best)
      opts.onJoin?.(a, sorted[bestJ]!, bestSim)
    } else {
      groupOf.push(groups.length)
      groups.push({ idx: [i], sources: new Set([a.source]) })
    }
  }

  return groups.map((g) => {
    const members = g.idx.map((i) => sorted[i]!)
    // Đại diện: bài có ảnh đăng sớm nhất (báo đưa tin đầu tiên), không có ảnh thì bài sớm nhất
    const lead = members.find((m) => m.image) ?? members[0]!
    return [lead, ...members.filter((m) => m !== lead)]
  })
}

/** Nhóm bài từ nhiều mục thì thuộc mục có nhiều bài nhất; hoà thì theo bài đại diện */
export function sectionOf(group: Article[]): SectionId {
  const count = new Map<SectionId, number>()
  for (const a of group) count.set(a.section, (count.get(a.section) ?? 0) + 1)
  let best = group[0]!.section
  for (const [s, n] of count) if (n > count.get(best)!) best = s
  return best
}

// ── Xếp hạng ────────────────────────────────────────────────────────────────────────────────

export function scoreStory(group: Article[], tags: StoryTag[], now: number): number {
  const newest = Math.max(...group.map((a) => Date.parse(a.publishedAt)))
  const ageH = Math.max(0, (now - newest) / 3.6e6)
  const recency = 2 * Math.exp(-ageH / 10)
  const coverage = 1.2 * Math.log(new Set(group.map((a) => a.source)).size)
  const boost = (tags.includes('drama') ? 0.6 : 0) + (tags.includes('viral') ? 0.6 : 0) + (tags.includes('geo') ? 0.3 : 0)
  return recency + coverage + boost
}

export function buildSections(articles: Article[], now: number, limit: number): Record<SectionId, Story[]> {
  const scored = clusterArticles(articles).map((group) => {
    const lead = group[0]!
    const section = sectionOf(group)
    const tags = [...new Set(group.flatMap((a) => tagsFor(section, a.title, a.summary)))]
    const related: RelatedLink[] = group.slice(1).map((a) => ({ source: a.source, title: a.title, link: a.link }))
    const story: Story = {
      id: lead.id,
      title: lead.title,
      link: lead.link,
      source: lead.source,
      summary: lead.summary,
      image: lead.image,
      publishedAt: lead.publishedAt,
      related,
      tags,
    }
    return { section, story, score: scoreStory(group, tags, now) }
  })
  scored.sort((a, b) => b.score - a.score)

  const out = Object.fromEntries(SECTIONS.map((s) => [s.id, [] as Story[]])) as Record<SectionId, Story[]>
  for (const s of scored) if (out[s.section].length < limit) out[s.section].push(s.story)
  return out
}
