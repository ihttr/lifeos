"use client"

import { cn } from "cn"
import {
  AlarmClockIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenCheckIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  FolderKanbanIcon,
  GraduationCapIcon,
  ListChecksIcon,
  NotebookPenIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  TargetIcon,
  TimerIcon,
  WalletIcon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState, type ReactNode } from "react"

import { StatCard } from "@/components/dashboard/stat-card"
import { WIDGETS, type WidgetId } from "@/components/dashboard/widgets"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { ProgressBar } from "@/components/shared/progress-bar"
import {
  TaskFormDialog,
  type TaskFormOptions,
} from "@/components/tasks/task-form-dialog"
import { TaskList } from "@/components/tasks/task-list"
import { Button } from "@/components/ui/button"
import { useAction } from "@/hooks/use-action"
import { Link } from "@/i18n/navigation"
import {
  formatDateLong,
  formatHijri,
  greetingKey,
  isOverdue,
  relativeDueLabel,
  todayISO,
} from "@/lib/dates"
import { formatCurrency, formatDuration } from "@/lib/format"
import {
  archiveTasks,
  deleteTask,
  duplicateTask,
  toggleTask,
} from "@/server/actions/tasks"

import type { Locale } from "@/i18n/routing"
import type { AgendaItem } from "@/server/queries/agenda"
import type { DashboardData } from "@/server/queries/dashboard"
import type { TaskDTO } from "@/server/queries/tasks"

const AGENDA_ICON = {
  task: ListChecksIcon,
  assignment: BookOpenCheckIcon,
  exam: GraduationCapIcon,
  project: FolderKanbanIcon,
  goal: TargetIcon,
} as const

