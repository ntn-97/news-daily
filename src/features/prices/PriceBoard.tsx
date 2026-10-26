import { Coins, DollarSign, Fuel } from 'lucide-react'
import type { ReactNode } from 'react'

import type { FuelBoard, FxBoard, GoldBoard, Quote } from '@shared/types'
import { Skeleton } from '@/components/ui/skeleton'
import {
  fmt1,
  fmt2,
  fmtInt,
  fmtMillion,
  fmtSigned,
  fmtSince,
  shortSourceDate,
  shortSourceTime,
} from '@/lib/format'
import { cn } from '@/lib/utils'

/** Tăng xanh, giảm đỏ, đứng giá xám. Chưa có mốc so sánh thì không hiện gì */
function Delta({ quote, format, className }: { quote: Quote; format: (n: number) => string; className?: string }) {
  if (quote.prev === null || quote.prevAt === null) return null
  const d = quote.value - quote.prev
  const shown = fmtSigned(d, format)
  const flat = !/[1-9]/.test(shown)
  return (
    <span
      className={cn(
        'tabular text-xs font-medium',
        flat ? 'text-muted-foreground' : d > 0 ? 'text-up' : 'text-down',
        className,
      )}
      title={`So với ${fmtSince(quote.prevAt)}`}
    >
      {flat ? '=' : d > 0 ? '▲' : '▼'} {flat ? 'không đổi' : shown.replace(/^[+−]/, '')}
    </span>
  )
}

export function PriceCard({
  icon,
  title,
  source,
  children,
  footer,
}: {
  icon: ReactNode
  title: string
  source: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="flex flex-col rounded-xl bg-card ring-1 ring-foreground/8">
      <header className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary [&_svg]:size-3.5">
            {icon}
          </span>
          {title}
        </h3>
        <span className="truncate text-xs text-muted-foreground">{source}</span>
      </header>
      <div className="flex-1 px-4 pb-3">{children}</div>
      {footer && <footer className="border-t px-4 py-2.5 text-xs text-muted-foreground">{footer}</footer>}
    </section>
  )
}

