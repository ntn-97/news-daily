/**
 * Đọc RSS 2.0 / Atom thành danh sách bài. Mỗi báo viết RSS một kiểu (CDATA hay không, ảnh nằm trong
 * description, enclosure hay media:thumbnail, múi giờ "+07" hay "+0700"), nên phần chuẩn hoá nằm hết ở đây
 * và có test trên file RSS thật trong __fixtures__.
 */
import { XMLParser } from 'fast-xml-parser'

export interface FeedItem {
  title: string
  link: string
  summary: string
  image: string | null
  /** ISO; null khi báo không ghi giờ hoặc ghi sai khuôn */
  publishedAt: string | null
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Giữ nguyên chữ: tiêu đề "2026" không được biến thành số
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ['item', 'entry', 'link', 'media:content', 'media:thumbnail', 'enclosure'].includes(name),
})

/**
 * Thanh Niên viết tiêu đề bằng thực thể HTML ("&agrave;", "&ocirc;"). Thay vì chép cả bảng HTML4,
 * sinh tên thực thể cho các chữ Latin-1 có dấu từ chính Unicode: "à" = "a" + dấu huyền → "agrave".
 */
const ACCENT_NAMES: Record<string, string> = {
  '̀': 'grave',
  '́': 'acute',
  '̂': 'circ',
  '̃': 'tilde',
  '̈': 'uml',
  '̊': 'ring',
  '̧': 'cedil',
}
const LATIN1_ACCENTED: Record<string, string> = {}
for (let cp = 0xc0; cp <= 0xff; cp++) {
  const ch = String.fromCodePoint(cp)
  const [base, mark, extra] = [...ch.normalize('NFD')]
  if (base && mark && !extra && ACCENT_NAMES[mark]) LATIN1_ACCENTED[`${base}${ACCENT_NAMES[mark]}`] = ch
}

const NAMED: Record<string, string> = {
  ...LATIN1_ACCENTED,
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  middot: '·',
  deg: '°',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  times: '×',
}

/** Giải mã thực thể HTML còn sót trong CDATA (parser XML không đụng vào bên trong CDATA) */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m
    }
    // Phân biệt hoa thường: "&Ocirc;" là "Ô", "&ocirc;" là "ô"
    return NAMED[code] ?? NAMED[code.toLowerCase()] ?? m
  })
}

export function stripHtml(html: string): string {
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/br>|<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
  return decodeEntities(text).replace(/\s+/g, ' ').trim()
}

/**
 * Giờ đăng bài → ISO. Date.parse của V8 đọc được "+0700" và "GMT" nhưng không đọc được "+07" (Kenh14)
 * hay "GMT+7", nên chuẩn hoá phần múi giờ trước.
 */
export function parseFeedDate(raw: string | undefined | null): string | null {
  if (!raw) return null
  const s = raw
    .trim()
    .replace(/(?:GMT|UTC)?\s*([+-])(\d{1,2})(?::?(\d{2}))?$/i, (_m, sign: string, h: string, mm?: string) => {
      return ` ${sign}${h.padStart(2, '0')}${mm ?? '00'}`
    })
  const t = Date.parse(s)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

/** Giá trị phần tử có thể là chuỗi, hoặc object { '#text', '@_attr' } khi phần tử có thuộc tính */
function text(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return text(v[0])
  if (typeof v === 'object' && '#text' in v) return text((v as { '#text': unknown })['#text'])
  return ''
}

function attr(v: unknown, name: string): string {
  const first = Array.isArray(v) ? v[0] : v
  if (first && typeof first === 'object' && `@_${name}` in first) {
    return text((first as Record<string, unknown>)[`@_${name}`])
  }
  return ''
}

const IMG_SRC = /<img[^>]+?(?:data-src|src)\s*=\s*["']([^"']+)["']/i

function absolutize(url: string): string | null {
  const u = decodeEntities(url.trim())
  if (u.startsWith('//')) return `https:${u}`
  return /^https?:\/\//i.test(u) ? u : null
}

function pickImage(item: Record<string, unknown>, descriptionHtml: string): string | null {
  const candidates = [
    attr(item['enclosure'], 'url'),
    attr(item['media:content'], 'url'),
    attr(item['media:thumbnail'], 'url'),
    IMG_SRC.exec(descriptionHtml)?.[1] ?? '',
  ]
  for (const c of candidates) {
    const u = c && absolutize(c)
    if (u) return u
  }
  return null
}

function atomLink(v: unknown): string {
  const links = Array.isArray(v) ? v : [v]
  const alt = links.find((l) => attr(l, 'rel') === '' || attr(l, 'rel') === 'alternate')
  return attr(alt ?? links[0], 'href') || text(links[0])
}

/** Ném lỗi nếu nội dung không phải RSS/Atom — trang lỗi HTML không được lặng lẽ thành "0 bài" */
export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml) as Record<string, any>
  const rssItems: unknown[] | undefined = doc.rss?.channel?.item ?? doc['rdf:RDF']?.item
  const atomEntries: unknown[] | undefined = doc.feed?.entry
  if (!rssItems && !atomEntries) {
    if (doc.rss?.channel || doc.feed) return []
    throw new Error('Không phải RSS/Atom')
  }

  const out: FeedItem[] = []
  for (const raw of (rssItems ?? atomEntries)!) {
    const item = raw as Record<string, unknown>
    const isAtom = !rssItems
    const descHtml = text(item['description']) || text(item['content:encoded']) || text(item['summary']) || text(item['content'])
    const title = stripHtml(text(item['title']))
    const link = absolutize(isAtom ? atomLink(item['link']) : text(item['link']) || text(item['guid']))
    if (!title || !link) continue
    out.push({
      title,
      link,
      // Dân trí mở đầu mọi sapo bằng "(Dân trí) - ": bỏ đi cho gọn
      summary: truncate(stripHtml(descHtml).replace(/^\([^)]{2,30}\)\s*[-–—]\s*/, ''), 320),
      image: pickImage(item, descHtml),
      publishedAt: parseFeedDate(
        text(item['pubDate']) || text(item['dc:date']) || text(item['published']) || text(item['updated']),
      ),
    })
  }
  return out
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`
}
