import { ChevronDown, Newspaper } from 'lucide-react'
import { useState } from 'react'

import type { Story, StoryTag } from '@shared/types'
import type { Reading } from '@/hooks/useReading'
import { fmtAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

export const TAG_LABEL: Record<StoryTag, string> = { drama: 'Phốt', viral: 'MXH', geo: 'Địa chính trị' }

const TAG_CLASS: Record<StoryTag, string> = {
  drama: 'bg-tag-drama-bg text-tag-drama',
  viral: 'bg-tag-viral-bg text-tag-viral',
  geo: 'bg-tag-geo-bg text-tag-geo',
}

function TagBadge({ tag }: { tag: StoryTag }) {
  return (
    <span className={cn('rounded px-1.5 py-px text-[11px] leading-4 font-semibold', TAG_CLASS[tag])}>
      {TAG_LABEL[tag]}
    </span>
  )
}

/** Ảnh báo hay chặn khi có Referer lạ: không gửi Referer; ảnh hỏng thì ẩn hẳn khung */
function Thumb({ src, className }: { src: string; className?: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) return null
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={cn('bg-muted object-cover', className)}
    />
  )
}

function Meta({ story, isNew }: { story: Story; isNew: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {isNew && (
        <span className="flex items-center gap-1 font-semibold text-sun">
          <span className="size-1.5 rounded-full bg-sun" />
          Mới
        </span>
      )}
      <span className="font-medium text-foreground/80">{story.source}</span>
      <span>{fmtAgo(story.publishedAt)}</span>
      {story.tags.map((t) => (
        <TagBadge key={t} tag={t} />
      ))}
    </div>
  )
}

/** "4 báo cùng đưa tin" — bấm để xem các báo khác viết gì */
function Related({ story, reading }: { story: Story; reading: Reading }) {
  const [open, setOpen] = useState(false)
  if (story.related.length === 0) return null
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <Newspaper className="size-3.5" />
        {story.related.length + 1} báo cùng đưa tin
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 border-l-2 border-primary/30 pl-3">
          {story.related.map((r) => (
            <li key={r.link} className="text-sm leading-snug">
              <a
                href={r.link}
                target="_blank"
                rel="noreferrer"
                onClick={() => reading.markRead(story.id)}
                className="hover:underline"
              >
                <span className="text-xs font-medium text-muted-foreground">{r.source}: </span>
                {r.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface ItemProps {
  story: Story
  reading: Reading
}

function TitleLink({ story, reading, className }: ItemProps & { className?: string }) {
  const read = reading.read.has(story.id)
  return (
    <a
      href={story.link}
      target="_blank"
      rel="noreferrer"
      onClick={() => reading.markRead(story.id)}
      onAuxClick={() => reading.markRead(story.id)}
      className={cn(
        'font-serif tracking-[-0.005em] text-pretty decoration-primary/60 decoration-2 underline-offset-[3px] hover:underline',
        read && 'text-muted-foreground',
        className,
      )}
    >
      {story.title}
    </a>
  )
}

/** Tin đầu mục: ảnh lớn, tiêu đề lớn, có sapo */
export function LeadStory({ story, reading }: ItemProps) {
  return (
    <article className="flex flex-col gap-3">
      {story.image && (
        <a href={story.link} target="_blank" rel="noreferrer" onClick={() => reading.markRead(story.id)} tabIndex={-1}>
          <Thumb src={story.image} className="aspect-[16/9] w-full rounded-lg" />
        </a>
      )}
      <div className="flex flex-col gap-2">
        <Meta story={story} isNew={reading.isNew(story.publishedAt)} />
        <h3>
          <TitleLink story={story} reading={reading} className="text-[1.6rem] leading-[1.15] font-semibold sm:text-3xl" />
        </h3>
        {story.summary && <p className="line-clamp-3 leading-relaxed text-muted-foreground">{story.summary}</p>}
        <Related story={story} reading={reading} />
      </div>
    </article>
  )
}

/** Tin thường: tiêu đề + ảnh nhỏ bên phải */
export function StoryRow({ story, reading, showSummary }: ItemProps & { showSummary?: boolean }) {
  return (
    <article className="flex gap-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Meta story={story} isNew={reading.isNew(story.publishedAt)} />
        <h3>
          <TitleLink story={story} reading={reading} className="text-lg leading-snug font-medium" />
        </h3>
        {showSummary && story.summary && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{story.summary}</p>
        )}
        <Related story={story} reading={reading} />
      </div>
      {story.image && (
        <a
          href={story.link}
          target="_blank"
          rel="noreferrer"
          onClick={() => reading.markRead(story.id)}
          tabIndex={-1}
          className="shrink-0 pt-1"
        >
          <Thumb src={story.image} className="h-16 w-24 rounded-md sm:h-20 sm:w-28" />
        </a>
      )}
    </article>
  )
}
