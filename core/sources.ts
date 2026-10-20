/**
 * Danh sách nguồn tin. Thêm / bỏ báo chỉ cần sửa ở đây.
 *
 * Facebook không cho đọc bảng tin khi chưa đăng nhập, nên "nóng trên mạng" lấy từ các chuyên mục báo
 * chuyên đưa lại chuyện đang lan trên mạng xã hội (Kenh14 Hot trend, Thanh Niên Giới trẻ...),
 * cộng thêm Google Trends để biết mọi người đang tìm gì.
 *
 * Mọi URL dưới đây đã thử tải được ngày 20/10/2026. Một bài (cùng link) nằm trong nhiều chuyên mục
 * thì thuộc chuyên mục của nguồn đứng trước trong danh sách (xem refresh.ts).
 */
import type { SectionId } from '../shared/types.ts'

export interface FeedSource {
  section: SectionId
  source: string
  url: string
  /** Chuyên mục lẫn nhiều tin thường: chỉ giữ bài có dấu hiệu đang lan trên mạng / có phốt */
  onlySocial?: boolean
}

export const FEEDS: FeedSource[] = [
  // Nóng trên mạng
  { section: 'hot', source: 'Kenh14', url: 'https://kenh14.vn/doi-song/hot-trend.rss' },
  { section: 'hot', source: 'Kenh14', url: 'https://kenh14.vn/xa-hoi.rss', onlySocial: true },
  { section: 'hot', source: 'Kenh14', url: 'https://kenh14.vn/doi-song/nhan-vat.rss' },
  { section: 'hot', source: 'Thanh Niên', url: 'https://thanhnien.vn/rss/gioi-tre.rss' },
  { section: 'hot', source: 'Dân trí', url: 'https://dantri.com.vn/rss/doi-song.rss', onlySocial: true },

  // Drama & phốt
  { section: 'drama', source: 'Kenh14', url: 'https://kenh14.vn/star.rss' },
  { section: 'drama', source: 'Kenh14', url: 'https://kenh14.vn/star/sao-viet.rss' },
  { section: 'drama', source: 'VnExpress', url: 'https://vnexpress.net/rss/giai-tri.rss' },
  { section: 'drama', source: 'Dân trí', url: 'https://dantri.com.vn/rss/giai-tri.rss' },
  { section: 'drama', source: 'Thanh Niên', url: 'https://thanhnien.vn/rss/giai-tri.rss' },
  { section: 'drama', source: 'Tuổi Trẻ', url: 'https://tuoitre.vn/rss/giai-tri.rss' },
  { section: 'drama', source: 'Znews', url: 'https://znews.vn/rss/giai-tri.rss' },

  // Thế giới & địa chính trị
  { section: 'world', source: 'VnExpress', url: 'https://vnexpress.net/rss/the-gioi.rss' },
  { section: 'world', source: 'Tuổi Trẻ', url: 'https://tuoitre.vn/rss/the-gioi.rss' },
  { section: 'world', source: 'Thanh Niên', url: 'https://thanhnien.vn/rss/the-gioi.rss' },
  { section: 'world', source: 'Dân trí', url: 'https://dantri.com.vn/rss/the-gioi.rss' },
  { section: 'world', source: 'Znews', url: 'https://znews.vn/rss/the-gioi.rss' },
  { section: 'world', source: 'BBC Tiếng Việt', url: 'https://feeds.bbci.co.uk/vietnamese/rss.xml' },
  { section: 'world', source: 'RFI Tiếng Việt', url: 'https://www.rfi.fr/vi/rss' },

  // Trong nước
  { section: 'vn', source: 'VnExpress', url: 'https://vnexpress.net/rss/tin-noi-bat.rss' },
  { section: 'vn', source: 'VnExpress', url: 'https://vnexpress.net/rss/thoi-su.rss' },
  { section: 'vn', source: 'Tuổi Trẻ', url: 'https://tuoitre.vn/rss/thoi-su.rss' },
  { section: 'vn', source: 'Thanh Niên', url: 'https://thanhnien.vn/rss/thoi-su.rss' },
  { section: 'vn', source: 'Dân trí', url: 'https://dantri.com.vn/rss/xa-hoi.rss' },
  { section: 'vn', source: 'Znews', url: 'https://znews.vn/rss/xa-hoi.rss' },
]

export const GOOGLE_TRENDS_URL = 'https://trends.google.com/trending/rss?geo=VN'