function GoldCard({ gold }: { gold: GoldBoard }) {
  const sjc = gold.rows.find((r) => r.key === 'gold-sjc')
  const world = gold.world
  const gap = sjc && world?.vndPerLuong ? sjc.sell.value - world.vndPerLuong : null
  const anyPrev = gold.rows.some((r) => r.sell.prev !== null)
  return (
    <PriceCard
      icon={<Coins />}
      title="Giá vàng"
      source={gold.sourceTime ? `PNJ · ${shortSourceTime(gold.sourceTime)} ${shortSourceDate(gold.sourceTime)}` : 'PNJ'}
      footer={
        world && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span>
              Thế giới <b className="tabular font-semibold text-foreground">${fmt1(world.usdPerOunce.value)}</b>/oz{' '}
              <Delta quote={world.usdPerOunce} format={fmt1} />
            </span>
            {world.vndPerLuong !== null && (
              <span className="tabular">
                ≈ {fmtMillion(world.vndPerLuong)} tr/lượng
                {gap !== null && <> · SJC cao hơn {fmtMillion(gap)} tr</>}
              </span>
            )}
          </div>
        )
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="pb-1 text-left font-normal">triệu đồng / lượng</th>
            <th className="pb-1 text-right font-normal">Mua</th>
            <th className="pb-1 text-right font-normal">Bán</th>
          </tr>
        </thead>
        <tbody>
          {gold.rows.map((r) => (
            <tr key={r.key} className="align-top">
              <td className="py-1 pr-2 font-medium">{r.label}</td>
              <td className="py-1 text-right">
                <div className="tabular text-base font-semibold">{fmtMillion(r.buy.value)}</div>
                <Delta quote={r.buy} format={(n) => fmtMillion(n)} />
              </td>
              <td className="py-1 pl-3 text-right">
                <div className="tabular text-base font-semibold">{fmtMillion(r.sell.value)}</div>
                <Delta quote={r.sell} format={(n) => fmtMillion(n)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!anyPrev && <p className="mt-1 text-xs text-muted-foreground">Mức tăng / giảm so với hôm qua hiện từ ngày mai.</p>}
    </PriceCard>
  )
}

/** "Xăng E10 RON 95 mức 3" → "E10 RON 95-III": cách gọi quen của cây xăng */
const ROMAN: Record<string, string> = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V' }
export function shortFuelName(label: string) {
  return label.replace(/^Xăng\s+/i, '').replace(/\s+mức\s+(\d)$/i, (_m, n: string) => `-${ROMAN[n] ?? n}`)
}

function FuelCard({ fuel }: { fuel: FuelBoard }) {
  return (
    <PriceCard
      icon={<Fuel />}
      title="Xăng dầu"
      source={fuel.sourceTime ? `Petrolimex · từ ${shortSourceTime(fuel.sourceTime)} ${shortSourceDate(fuel.sourceTime)}` : 'Petrolimex'}
      footer={
        fuel.crude.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <span>Dầu thô</span>
            {fuel.crude.map((c) => (
              <span key={c.name} className="tabular">
                {c.name} <b className="font-semibold text-foreground">${fmt2(c.usdPerBarrel)}</b>{' '}
                <span className={c.change > 0 ? 'text-up' : c.change < 0 ? 'text-down' : ''}>
                  {fmtSigned(c.change, fmt2)}
                </span>
              </span>
            ))}
          </div>
        )
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="pb-1 text-left font-normal">đồng / lít, vùng 1</th>
            <th className="pb-1 text-right font-normal">Giá</th>
          </tr>
        </thead>
        <tbody>
          {fuel.rows.map((r) => (
            <tr key={r.key} title={`Vùng 2: ${fmtInt(r.region2)}đ`}>
              <td className="py-[3px] pr-2 font-medium">{shortFuelName(r.label)}</td>
              <td className="py-[3px] text-right">
                <span className="tabular font-semibold">{fmtInt(r.price.value)}</span>
                <Delta quote={r.price} format={fmtInt} className="ml-1.5" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PriceCard>
  )
}

/** Yên, won tính theo đồng có phần lẻ; USD, EUR thì không */
const fmtRate = (n: number) => (n < 1_000 ? fmt2(n) : fmtInt(n))

function FxCard({ fx }: { fx: FxBoard }) {
  return (
    <PriceCard
      icon={<DollarSign />}
      title="Tỷ giá"
      source={fx.sourceTime ? `Vietcombank · ${shortSourceTime(fx.sourceTime)}` : 'Vietcombank'}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="pb-1 text-left font-normal">đồng</th>
            <th className="pb-1 text-right font-normal">Mua</th>
            <th className="pb-1 text-right font-normal">Bán</th>
          </tr>
        </thead>
        <tbody>
          {fx.rows.map((r) => (
            <tr key={r.code}>
              <td className="py-[3px] pr-2 font-medium">{r.code}</td>
              <td className="tabular py-[3px] text-right text-muted-foreground">
                {r.buy === null ? '—' : fmtRate(r.buy)}
              </td>
              <td className="py-[3px] pl-3 text-right">
                <span className="tabular font-semibold">{fmtRate(r.sell.value)}</span>
                <Delta quote={r.sell} format={fmtRate} className="block" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PriceCard>
  )
}

function Missing({ title }: { title: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-xl bg-card p-4 text-center text-sm text-muted-foreground ring-1 ring-foreground/8">
      Chưa lấy được {title}. Xem lỗi ở cuối trang.
    </div>
  )
}

export function PriceBoard({ gold, fuel, fx }: { gold: GoldBoard | null; fuel: FuelBoard | null; fx: FxBoard | null }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.15fr_1fr_0.85fr]">
      {gold ? <GoldCard gold={gold} /> : <Missing title="giá vàng" />}
      {fuel ? <FuelCard fuel={fuel} /> : <Missing title="giá xăng dầu" />}
      {fx ? <FxCard fx={fx} /> : <Missing title="tỷ giá" />}
    </div>
  )
}

export function PriceBoardSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-48 rounded-xl" />
      ))}
    </div>
  )
}
