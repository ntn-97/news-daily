import { Loader2, RefreshCw, ServerCrash, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { Brief } from '@shared/types'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionBlock } from '@/features/news/SectionBlock'
import { PriceBoard, PriceBoardSkeleton } from '@/features/prices/PriceBoard'
import { TrendsPanel } from '@/features/trends/TrendsPanel'
import { useAutoRefresh, useBrief, useRefresh } from '@/hooks/useBrief'
import { useReading, type Reading } from '@/hooks/useReading'
import { fmtAgo, fmtLongDate, fmtMoment, greeting } from '@/lib/format'
import { source } from '@/lib/source'
import { cn } from '@/lib/utils'

/** Đồng hồ phút: để "5 phút trước" và lời chào tự cập nhật khi để trang mở */
function useMinuteClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}

/** Mặt trời mọc, cùng hình với icon ứng dụng (public/icons/icon.svg). Vẽ nửa hình tròn thay vì che bằng ô màu nền
 *  để đặt được trên dải nền chuyển màu ở đầu trang */
function SunMark({ className }: { className?: string }) {
  return (
    <svg viewBox="4 4 56 56" aria-hidden className={className}>
      <g stroke="currentColor" strokeWidth="4.5" strokeLinecap="round">
        <line x1="32" y1="22" x2="32" y2="15" />
        <line x1="44.21" y1="26.45" x2="48.71" y2="21.08" />
        <line x1="19.79" y1="26.45" x2="15.29" y2="21.08" />
        <line x1="50.58" y1="37.05" x2="57.43" y2="35.59" />
        <line x1="13.42" y1="37.05" x2="6.57" y2="35.59" />
      </g>
      <path d="M18 41 a14 14 0 0 1 28 0 z" fill="currentColor" />
      <rect x="11" y="45" width="42" height="4.5" rx="2.25" fill="currentColor" />
    </svg>
  )
}

function Masthead({
  brief,
  now,
  reading,
  refresh,
}: {
  brief: Brief | null | undefined
  now: Date
  reading: Reading
  refresh: ReturnType<typeof useRefresh>
}) {
  const busy = refresh.isPending || brief?.refreshing
  const newCount = brief?.sections.reduce((n, s) => n + s.stories.filter((x) => reading.isNew(x.publishedAt)).length, 0)
  return (
    <header className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <SunMark className="size-10 shrink-0 text-primary sm:size-12" />
          <div>
            <h1 className="font-serif text-3xl leading-none font-bold tracking-tight sm:text-[2.6rem]">Bản Tin Sáng</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {fmtLongDate(now)} · {greeting(now)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refresh.mutate()}
            disabled={busy}
            title="Tải lại tin và giá từ các nguồn"
          >
            <RefreshCw className={cn(busy && 'animate-spin')} />
            <span className="hidden sm:inline">{busy ? 'Đang cập nhật…' : source.refreshLabel}</span>
          </Button>
          <ThemeToggle />
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        {brief?.refreshedAt ? <>Cập nhật {fmtAgo(brief.refreshedAt, now)}</> : 'Đang lấy tin lần đầu…'}
        {reading.previousVisit !== null && newCount !== undefined && (
          <>
            {' · '}
            <span className="font-medium text-foreground">{newCount} tin mới</span> từ lần đọc trước (
            {fmtMoment(reading.previousVisit, now)})
          </>
        )}
        {refresh.isError && <span className="text-destructive"> · Làm mới lỗi: {refresh.error.message}</span>}
      </p>
    </header>
  )
}

function SectionNav({ brief, reading }: { brief: Brief; reading: Reading }) {
  const links = [
    { id: 'gia-ca', label: 'Giá cả', count: 0 },
    ...brief.sections.map((s) => ({
      id: s.id,
      label: s.title,
      count: s.stories.filter((x) => reading.isNew(x.publishedAt)).length,
    })),
  ]
  return (
    <nav className="sticky top-0 z-10 border-y bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex max-w-6xl scrollbar-none gap-1 overflow-x-auto px-3 py-1.5 sm:px-5">
        {links.map((l) => (
          <a
            key={l.id}
            href={`#${l.id}`}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-primary/10 hover:text-primary"
          >
            {l.label}
            {l.count > 0 && (
              <span className="tabular rounded-full bg-sun-soft px-1.5 text-[11px] leading-4 font-semibold text-sun">
                {l.count}
              </span>
            )}
          </a>
        ))}
      </div>
    </nav>
  )
}

