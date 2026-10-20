/** Khoá chrome.storage và thông điệp dùng chung giữa trang bản tin và service worker của extension */
export const EXT_STATE_KEY = 'state'
export const EXT_BRIEF_KEY = 'brief'
/** Lần mở trang bản tin gần nhất — tin đăng sau mốc này được đếm lên biểu tượng */
export const EXT_OPENED_KEY = 'openedAt'

export interface ExtRefreshMessage {
  type: 'refresh'
}
