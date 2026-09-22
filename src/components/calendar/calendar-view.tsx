"use client"

import { cn } from "cn"
import {
  BookOpenCheckIcon,
  CalendarIcon,
  FolderKanbanIcon,
  GraduationCapIcon,
  ListChecksIcon,
  TargetIcon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { EmptyState } from "@/components/shared/empty-state"
import { MonthCalendar } from "@/components/shared/month-calendar"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { useFilterParams } from "@/hooks/use-filter-params"
import { Link } from "@/i18n/navigation"
import { formatClock, formatDateLong, isOverdue, todayISO } from "@/lib/dates"

import type { Locale } from "@/i18n/routing"
import type { AgendaItem, AgendaKind } from "@/server/queries/agenda"

const KIND_ICON = {
  task: ListChecksIcon,
  assignment: BookOpenCheckIcon,
  exam: GraduationCapIcon,
  project: FolderKanbanIcon,
  goal: TargetIcon,
} as const

const KINDS: AgendaKind[] = ["task", "assignment", "exam", "project", "goal"]

export function CalendarView({
  items,
  month,
  kind,
}: {
  items: AgendaItem[]
  month: string
  kind?: AgendaKind
}) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const { set } = useFilterParams()

  const today = todayISO()
  const todayItems = items.filter((item) => item.date === today)

  return (
    <>
      <PageHeader
        title={t("nav.calendar")}
        description={t("calendar.subtitle")}
      />

      {/* مرشّح النوع — الأيقونة والنص معاً، لا اللون وحده */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-5 sm:mx-0 sm:flex-wrap sm:px-0">
        <Button
          variant={kind ? "outline" : "secondary"}
          size="sm"
          onClick={() => set({ kind: undefined })}
        >
          {t("common.all")}
        </Button>

        {KINDS.map((value) => {
          const Icon = KIND_ICON[value]
          return (
            <Button
              key={value}
              variant={kind === value ? "secondary" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => set({ kind: kind === value ? undefined : value })}
            >
              <Icon className="size-4" />
              {t(`agenda.${value}`)}
            </Button>
          )
        })}
      </div>

      <MonthCalendar
        month={month}
        onMonthChange={(next) => set({ month: next })}
        maxPerDay={4}
        events={items.map((item) => ({
          id: item.id,
          date: item.date,
          title: item.title,
          color: item.color ?? undefined,
          muted: item.done,
        }))}
      />

      {/* قائمة اليوم أسفل الشبكة — الشبكة تعطي الشكل، والقائمة تعطي التفاصيل */}
      <section className="pt-6">
        <h2 className="mb-2.5 text-sm font-medium">
          {t("calendar.todayHeading")}
          <span className="text-muted-foreground ms-2 font-normal">
            {formatDateLong(today, locale)}
          </span>
        </h2>

        {todayItems.length === 0 ? (
          <EmptyState
            Icon={CalendarIcon}
            title={t("calendar.emptyTodayTitle")}
            description={t("calendar.emptyTodayBody")}
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {todayItems.map((item) => {
              const Icon = KIND_ICON[item.kind]
              const late = !item.done && isOverdue(item.date)

              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="hover:bg-accent/40 flex items-start gap-3 px-3 py-2.5 transition-colors"
                  >
                    <Icon
                      className="mt-0.5 size-4 shrink-0"
                      style={{ color: item.color ?? undefined }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm",
                          item.done && "text-muted-foreground line-through"
                        )}
                      >
                        {item.title}
                      </p>
                      <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                        <span>{t(`agenda.${item.kind}`)}</span>
                        {item.context ? <span>{item.context}</span> : null}
                        {item.time ? (
                          <span className={cn(late && "text-destructive")}>
                            {formatClock(item.time, locale)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
