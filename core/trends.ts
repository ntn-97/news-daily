/**
 * Google Trends "Daily Search Trends" cho Việt Nam: từ khoá đang được tìm nhiều, kèm vài bài báo liên quan.
 * Đây là thứ gần nhất với "mọi người đang bàn gì" mà lấy được không cần đăng nhập.
 */
import { XMLParser } from 'fast-xml-parser'

import type { Trend } from '../shared/types.ts'
import { decodeEntities } from './rss.ts'

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  isArray: (name) => name === 'item' || name === 'ht:news_item',
})

interface RawNews {
  'ht:news_item_title'?: string
  'ht:news_item_url'?: string
  'ht:news_item_source'?: string
}

export function parseGoogleTrends(xml: string): Trend[] {
  const doc = parser.parse(xml) as {
    rss?: { channel?: { item?: { title?: string; 'ht:approx_traffic'?: string; 'ht:news_item'?: RawNews[] }[] } }
  }
  const items = doc.rss?.channel?.item
  if (!doc.rss?.channel) throw new Error('Google Trends: không phải RSS')
  return (items ?? [])
    .map((it) => ({
      keyword: decodeEntities(String(it.title ?? '')).trim(),
      traffic: String(it['ht:approx_traffic'] ?? '').trim(),
      news: (it['ht:news_item'] ?? [])
        .map((n) => ({
          title: decodeEntities(String(n['ht:news_item_title'] ?? '')).trim(),
          link: String(n['ht:news_item_url'] ?? '').trim(),
          source: String(n['ht:news_item_source'] ?? '').trim(),
        }))
        .filter((n) => n.title && /^https?:\/\//.test(n.link)),
    }))
    .filter((t) => t.keyword)
}
