"use client"

import { cn } from "cn"
import {
  BookOpenCheckIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  FolderKanbanIcon,
  ListChecksIcon,
  TargetIcon,
  TimerIcon,
  WalletIcon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { StatCard } from "@/components/dashboard/stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { useFilterParams } from "@/hooks/use-filter-params"
import { formatDateShort } from "@/lib/dates"
import { formatCurrency, formatDuration } from "@/lib/format"

import type { Locale } from "@/i18n/routing"
import type { StatsData } from "@/server/queries/stats"

const RANGES = [7, 30, 90, 365] as const

export function StatsView({ data }: { data: StatsData }) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const { set } = useFilterParams()

  return (
    <>
      <PageHeader title={t("nav.stats")} description={t("stats.subtitle")} />

      <div className="flex flex-wrap gap-2 pb-6">
        {RANGES.map((range) => (
          <Button
            key={range}
            variant={data.range === range ? "secondary" : "outline"}
            size="sm"
            onClick={() => set({ range: String(range) })}
          >
            {t(`stats.range${range}`)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5 pb-6 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          Icon={CheckCircle2Icon}
          value={data.tasks.completed}
          label={t("stats.tasksCompleted")}
          tone={data.tasks.completed > 0 ? "success" : "default"}
          hint={t("stats.completionRate", { value: data.tasks.rate })}
        />
        <StatCard
          Icon={ListChecksIcon}
          value={data.tasks.created}
          label={t("stats.tasksCreated")}
        />
        <StatCard
          Icon={CircleDashedIcon}
          value={data.tasks.open}
          label={t("stats.tasksOpen")}
        />
        <StatCard
          Icon={TimerIcon}
          value={formatDuration(data.focus.seconds, locale)}
          label={t("stats.focusTotal")}
          hint={t("stats.focusDaily", {
            value: formatDuration(data.focus.dailyAverage, locale),
          })}
        />
        <StatCard
          Icon={FolderKanbanIcon}
          value={data.projectsCompleted}
          label={t("stats.projectsCompleted")}
        />
        <StatCard
          Icon={TargetIcon}
          value={`${data.goalsCompleted}/${data.totalGoals}`}
          label={t("stats.goalsCompleted")}
        />
        <StatCard
          Icon={BookOpenCheckIcon}
          value={data.assignmentsDone}
          label={t("stats.assignmentsDone")}
        />
        <StatCard
          Icon={BookOpenIcon}
          value={data.lessonsDone}
          label={t("stats.lessonsDone")}
        />
      </div>

      <TaskSeriesChart data={data} />

      <section className="bg-card mt-4 rounded-xl border p-4">
        <h2 className="text-sm font-medium">{t("stats.financeTitle")}</h2>
        <dl className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <dt className="text-muted-foreground text-xs">
              {t("finance.income")}
            </dt>
            <dd className="text-success mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(data.finance.income, locale, { compact: true })}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">
              {t("finance.expense")}
            </dt>
            <dd className="text-destructive mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(data.finance.expense, locale, { compact: true })}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <WalletIcon className="size-3.5" />
              {t("finance.balance")}
            </dt>
            <dd
              className={cn(
                "mt-1 text-lg font-semibold tabular-nums",
                data.finance.balance < 0 && "text-destructive"
              )}
            >
              {formatCurrency(data.finance.balance, locale, { compact: true })}
            </dd>
          </div>
        </dl>
      </section>
    </>
  )
}

/**
 * المهام المُنشأة مقابل المنجزة — سلسلتان بلون مُتحقَّق منه،
 * مع مفتاح دائم وجدول مكافئ. محور واحد: كلتاهما عدد مهام.
 */
function TaskSeriesChart({ data }: { data: StatsData }) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const [hovered, setHovered] = useState<string | null>(null)

  const max = Math.max(
    ...data.series.flatMap((point) => [point.created, point.completed]),
    1
  )
  const active = data.series.find((point) => point.date === hovered)

  const label = t(data.grouped ? "stats.chartTitleWeekly" : "stats.chartTitle")

  return (
    <section className="bg-card rounded-xl border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{label}</h2>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <span className="bg-chart-1 size-2.5 rounded-[3px]" />
            {t("stats.tasksCreated")}
          </span>
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <span className="bg-chart-3 size-2.5 rounded-[3px]" />
            {t("stats.tasksCompleted")}
          </span>
        </div>
      </div>

      <div
        className="mt-5 flex h-36 items-end gap-[3px]"
        onMouseLeave={() => setHovered(null)}
      >
        {data.series.map((point) => (
          <button
            key={point.date}
            type="button"
            className="flex h-full flex-1 items-end justify-center gap-[2px]"
            onMouseEnter={() => setHovered(point.date)}
            onFocus={() => setHovered(point.date)}
            onBlur={() => setHovered(null)}
            aria-label={`${formatDateShort(point.date, locale)}: ${t("stats.tasksCreated")} ${point.created}, ${t("stats.tasksCompleted")} ${point.completed}`}
          >
            {/* الصفر يُرسم محايداً لا بلون السلسلة، حتى لا يُقرأ كقيمة صغيرة */}
            <span
              className={cn(
                "w-1/2 rounded-t-[4px] transition-opacity",
                point.created ? "bg-chart-1" : "bg-muted",
                hovered === point.date && point.created && "opacity-80"
              )}
              style={{
                height: point.created
                  ? `${Math.max(4, (point.created / max) * 100)}%`
                  : "3px",
              }}
            />
            <span
              className={cn(
                "w-1/2 rounded-t-[4px] transition-opacity",
                point.completed ? "bg-chart-3" : "bg-muted",
                hovered === point.date && point.completed && "opacity-80"
              )}
              style={{
                height: point.completed
                  ? `${Math.max(4, (point.completed / max) * 100)}%`
                  : "3px",
              }}
            />
          </button>
        ))}
      </div>

      <p className="text-muted-foreground mt-2 min-h-5 text-xs">
        {active
          ? `${formatDateShort(active.date, locale)} · ${t("stats.tasksCreated")} ${active.created} · ${t("stats.tasksCompleted")} ${active.completed}`
          : t("finance.trendHint")}
      </p>

      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">{t("exam.date")}</th>
            <th scope="col">{t("stats.tasksCreated")}</th>
            <th scope="col">{t("stats.tasksCompleted")}</th>
          </tr>
        </thead>
        <tbody>
          {data.series.map((point) => (
            <tr key={point.date}>
              <th scope="row">{formatDateShort(point.date, locale)}</th>
              <td>{point.created}</td>
              <td>{point.completed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
