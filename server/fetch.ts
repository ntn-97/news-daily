/**
 * Hàm tải cho Node (server trên Mac và GitHub Actions). Trong extension, trình duyệt tự gửi
 * User-Agent của Chrome thật nên không cần hàm này.
 */
import type { FetchText } from '../core/refresh.ts'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

export const nodeFetchText: FetchText = async (url) => {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: '*/*', 'Accept-Language': 'vi,en;q=0.8' },
    signal: AbortSignal.timeout(15_000),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.text()
}
