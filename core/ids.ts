/**
 * Id của bài = băm của link đã chuẩn hoá. Không dùng node:crypto vì lõi phải chạy cả trong
 * extension Chrome; vài nghìn bài thì băm 53 bit (cyrb53) không lo trùng.
 */

/** Bỏ tham số theo dõi (utm_*, at_* của BBC) để cùng một bài không thành hai id */
export function canonicalLink(link: string): string {
  try {
    const u = new URL(link)
    // Gom khoá cần xoá trước: xoá trong lúc đang duyệt searchParams sẽ bỏ sót khoá liền sau
    const drop = [...u.searchParams.keys()].filter((k) => /^(utm_|at_)/.test(k))
    for (const k of drop) u.searchParams.delete(k)
    u.hash = ''
    return u.toString()
  } catch {
    return link
  }
}

function cyrb53(s: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

export const articleId = (link: string) => cyrb53(canonicalLink(link)).toString(16).padStart(14, '0')
