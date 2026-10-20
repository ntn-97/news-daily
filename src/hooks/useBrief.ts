import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { Brief } from '@shared/types'
import { source, TARGET } from '@/lib/source'

/** Bản tin cũ hơn ngần này thì extension tự làm mới khi mở trang (máy vừa ngủ dậy, Chrome vừa mở) */
const STALE_MS = 20 * 60_000

function pollInterval(data: Brief | null | undefined): number | false {
  if (TARGET === 'extension') return false // extension nhận bản tin mới qua chrome.storage.onChanged
  if (TARGET === 'server' && data && data.refreshedAt === null) return 2_000 // server vừa khởi động
  return TARGET === 'static' ? 10 * 60_000 : 5 * 60_000
}

export function useBrief() {
  const qc = useQueryClient()
  useEffect(() => source.subscribe?.((b) => qc.setQueryData(['brief'], b)), [qc])
  useEffect(() => source.opened?.(), [])
  return useQuery({
    queryKey: ['brief'],
    queryFn: source.load,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => pollInterval(q.state.data),
  })
}

export function useRefresh() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: source.refresh,
    onSuccess: (brief) => {
      if (brief) qc.setQueryData(['brief'], brief)
    },
  })
}

/** Extension: mở trang mà bản tin đã cũ (hoặc chưa có) thì tự làm mới một lượt */
export function useAutoRefresh(brief: Brief | null | undefined, refresh: () => void) {
  const loaded = brief !== undefined
  const stale = !brief?.refreshedAt || Date.now() - Date.parse(brief.refreshedAt) > STALE_MS
  useEffect(() => {
    if (TARGET === 'extension' && loaded && stale) refresh()
    // Chỉ xét một lần khi bản tin vừa tải xong
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])
}