function Footer({ brief }: { brief: Brief }) {
  return (
    <footer className="mt-4 space-y-3 border-t pt-6 text-sm text-muted-foreground">
      {brief.errors.length > 0 && (
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <TriangleAlert className="size-4 text-sun" />
            {brief.errors.length} nguồn không tải được lần làm mới gần nhất (tin cũ của nguồn đó vẫn giữ)
          </p>
          <ul className="mt-1.5 space-y-0.5 text-xs">
            {brief.errors.map((e) => (
              <li key={e.source}>
                {e.source}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p>
        Tổng hợp từ RSS của VnExpress, Tuổi Trẻ, Thanh Niên, Dân trí, Znews, Kenh14, BBC Tiếng Việt, RFI Tiếng Việt;
        xu hướng tìm kiếm từ Google Trends. Giá vàng PNJ, vàng thế giới gold-api.com, tỷ giá Vietcombank, giá xăng dầu
        Petrolimex (qua webgia.com). Bấm vào tin để đọc bài gốc trên báo.
      </p>
      <p>
        Facebook không cho đọc bảng tin khi chưa đăng nhập, nên “Nóng trên mạng” lấy từ các chuyên mục báo chuyên đưa
        lại chuyện đang lan trên mạng xã hội. Tin cùng một việc từ nhiều báo được gộp làm một; càng nhiều báo đưa, tin
        càng được xếp cao.
      </p>
    </footer>
  )
}

function Body({ brief, reading }: { brief: Brief; reading: Reading }) {
  const empty = brief.sections.every((s) => s.stories.length === 0)
  return (
    <>
      <SectionNav brief={brief} reading={reading} />
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-5 pb-16 sm:px-6">
        <div id="gia-ca" className="flex scroll-mt-20 flex-col gap-6">
          <PriceBoard gold={brief.gold} fuel={brief.fuel} fx={brief.fx} />
          <TrendsPanel trends={brief.trends} />
        </div>
        {empty && brief.refreshedAt === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> Đang tải tin từ các báo, chừng mười giây…
          </div>
        ) : (
          brief.sections.map((s) => <SectionBlock key={s.id} section={s} reading={reading} />)
        )}
        <Footer brief={brief} />
      </main>
    </>
  )
}

export default function App() {
  const now = useMinuteClock()
  const reading = useReading()
  const brief = useBrief()
  const refresh = useRefresh()
  useAutoRefresh(brief.data, refresh.mutate)

  return (
    <div className="min-h-svh">
      {/* Dải xanh nhạt mờ dần sau tiêu đề: mở trang là thấy ngay sắc xanh buổi sớm */}
      <div className="bg-linear-to-b from-primary/12 to-transparent pb-4">
        <Masthead brief={brief.data} now={now} reading={reading} refresh={refresh} />
      </div>
      {brief.isError ? (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-2 px-4 py-20 text-center">
          <ServerCrash className="size-8 text-muted-foreground" />
          <p className="font-medium">Không tải được bản tin</p>
          <p className="text-sm text-muted-foreground">
            {source.troubleshoot} ({brief.error.message})
          </p>
        </div>
      ) : brief.data ? (
        <Body brief={brief.data} reading={reading} />
      ) : brief.data === null ? (
        // Extension vừa cài: chưa có bản tin nào, lượt làm mới đầu tiên đang chạy
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Đang tải tin từ các báo lần đầu, chừng mười giây…
        </div>
      ) : (
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-5 sm:px-6">
          <PriceBoardSkeleton />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      )}
    </div>
  )
}
