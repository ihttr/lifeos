"use client"

import { cn } from "cn"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { formatDateShort, todayISO } from "@/lib/dates"
import { formatDuration } from "@/lib/format"

import type { Locale } from "@/i18n/routing"
import type { FocusDay } from "@/server/queries/focus"

/**
 * دقائق التركيز اليومية — سلسلة واحدة، فلا حاجة لمفتاح ألوان
 * (العنوان يسمّيها). اللون مُتحقَّق منه بمدقّق اللوحة في الوضعين.
 *
 * الأعمدة رفيعة بفجوة ثابتة ونهايات مدوّرة من الأعلى فقط، مثبّتة على خط الأساس.
 * لكل عمود تلميح عند التأشير، وجدول مخفي بصرياً يحمل نفس الأرقام
 * لمن يقرأ بقارئ شاشة أو يطبع الصفحة.
 */
export function FocusChart({ days }: { days: FocusDay[] }) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const [hovered, setHovered] = useState<string | null>(null)

  const today = todayISO()
  const maxSeconds = Math.max(...days.map((day) => day.seconds), 1)
  const active = days.find((day) => day.date === hovered)

  return (
    <section className="bg-card rounded-xl border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{t("focus.chartTitle")}</h2>
        <p className="text-muted-foreground text-xs">
          {active
            ? `${formatDateShort(active.date, locale)} · ${formatDuration(active.seconds, locale)}`
            : t("focus.chartHint")}
        </p>
      </div>

      <div
        className="mt-4 flex h-32 items-end gap-[2px]"
        onMouseLeave={() => setHovered(null)}
      >
        {days.map((day) => {
          const ratio = day.seconds / maxSeconds
          const isToday = day.date === today
          const empty = day.seconds === 0

          return (
            <button
              key={day.date}
              type="button"
              // منطقة التأشير تشمل كامل الارتفاع حتى لا يضيع العمود القصير
              className="group relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHovered(day.date)}
              onFocus={() => setHovered(day.date)}
              onBlur={() => setHovered(null)}
              aria-label={`${formatDateShort(day.date, locale)}: ${formatDuration(day.seconds, locale)}`}
            >
              <span
                className={cn(
                  "w-full rounded-t-[4px] transition-colors",
                  empty ? "bg-muted" : "bg-chart-1",
                  hovered === day.date && !empty && "opacity-80",
                  isToday && "ring-foreground/40 ring-1"
                )}
                style={{
                  height: empty ? "3px" : `${Math.max(6, ratio * 100)}%`,
                }}
              />
            </button>
          )
        })}
      </div>

      <div className="text-muted-foreground mt-2 flex justify-between text-[11px]">
        <span>{formatDateShort(days[0]?.date ?? today, locale)}</span>
        <span>{t("common.today")}</span>
      </div>

      {/* نفس الأرقام كجدول — لقارئ الشاشة وللطباعة */}
      <table className="sr-only">
        <caption>{t("focus.chartTitle")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("exam.date")}</th>
            <th scope="col">{t("dashboard.focusWeek")}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <th scope="row">{formatDateShort(day.date, locale)}</th>
              <td>{formatDuration(day.seconds, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
