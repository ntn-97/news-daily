/**
 * Cùng một giao diện chạy ở ba nơi, chỉ khác chỗ lấy bản tin (chọn lúc build theo `--mode`):
 * - server: web gọi server trên Mac (`npm run dev` / `npm start`)
 * - extension: extension Chrome — lượt làm mới chạy nền trong service worker, bản tin nằm ở chrome.storage
 * - static: trang tĩnh trên GitHub Pages — GitHub Actions đăng sẵn brief.json 30 phút / lần
 */
import type { Brief } from '@shared/types'
import { EXT_BRIEF_KEY, EXT_OPENED_KEY, type ExtRefreshMessage } from '@/extension/protocol'

export type Target = 'server' | 'extension' | 'static'

export const TARGET: Target =
  import.meta.env.MODE === 'extension' ? 'extension' : import.meta.env.MODE === 'static' ? 'static' : 'server'

export interface Source {
  /** null: chưa có bản tin nào (extension vừa cài) */
  load(): Promise<Brief | null>
  refresh(): Promise<Brief | null>
  refreshLabel: string
  /** Bản tin đổi do lượt làm mới nền (chỉ extension) */
  subscribe?(onChange: (brief: Brief) => void): () => void
  /** Gọi khi mở trang: extension dùng để xoá số tin mới trên biểu tượng */
  opened?(): void
  /** Lời nhắn khi không tải được bản tin */
  troubleshoot: string
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

const serverSource: Source = {
  load: () => getJson<Brief>('/api/brief'),
  refresh: () => getJson<Brief>('/api/refresh', { method: 'POST' }),
  refreshLabel: 'Làm mới',
  troubleshoot: 'Chạy npm run dev trong thư mục ban-tin-sang rồi tải lại trang.',
}

const staticSource: Source = {
  // Đường dẫn tương đối: trang nằm ở /<tên repo>/ trên GitHub Pages
  load: () => getJson<Brief>('brief.json', { cache: 'no-cache' }),
  refresh: () => getJson<Brief>('brief.json', { cache: 'reload' }),
  refreshLabel: 'Tải lại',
  troubleshoot: 'Bản tin do GitHub Actions đăng 30 phút / lần — xem tab Actions của repo xem lượt gần nhất có lỗi không.',
}

const extensionSource: Source = {
  async load() {
    const got = await chrome.storage.local.get(EXT_BRIEF_KEY)
    return (got[EXT_BRIEF_KEY] as Brief | undefined) ?? null
  },
  async refresh() {
    const msg: ExtRefreshMessage = { type: 'refresh' }
    return ((await chrome.runtime.sendMessage(msg)) as Brief | null) ?? null
  },
  refreshLabel: 'Làm mới',
  subscribe(onChange) {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      const next = changes[EXT_BRIEF_KEY]?.newValue as Brief | undefined
      if (area === 'local' && next) onChange(next)
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  },
  opened() {
    void chrome.storage.local.set({ [EXT_OPENED_KEY]: Date.now() })
    void chrome.action.setBadgeText({ text: '' })
  },
  troubleshoot: 'Thử tắt rồi bật lại extension trong chrome://extensions.',
}

export const source: Source =
  TARGET === 'extension' ? extensionSource : TARGET === 'static' ? staticSource : serverSource