export function DashboardView({
  data,
  widgets,
  userName,
  taskOptions,
}: {
  data: DashboardData
  widgets: WidgetId[]
  userName: string
  taskOptions: TaskFormOptions
}) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const { pending, run } = useAction()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TaskDTO | null>(null)

  const today = todayISO()
  const firstName = userName.split(/[\s@]/)[0]

  function openTask(task: TaskDTO | null) {
    setEditing(task)
    setFormOpen(true)
  }

  const handlers = {
    onToggleDone: (task: TaskDTO, done: boolean) =>
      run(() => toggleTask({ id: task.id, done }), {
        success: done ? "task.completed" : "task.reopened",
      }),
    onEdit: openTask,
    onDuplicate: (task: TaskDTO) => run(() => duplicateTask({ id: task.id })),
    onArchive: (task: TaskDTO) => run(() => archiveTasks({ ids: [task.id] })),
    onDelete: (task: TaskDTO) =>
      run(() => deleteTask({ id: task.id }), { success: "task.deleted" }),
  }

  function renderWidget(id: WidgetId): ReactNode {
    switch (id) {
      case "stats":
        if (!data.counts) return null
        return (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              Icon={CircleDashedIcon}
              value={data.counts.remaining}
              label={t("dashboard.tasksRemaining")}
            />
            <StatCard
              Icon={CheckCircle2Icon}
              value={data.counts.doneToday}
              label={t("dashboard.tasksDoneToday")}
              tone={data.counts.doneToday > 0 ? "success" : "default"}
            />
            <StatCard
              Icon={AlarmClockIcon}
              value={data.counts.overdue}
              label={t("dashboard.overdue")}
              tone={data.counts.overdue > 0 ? "danger" : "default"}
            />
            <StatCard
              Icon={FolderKanbanIcon}
              value={data.activeProjects ?? 0}
              label={t("dashboard.activeProjects")}
            />
            <StatCard
              Icon={TimerIcon}
              value={formatDuration(data.focus?.weekSec ?? 0, locale)}
              label={t("dashboard.focusWeek")}
              hint={
                data.focus && data.focus.todaySec > 0
                  ? t("dashboard.focusToday", {
                      value: formatDuration(data.focus.todaySec, locale),
                    })
                  : undefined
              }
            />
          </div>
        )

      case "todayTasks":
        if (!data.todayTasks) return null
        return (
          <section>
            <SectionHeader
              title={t("dashboard.todayTasks")}
              href="/tasks"
              linkLabel={t("nav.tasks")}
            />
            {data.todayTasks.length === 0 ? (
              <EmptyState
                Icon={CheckCircle2Icon}
                title={t("dashboard.allClearTitle")}
                description={t("dashboard.allClearBody")}
                action={
                  <Button variant="outline" onClick={() => openTask(null)}>
                    <PlusIcon className="size-4" />
                    {t("task.new")}
                  </Button>
                }
              />
            ) : (
              <TaskList
                tasks={data.todayTasks}
                handlers={handlers}
                disabled={pending}
              />
            )}
          </section>
        )

      case "upcoming":
        if (!data.upcoming) return null
        return (
          <section>
            <SectionHeader
              title={t("dashboard.upcoming")}
              href="/calendar"
              linkLabel={t("nav.calendar")}
            />
            <UpcomingList items={data.upcoming} />
          </section>
        )

      case "projects":
        if (!data.projects) return null
        return (
          <section>
            <SectionHeader
              title={t("dashboard.activeProjects")}
              href="/projects"
              linkLabel={t("nav.projects")}
            />
            {data.projects.length === 0 ? (
              <EmptyCard text={t("empty.projectsTitle")} />
            ) : (
              <ul className="space-y-2">
                {data.projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/projects/${project.id}`}
                      className="bg-card hover:bg-accent/40 block rounded-xl border p-3 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{
                            background:
                              project.color ?? "var(--muted-foreground)",
                          }}
                        />
                        <span className="truncate text-sm font-medium">
                          {project.name}
                        </span>
                        <span className="text-muted-foreground ms-auto text-xs tabular-nums">
                          {project.progress}%
                        </span>
                      </div>
                      <ProgressBar
                        value={project.progress}
                        color={project.color}
                        size="sm"
                        className="mt-2"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )

      case "goals":
        if (!data.goals) return null
        return (
          <section>
            <SectionHeader
              title={t("nav.goals")}
              href="/goals"
              linkLabel={t("common.all")}
            />
            {data.goals.length === 0 ? (
              <EmptyCard text={t("empty.goalsTitle")} />
            ) : (
              <ul className="space-y-2">
                {data.goals.map((goal) => (
                  <li key={goal.id} className="bg-card rounded-xl border p-3">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {goal.title}
                      </span>
                      <span className="text-muted-foreground ms-auto text-xs tabular-nums">
                        {goal.done}/{goal.total}
                      </span>
                    </div>
                    <ProgressBar
                      value={goal.progress}
                      size="sm"
                      className="mt-2"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )

      case "university": {
        if (!data.university) return null
        const { assignments, exams } = data.university
        const items = [
          ...exams.map((e) => ({ ...e, isExam: true })),
          ...assignments.map((a) => ({ ...a, isExam: false })),
        ].sort((a, b) => a.date.localeCompare(b.date))

        return (
          <section>
            <SectionHeader
              title={t("widgets.university")}
              href="/university"
              linkLabel={t("nav.university")}
            />
            {items.length === 0 ? (
              <EmptyCard text={t("widgets.universityEmpty")} />
            ) : (
              <ul className="divide-y rounded-xl border">
                {items.map((item) => (
                  <li key={`${item.isExam ? "e" : "a"}-${item.id}`}>
                    <Link
                      href={
                        item.isExam
                          ? "/university?tab=exams"
                          : "/university?tab=assignments"
                      }
                      className="hover:bg-accent/40 flex items-start gap-2.5 px-3 py-2.5 transition-colors"
                    >
                      {item.isExam ? (
                        <GraduationCapIcon className="text-destructive mt-0.5 size-4 shrink-0" />
                      ) : (
                        <BookOpenCheckIcon
                          className="mt-0.5 size-4 shrink-0"
                          style={{ color: item.color ?? undefined }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{item.title}</p>
                        <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                          <span
                            className={cn(
                              isOverdue(item.date) &&
                                "text-destructive font-medium"
                            )}
                          >
                            {relativeDueLabel(item.date, locale)}
                          </span>
                          <span>{item.subject}</span>
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      }

      case "learning":
        if (!data.learning) return null
        return (
          <section>
            <SectionHeader
              title={t("nav.learning")}
              href="/learning"
              linkLabel={t("common.all")}
            />
            {data.learning.length === 0 ? (
              <EmptyCard text={t("learning.emptyTitle")} />
            ) : (
              <ul className="space-y-2">
                {data.learning.map((path) => (
                  <li key={path.id}>
                    <Link
                      href={`/learning?open=${path.id}`}
                      className="bg-card hover:bg-accent/40 block rounded-xl border p-3 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: path.color ?? "var(--chart-1)" }}
                        />
                        <span className="truncate text-sm font-medium">
                          {path.title}
                        </span>
                        <span className="text-muted-foreground ms-auto shrink-0 text-xs tabular-nums">
                          {path.done}/{path.total}
                        </span>
                      </div>

                      <ProgressBar
                        value={path.progress}
                        color={path.color}
                        size="sm"
                        className="mt-2"
                      />

                      {/* الدرس التالي — ما يجعل البطاقة قابلة للتنفيذ */}
                      {path.nextLesson ? (
                        <p className="text-muted-foreground mt-2 flex items-center gap-1.5 truncate text-xs">
                          <CircleDashedIcon className="size-3 shrink-0" />
                          {t("widgets.nextLesson", { title: path.nextLesson })}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )

      case "focus":
        if (!data.focus) return null
        return (
          <section>
            <SectionHeader
              title={t("nav.focus")}
              href="/focus"
              linkLabel={t("focus.start")}
            />
            <div className="bg-card rounded-xl border p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs">
                    {t("focus.today")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {formatDuration(data.focus.todaySec, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">
                    {t("focus.thisWeek")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {formatDuration(data.focus.weekSec, locale)}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
                <Link href="/focus">
                  <TimerIcon className="size-4" />
                  {t("focus.start")}
                </Link>
              </Button>
            </div>
          </section>
        )

      case "finance":
        if (!data.finance) return null
        return (
          <section>
            <SectionHeader
              title={t("nav.finance")}
              href="/finance"
              linkLabel={t("common.all")}
            />
            <div className="bg-card rounded-xl border p-4">
              <p className="text-muted-foreground text-xs">
                {t("widgets.financeMonth")}
              </p>
              <p
                className={cn(
                  "mt-1 text-2xl font-semibold tabular-nums",
                  data.finance.balance < 0 && "text-destructive"
                )}
              >
                {formatCurrency(data.finance.balance, locale)}
              </p>
              <dl className="text-muted-foreground mt-3 flex gap-4 text-xs">
                <div>
                  <dt className="inline">{t("finance.income")}: </dt>
                  <dd className="text-success inline font-medium">
                    {formatCurrency(data.finance.income, locale, { compact: true })}
                  </dd>
                </div>
                <div>
                  <dt className="inline">{t("finance.expense")}: </dt>
                  <dd className="text-destructive inline font-medium">
                    {formatCurrency(data.finance.expense, locale, { compact: true })}
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        )

      case "notes":
        if (!data.notes) return null
        return (
          <section>
            <SectionHeader
              title={t("nav.notes")}
              href="/notes"
              linkLabel={t("common.all")}
            />
            {data.notes.length === 0 ? (
              <EmptyCard text={t("empty.notesTitle")} />
            ) : (
              <ul className="divide-y rounded-xl border">
                {data.notes.map((note) => (
                  <li key={note.id}>
                    <Link
                      href={`/notes?open=${note.id}`}
                      className="hover:bg-accent/40 flex items-center gap-2.5 px-3 py-2.5 transition-colors"
                    >
                      <NotebookPenIcon className="text-muted-foreground size-4 shrink-0" />
                      <span className="truncate text-sm">{note.title}</span>
                      {note.category ? (
                        <span className="bg-muted text-muted-foreground ms-auto shrink-0 rounded px-1.5 py-0.5 text-[11px]">
                          {note.category}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )

      case "quickActions":
        return (
          <section>
            <h2 className="mb-2.5 text-sm font-medium">
              {t("dashboard.quickActions")}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => openTask(null)}>
                <ListChecksIcon className="size-4" />
                {t("task.one")}
              </Button>
              <QuickLink href="/projects" Icon={FolderKanbanIcon} label={t("project.one")} />
              <QuickLink href="/notes" Icon={NotebookPenIcon} label={t("note.one")} />
              <QuickLink href="/university" Icon={GraduationCapIcon} label={t("nav.university")} />
              <QuickLink href="/goals" Icon={TargetIcon} label={t("nav.goals")} />
              <QuickLink href="/finance" Icon={WalletIcon} label={t("nav.finance")} />
              <QuickLink href="/focus" Icon={TimerIcon} label={t("nav.focus")} />
            </div>
          </section>
        )
    }
  }

  return (
    <>
      <PageHeader
        title={t("dashboard.greetingLine", {
          greeting: t(`greeting.${greetingKey()}`),
          name: firstName,
        })}
        description={`${formatDateLong(today, locale)} · ${formatHijri(today, locale)}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" asChild>
              <Link
                href="/settings#dashboard"
                aria-label={t("widgets.customize")}
              >
                <SlidersHorizontalIcon className="size-4" />
              </Link>
            </Button>
            <Button onClick={() => openTask(null)} className="hidden md:inline-flex">
              <PlusIcon className="size-4" />
              {t("task.new")}
            </Button>
          </div>
        }
      />

      {widgets.length === 0 ? (
        <EmptyState
          Icon={SlidersHorizontalIcon}
          title={t("widgets.emptyTitle")}
          description={t("widgets.emptyBody")}
          action={
            <Button asChild>
              <Link href="/settings#dashboard">{t("widgets.customize")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {widgets.map((id) => (
            <div
              key={id}
              className={WIDGETS[id].wide ? "lg:col-span-2" : undefined}
            >
              {renderWidget(id)}
            </div>
          ))}
        </div>
      )}

      <Button
        size="icon"
        onClick={() => openTask(null)}
        aria-label={t("task.new")}
        className="fixed bottom-24 end-4 z-30 size-12 rounded-full shadow-lg md:hidden"
      >
        <PlusIcon className="size-5" />
      </Button>

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
        options={taskOptions}
      />
    </>
  )
}

// ------------------------------------------------------------------

function SectionHeader({
  title,
  href,
  linkLabel,
}: {
  title: string
  href: string
  linkLabel: string
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h2 className="text-sm font-medium">{title}</h2>
      <Link
        href={href}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
      >
        {linkLabel}
        <ArrowLeftIcon className="size-3 rtl:block ltr:hidden" />
        <ArrowRightIcon className="size-3 rtl:hidden" />
      </Link>
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
      {text}
    </p>
  )
}

function UpcomingList({ items }: { items: AgendaItem[] }) {
  const t = useTranslations()
  const locale = useLocale() as Locale

  if (items.length === 0) {
    return <EmptyCard text={t("dashboard.nothingUpcoming")} />
  }

  return (
    <ul className="divide-y rounded-xl border">
      {items.map((item) => {
        const Icon = AGENDA_ICON[item.kind]
        const late = isOverdue(item.date)

        return (
          <li key={item.id}>
            <Link
              href={item.href}
              className="hover:bg-accent/40 flex items-start gap-2.5 px-3 py-2.5 transition-colors"
            >
              <Icon
                className="mt-0.5 size-4 shrink-0"
                style={{ color: item.color ?? undefined }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.title}</p>
                <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      late && "text-destructive font-medium"
                    )}
                  >
                    <CalendarClockIcon className="size-3" />
                    {relativeDueLabel(item.date, locale)}
                    {item.time ? ` · ${item.time}` : ""}
                  </span>
                  {item.context ? <span>{item.context}</span> : null}
                  <span className="text-muted-foreground/70">
                    {t(`agenda.${item.kind}`)}
                  </span>
                </p>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function QuickLink({
  href,
  Icon,
  label,
}: {
  href: string
  Icon: typeof ListChecksIcon
  label: string
}) {
  return (
    <Link
      href={href}
      className="bg-background hover:bg-accent inline-flex h-8 items-center gap-2 rounded-md border px-3 text-sm transition-colors"
    >
      <Icon className="size-4" />
      {label}
    </Link>
  )
}
