import { MessageSquareQuote, Newspaper, TrendingDown, TrendingUp } from 'lucide-react'

import type { MarketBoard as Board, MarketIndex, MarketNote, MarketStock } from '@shared/types'
import { PriceCard } from '@/features/prices/PriceBoard'
import { fmt2, fmtAgo, fmtInt, fmtSigned } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Tăng xanh, giảm đỏ, đứng giá xám — như bảng giá vàng */
const tone = (n: number) => (n > 0 ? 'text-up' : n < 0 ? 'text-down' : 'text-muted-foreground')
const arrow = (n: number) => (n > 0 ? '▲' : n < 0 ? '▼' : '=')
const fmtPct = (n: number) => `${fmtSigned(n, fmt2)}%`
const fmtBillion = (vnd: number) => `${fmtInt(vnd / 1e9)} tỷ`
/** "2026-10-26" → "26/10" */
const fmtDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
/** Ngưỡng khớp lệnh lấy từ core/stocks.ts (MOVER_MIN_VALUE): mã ít giao dịch kịch trần chỉ vài lô không đáng xếp hạng */
const MOVERS_NOTE = 'Chỉ tính cổ phiếu khớp lệnh từ 10 tỷ đồng trở lên.'

/** Độ rộng thị trường: thanh ba khúc tăng / đứng / giảm theo số mã */
function Breadth({ index }: { index: MarketIndex }) {
  const { advances, noChange, declines } = index
  const total = advances + noChange + declines || 1
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="bg-up" style={{ width: `${(advances / total) * 100}%` }} />
      <div className="bg-muted-foreground/30" style={{ width: `${(noChange / total) * 100}%` }} />
      <div className="bg-down" style={{ width: `${(declines / total) * 100}%` }} />
    </div>
  )
}

function IndexTile({ index }: { index: MarketIndex }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-3.5 ring-1 ring-foreground/8">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{index.label}</span>
        <span className={cn('tabular text-xs font-semibold', tone(index.change))}>
          {arrow(index.change)} {fmtPct(index.pctChange)}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="tabular text-2xl font-semibold tracking-tight">{fmt2(index.close)}</span>
        <span className={cn('tabular text-sm font-medium', tone(index.change))}>{fmtSigned(index.change, fmt2)}</span>
      </div>
      <Breadth index={index} />
      {/* Ô hẹp trên điện thoại: giá trị khớp lệnh xuống dòng nguyên cụm thay vì bẻ giữa số */}
      <div className="tabular flex flex-wrap justify-between gap-x-2 text-xs whitespace-nowrap text-muted-foreground">
        <span title="Số mã tăng · đứng giá · giảm">
          <span className="text-up">▲ {index.advances}</span> · = {index.noChange} ·{' '}
          <span className="text-down">▼ {index.declines}</span>
        </span>
        <span title="Giá trị khớp lệnh">{fmtBillion(index.value)}</span>
      </div>
    </div>
  )
}

function MoverTable({ stocks }: { stocks: MarketStock[] }) {
  if (stocks.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Chưa có số liệu phiên này.</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th className="pb-1 text-left font-normal">nghìn đồng</th>
          <th className="pb-1 text-right font-normal">Giá</th>
          <th className="pb-1 text-right font-normal">±%</th>
          <th className="pb-1 text-right font-normal">Khớp lệnh</th>
        </tr>
      </thead>
      <tbody>
        {stocks.map((s) => (
          <tr key={s.code}>
            <td className="py-[3px] pr-2 font-semibold">
              {s.code}
              {(s.ceiling || s.floor) && (
                <span className="ml-1.5 rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground">
                  {s.ceiling ? 'trần' : 'sàn'}
                </span>
              )}
            </td>
            <td className="tabular py-[3px] text-right font-medium">{fmt2(s.close)}</td>
            <td className="py-[3px] pl-2 text-right">
              <span
                className={cn(
                  'tabular rounded-md px-1.5 py-0.5 text-xs font-semibold',
                  s.pctChange > 0 ? 'bg-up/10 text-up' : s.pctChange < 0 ? 'bg-down/10 text-down' : 'text-muted-foreground',
                )}
              >
                {fmtPct(s.pctChange)}
              </span>
            </td>
            <td className="tabular py-[3px] pl-2 text-right text-muted-foreground">{fmtBillion(s.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function NoteLink({ note }: { note: MarketNote }) {
  return (
    <>
      <a href={note.link} target="_blank" rel="noreferrer" className="leading-snug font-medium text-pretty hover:underline">
        {note.title}
      </a>
      <span className="text-xs text-muted-foreground">
        {note.source} · {fmtAgo(note.publishedAt)}
      </span>
    </>
  )
}

function TickerChip({ code, quote }: { code: string; quote: MarketStock | undefined }) {
  return (
    <span className="tabular inline-flex items-baseline gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
      {code}
      {quote && <span className={tone(quote.pctChange)}>{fmtPct(quote.pctChange)}</span>}
    </span>
  )
}

/** Chứng khoán trong nước: chỉ số, mã tăng / giảm mạnh, nhận định, mã được chuyên gia nhắc tới */
export function MarketBoard({ market }: { market: Board }) {
  const moversLabel = `HOSE · phiên ${fmtDay(market.moversSession)}`
  return (
    <section id="chung-khoan" aria-labelledby="chung-khoan-title" className="scroll-mt-20">
      <header className="mb-3 border-t-[3px] border-primary pt-3">
        <h2 id="chung-khoan-title" className="font-serif text-[1.75rem] leading-tight font-bold sm:text-3xl">
          Chứng khoán
        </h2>
        <p className="text-sm text-muted-foreground">
          Phiên {fmtDay(market.session)}
          {market.time && ` · số liệu lúc ${market.time.slice(0, 5)}`} · VNDirect, Vietstock
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {market.indices.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {market.indices.map((i) => (
              <IndexTile key={i.code} index={i} />
            ))}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <PriceCard icon={<TrendingUp />} title="Tăng mạnh" source={moversLabel} footer={MOVERS_NOTE}>
            <MoverTable stocks={market.gainers} />
          </PriceCard>
          <PriceCard icon={<TrendingDown />} title="Giảm mạnh" source={moversLabel} footer={MOVERS_NOTE}>
            <MoverTable stocks={market.losers} />
          </PriceCard>
          <PriceCard icon={<Newspaper />} title="Nhận định" source="Vietstock">
            {market.outlook.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Chưa có bài nhận định mới.</p>
            ) : (
              <ul className="divide-y">
                {market.outlook.map((n) => (
                  <li key={n.link} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                    <NoteLink note={n} />
                  </li>
                ))}
              </ul>
            )}
          </PriceCard>
        </div>

        {market.picks.length > 0 && (
          <PriceCard
            icon={<MessageSquareQuote />}
            title="Chuyên gia nhắc tới"
            source="7 ngày qua"
            footer="Tóm tắt từ bài phân tích của các công ty chứng khoán đăng trên Vietstock; % là biến động phiên gần nhất. Thông tin để tham khảo, không phải lời khuyên đầu tư."
          >
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {market.picks.map((n) => (
                <li key={n.link} className="flex flex-col gap-1">
                  <div className="flex flex-wrap gap-1.5">
                    {n.tickers.map((t) => (
                      <TickerChip key={t} code={t} quote={market.quotes[t]} />
                    ))}
                  </div>
                  <NoteLink note={n} />
                </li>
              ))}
            </ul>
          </PriceCard>
        )}
      </div>
    </section>
  )
}
