"use client"

import { cn } from "cn"
import { CalendarClockIcon, RepeatIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import { formatClock, isOverdue, relativeDueLabel } from "@/lib/dates"

import type { Locale } from "@/i18n/routing"
import type { TaskPriority, TaskRecurrence, TaskStatus } from "@/schemas/task"

/** الأولوية تُقرأ من اللون + النص معاً — لا نعتمد على اللون وحده */
const PRIORITY_CLASS: Record<TaskPriority, string> = {
  LOW: "text-muted-foreground",
  MEDIUM: "text-info",
  HIGH: "text-warning",
  URGENT: "text-destructive",
}

const PRIORITY_DOT: Record<TaskPriority, string> = {
  LOW: "bg-muted-foreground/50",
  MEDIUM: "bg-info",
  HIGH: "bg-warning",
  URGENT: "bg-destructive",
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority
  className?: string
}) {
  const t = useTranslations("priority")

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        PRIORITY_CLASS[priority],
        className
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", PRIORITY_DOT[priority])}
      />
      {t(priority)}
    </span>
  )
}

export function PriorityDot({ priority }: { priority: TaskPriority }) {
  const t = useTranslations("priority")

  return (
    <span
      title={t(priority)}
      className={cn("size-2 shrink-0 rounded-full", PRIORITY_DOT[priority])}
    />
  )
}

const STATUS_CLASS: Record<TaskStatus, string> = {
  TODO: "",
  IN_PROGRESS: "border-info/40 text-info",
  DONE: "border-success/40 text-success",
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const t = useTranslations("status")

  return (
    <Badge variant="outline" className={cn("font-normal", STATUS_CLASS[status])}>
      {t(status)}
    </Badge>
  )
}

export function DueBadge({
  dueDate,
  dueTime,
  done,
}: {
  dueDate: string
  dueTime?: string | null
  done?: boolean
}) {
  const locale = useLocale() as Locale
  const t = useTranslations("task")
  const late = !done && isOverdue(dueDate)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs whitespace-nowrap",
        late ? "text-destructive font-medium" : "text-muted-foreground"
      )}
    >
      <CalendarClockIcon className="size-3.5 shrink-0" />
      {relativeDueLabel(dueDate, locale)}
      {dueTime ? ` · ${formatClock(dueTime, locale)}` : ""}
      {late ? (
        <span className="sr-only"> — {t("overdue")}</span>
      ) : null}
    </span>
  )
}

export function RecurrenceBadge({
  recurrence,
}: {
  recurrence: TaskRecurrence
}) {
  const t = useTranslations("recurrence")
  if (recurrence === "NONE") return null

  return (
    <span
      className="text-muted-foreground inline-flex items-center gap-1 text-xs"
      title={t(recurrence)}
    >
      <RepeatIcon className="size-3.5" />
      <span className="sr-only">{t(recurrence)}</span>
    </span>
  )
}

export function TagChips({
  tags,
  max = 3,
}: {
  tags: { id: string; name: string; color: string | null }[]
  max?: number
}) {
  if (tags.length === 0) return null
  const shown = tags.slice(0, max)
  const rest = tags.length - shown.length

  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((tag) => (
        <span
          key={tag.id}
          className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]"
        >
          {tag.color ? (
            <span
              className="size-1.5 rounded-full"
              style={{ background: tag.color }}
            />
          ) : null}
          {tag.name}
        </span>
      ))}
      {rest > 0 ? (
        <span className="text-muted-foreground text-[11px]">+{rest}</span>
      ) : null}
    </span>
  )
}
