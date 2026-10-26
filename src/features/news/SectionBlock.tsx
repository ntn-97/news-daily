import { useState } from 'react'

import type { Section, SectionId, Story, StoryTag } from '@shared/types'
import { Button } from '@/components/ui/button'
import type { Reading } from '@/hooks/useReading'
import { cn } from '@/lib/utils'

import { LeadStory, StoryRow } from './StoryItem'

/** Mỗi mục có một bộ lọc theo nhãn đặc trưng của nó */
const FILTER_TAG: Partial<Record<SectionId, StoryTag>> = { hot: 'viral', drama: 'drama', world: 'geo' }
const FILTER_LABEL: Record<StoryTag, string> = {
  viral: 'Chỉ chuyện đang lan trên MXH',
  drama: 'Chỉ chuyện có phốt',
  geo: 'Chỉ tin địa chính trị',
}
const PAGE = 10

/** Tin đầu mục nên có ảnh: lấy tin có ảnh đầu tiên trong 3 tin điểm cao nhất, còn lại giữ thứ tự */
function pickLead(stories: Story[]): [Story | undefined, Story[]] {
  const i = stories.slice(0, 3).findIndex((s) => s.image)
  const at = i < 0 ? 0 : i
  return [stories[at], stories.filter((_, j) => j !== at)]
}

export function SectionBlock({ section, reading }: { section: Section; reading: Reading }) {
  const tag = FILTER_TAG[section.id]
  const [onlyTag, setOnlyTag] = useState(false)
  const [shown, setShown] = useState(PAGE)

  const stories = onlyTag && tag ? section.stories.filter((s) => s.tags.includes(tag)) : section.stories
  const tagCount = tag ? section.stories.filter((s) => s.tags.includes(tag)).length : 0
  const [lead, rest] = pickLead(stories.slice(0, shown))
  const side = rest.slice(0, 3)
  const more = rest.slice(3)

  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-20">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t-[3px] border-primary pt-3">
        <div>
          <h2 id={`${section.id}-title`} className="font-serif text-[1.75rem] leading-tight font-bold sm:text-3xl">
            {section.title}
          </h2>
          <p className="text-sm text-muted-foreground">{section.blurb}</p>
        </div>
        {tag && tagCount > 0 && (
          <button
            type="button"
            aria-pressed={onlyTag}
            onClick={() => {
              setOnlyTag((v) => !v)
              setShown(PAGE)
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              onlyTag
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:border-primary/40 hover:bg-primary/10 hover:text-primary',
            )}
          >
            {FILTER_LABEL[tag]} · {tagCount}
          </button>
        )}
      </header>

      {!lead ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Chưa có tin nào trong 30 giờ qua.</p>
      ) : (
        <>
          <div className="grid gap-x-8 gap-y-2 pt-2 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <LeadStory story={lead} reading={reading} />
            </div>
            {side.length > 0 && (
              <div className="divide-y lg:col-span-5 lg:-mt-3">
                {side.map((s) => (
                  <StoryRow key={s.id} story={s} reading={reading} showSummary />
                ))}
              </div>
            )}
          </div>
          {more.length > 0 && (
            <div className="mt-2 grid gap-x-8 border-t sm:grid-cols-2">
              {more.map((s) => (
                <div key={s.id} className="border-b">
                  <StoryRow story={s} reading={reading} />
                </div>
              ))}
            </div>
          )}
          {stories.length > PAGE && (
            <div className="mt-3 flex justify-center">
              {shown < stories.length ? (
                <Button
                  variant="outline"
                  onClick={() => setShown((n) => n + PAGE)}
                  className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  Xem thêm {Math.min(PAGE, stories.length - shown)} tin
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShown(PAGE)
                    document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  Thu gọn
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
