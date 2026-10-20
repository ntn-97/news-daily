/** Định dạng số, tiền và giờ kiểu Việt Nam: 142,6 tr · 28.250đ · 7 phút trước */

const int = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const dec1 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const dec2 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtInt = (n: number) => int.format(n)
export const fmt1 = (n: number) => dec1.format(n)
export const fmt2 = (n: number) => dec2.format(n)

/** Giá vàng đọc theo triệu đồng / lượng như bảng giá ngoài tiệm: 142,6 */
export const fmtMillion = (vnd: number) => dec1.format(vnd / 1e6)

/** Chênh lệch có dấu, theo giá trị đã làm tròn để −0,04 không hiện thành "−0,0" */
export function fmtSigned(n: number, f: (n: number) => string) {
  const s = f(Math.abs(n))
  if (s.replace(/[^1-9]/g, '') === '') return s
  return `${n > 0 ? '+' : '−'}${s}`
}

const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

/** "Thứ Ba, 20 tháng 10, 2026" */
export function fmtLongDate(d: Date) {
  return `${WEEKDAY[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`
}

export function greeting(d: Date) {
  const h = d.getHours()
  if (h < 4) return 'Khuya rồi'
  if (h < 11) return 'Chào buổi sáng'
  if (h < 14) return 'Chào buổi trưa'
  if (h < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

const pad = (n: number) => String(n).padStart(2, '0')
export const fmtClock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** "vừa xong" · "12 phút trước" · "3 giờ trước" · "hôm qua 21:30" · "18/10 08:15" */
export function fmtAgo(iso: string, now = new Date()) {
  const d = new Date(iso)
  const s = Math.round((now.getTime() - d.getTime()) / 1000)
  if (s < 60) return 'vừa xong'
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`
  if (s < 6 * 3600 || sameDay(d, now)) return `${Math.floor(s / 3600)} giờ trước`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, yesterday)) return `hôm qua ${fmtClock(d)}`
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${fmtClock(d)}`
}

/** Một thời điểm gần đây: "07:02 hôm nay" · "07:02 hôm qua" · "07:02 18/10" */
export function fmtMoment(ms: number, now = new Date()) {
  const d = new Date(ms)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const day = sameDay(d, now) ? 'hôm nay' : sameDay(d, yesterday) ? 'hôm qua' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
  return `${fmtClock(d)} ${day}`
}

/** Nhãn mốc so sánh giá: "hôm qua" nếu mốc cách 20–30 giờ, xa hơn thì ghi ngày */
export function fmtSince(prevAt: string, now = new Date()) {
  const h = (now.getTime() - Date.parse(prevAt)) / 3.6e6
  if (h <= 30) return 'hôm qua'
  const d = new Date(prevAt)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}

/** "14:00:24 15/10/2026" hoặc "20/10/2026 10:06:14" (chữ của nguồn) → "15/10" */
export function shortSourceDate(raw: string) {
  const m = /(\d{1,2})\/(\d{1,2})\/\d{4}/.exec(raw)
  return m ? `${pad(Number(m[1]))}/${pad(Number(m[2]))}` : raw
}

/** Giờ trong chữ của nguồn: "20/10/2026 10:06:14" → "10:06" */
export function shortSourceTime(raw: string) {
  const m = /(\d{1,2}):(\d{2})/.exec(raw)
  return m ? `${pad(Number(m[1]))}:${m[2]}` : ''
}
