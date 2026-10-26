import { Search } from 'lucide-react'

import type { Trend } from '@shared/types'
import { cn } from '@/lib/utils'

/** Google Trends: từ khoá người Việt đang tìm nhiều, mỗi từ kèm một bài báo giải thích vì sao */
export function TrendsPanel({ trends }: { trends: Trend[] }) {
  if (trends.length === 0) return null
  return (
    <section aria-labelledby="trends-title">
      <h2
        id="trends-title"
        className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase"
      >
        <Search className="size-3.5 text-primary" />
        Mọi người đang tìm trên Google
      </h2>
      <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {trends.slice(0, 12).map((t, i) => {
          const top = t.news[0]
          const href = top?.link ?? `https://www.google.com/search?q=${encodeURIComponent(t.keyword)}`
          return (
            // Trên điện thoại chỉ hiện 6 từ đầu cho đỡ dài, còn lại để dành chỗ cho tin
            <li key={t.keyword} className={cn('min-w-0', i >= 6 && 'max-sm:hidden')}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-baseline gap-2.5 rounded-md py-1.5 hover:bg-primary/8 sm:px-1.5"
              >
                {/* Ba từ được tìm nhiều nhất in số xanh đậm cho nổi */}
                <span
                  className={cn(
                    'tabular w-4 shrink-0 text-right text-xs',
                    i < 3 ? 'font-bold text-primary' : 'text-muted-foreground',
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="font-semibold group-hover:underline">{t.keyword}</span>
                  {t.traffic && <span className="ml-1.5 text-xs text-muted-foreground">{t.traffic} lượt</span>}
                  {top && <span className="block truncate text-xs text-muted-foreground">{top.title}</span>}
                </span>
              </a>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
