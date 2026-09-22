"use client"

import { cn } from "cn"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import {
  addMonthsISO,
  formatMonthYear,
  monthGridISO,
  todayISO,
  type ISODate,
} from "@/lib/dates"

import type { Locale } from "@/i18n/routing"

export type CalendarEvent = {
  id: string
  date: ISODate
  title: string
  /** لون نقطة التصنيف */
  color?: string | null
  /** منجز/منتهٍ — يُعرض باهتاً مع خط */
  muted?: boolean
  onClick?: () => void
}

/**
 * شبكة شهرية تبدأ بالأحد (بداية الأسبوع في السعودية).
 * تتجه تلقائياً حسب اتجاه الصفحة لأن ترتيب عناصر الشبكة يتبع الاتجاه.
 */
export function MonthCalendar({
  month,
  events,
  onMonthChange,
  onDayClick,
  maxPerDay = 3,
}: {
  /** "YYYY-MM" */
  month: string
  events: CalendarEvent[]
  onMonthChange: (month: string) => void
  onDayClick?: (date: ISODate) => void
  maxPerDay?: number
}) {
  const t = useTranslations("common")
  const locale = useLocale() as Locale
  const today = todayISO()
  const anchor = `${month}-01`

  const days = useMemo(() => monthGridISO(anchor), [anchor])

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const list = map.get(event.date)
      if (list) list.push(event)
      else map.set(event.date, [event])
    }
    return map
  }, [events])

  const weekdays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(
      locale === "ar" ? "ar-SA" : "en-GB",
      { weekday: "short", timeZone: "UTC" }
    )
    // 2024-01-07 كان يوم أحد
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(Date.UTC(2024, 0, 7 + index)))
    )
  }, [locale])

  return (
    <div data-testid="month-calendar" className="rounded-xl border">
      <header className="flex items-center justify-between gap-2 border-b p-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("previous")}
          onClick={() => onMonthChange(addMonthsISO(anchor, -1).slice(0, 7))}
        >
          {/* الأيقونة تتبع اتجاه الصفحة */}
          <ChevronRightIcon className="size-4 rtl:hidden" />
          <ChevronLeftIcon className="hidden size-4 rtl:block" />
          <span className="sr-only">{t("previous")}</span>
        </Button>

        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">
            {formatMonthYear(anchor, locale)}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(today.slice(0, 7))}
          >
            {t("today")}
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("next")}
          onClick={() => onMonthChange(addMonthsISO(anchor, 1).slice(0, 7))}
        >
          <ChevronLeftIcon className="size-4 rtl:hidden" />
          <ChevronRightIcon className="hidden size-4 rtl:block" />
          <span className="sr-only">{t("next")}</span>
        </Button>
      </header>

      <div className="grid grid-cols-7 border-b">
        {weekdays.map((label) => (
          <div
            key={label}
            className="text-muted-foreground py-1.5 text-center text-[11px] font-medium"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((date) => {
          const dayEvents = byDate.get(date) ?? []
          const inMonth = date.startsWith(month)
          const isToday = date === today
          const shown = dayEvents.slice(0, maxPerDay)
          const rest = dayEvents.length - shown.length

          return (
            <div
              key={date}
              className={cn(
                "min-h-20 border-b border-e p-1 last:border-e-0 sm:min-h-28",
                !inMonth && "bg-muted/30",
                "[&:nth-child(7n)]:border-e-0"
              )}
            >
              <button
                type="button"
                onClick={() => onDayClick?.(date)}
                className={cn(
                  "hover:bg-accent mb-1 flex size-6 items-center justify-center rounded-full text-[11px] transition-colors",
                  isToday && "bg-foreground text-background font-medium",
                  !inMonth && "text-muted-foreground"
                )}
                aria-label={date}
              >
                {Number(date.slice(8, 10))}
              </button>

              <div className="space-y-0.5">
                {shown.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={event.onClick}
                    title={event.title}
                    className={cn(
                      "hover:bg-accent flex w-full items-center gap-1 rounded px-1 py-0.5 text-start text-[11px] transition-colors",
                      event.muted && "text-muted-foreground line-through"
                    )}
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{
                        background: event.color ?? "var(--muted-foreground)",
                      }}
                    />
                    <span className="truncate">{event.title}</span>
                  </button>
                ))}

                {rest > 0 ? (
                  <p className="text-muted-foreground px-1 text-[11px]">
                    +{rest}
                  </p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
