/**
 * Nhớ thói quen đọc trên máy này (localStorage): lần đọc trước là lúc nào để đánh dấu tin mới,
 * và tin nào đã bấm đọc để làm mờ. Chỉ là tiện ích — localStorage bị chặn thì mọi tin như chưa đọc.
 */
import { useCallback, useState } from 'react'

const VISIT_KEY = 'ban-tin-sang/visit'
const READ_KEY = 'ban-tin-sang/read'
/** Mở lại trang sau ngần này thời gian thì tính là một lần đọc mới */
const NEW_VISIT_AFTER_MS = 2 * 3_600_000
const MAX_READ_IDS = 2_000

interface Visit {
  current: number
  previous: number | null
}

/**
 * Đầu lần đọc trước. Tin đăng sau mốc này là "mới". Tải lại trang trong cùng lần đọc
 * (cách nhau dưới 2 giờ) giữ nguyên mốc, để dấu "mới" không biến mất khi lỡ tay tải lại.
 */
function startVisit(now: number): number | null {
  try {
    const raw = localStorage.getItem(VISIT_KEY)
    const saved = raw ? (JSON.parse(raw) as Visit) : null
    let visit: Visit
    if (!saved || typeof saved.current !== 'number') visit = { current: now, previous: null }
    else if (now - saved.current > NEW_VISIT_AFTER_MS) visit = { current: now, previous: saved.current }
    else visit = saved
    localStorage.setItem(VISIT_KEY, JSON.stringify(visit))
    return visit.previous
  } catch {
    return null
  }
}

function loadRead(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY)
    const ids = raw ? (JSON.parse(raw) as unknown) : []
    return new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function useReading() {
  const [previousVisit] = useState(() => startVisit(Date.now()))
  const [read, setRead] = useState(loadRead)

  const markRead = useCallback((id: string) => {
    setRead((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      try {
        // Set giữ thứ tự thêm vào: cắt bớt những id cũ nhất
        localStorage.setItem(READ_KEY, JSON.stringify([...next].slice(-MAX_READ_IDS)))
      } catch {
        /* chỉ không nhớ được */
      }
      return next
    })
  }, [])

  const isNew = useCallback(
    (publishedAt: string) => previousVisit !== null && Date.parse(publishedAt) > previousVisit,
    [previousVisit],
  )

  return { previousVisit, read, markRead, isNew }
}

export type Reading = ReturnType<typeof useReading>
