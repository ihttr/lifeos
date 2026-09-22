"use client"

import { cn } from "cn"
import {
  AlarmClockIcon,
  BookOpenCheckIcon,
  CalendarClockIcon,
  CheckIcon,
  GraduationCapIcon,
  LayersIcon,
  MapPinIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { StatCard } from "@/components/dashboard/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import { MonthCalendar } from "@/components/shared/month-calendar"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { AssignmentFormDialog } from "@/components/university/assignment-form-dialog"
import { ExamFormDialog } from "@/components/university/exam-form-dialog"
import { SemesterDialog } from "@/components/university/semester-dialog"
import { SubjectCard } from "@/components/university/subject-card"
import { SubjectFormDialog } from "@/components/university/subject-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAction } from "@/hooks/use-action"
import { useFilterParams } from "@/hooks/use-filter-params"
import {
  formatClock,
  formatDateShort,
  isOverdue,
  relativeDueLabel,
  todayISO,
} from "@/lib/dates"
import {
  activateSemester,
  deleteAssignment,
  deleteExam,
  deleteSemester,
  deleteSubject,
  setAssignmentStatus,
} from "@/server/actions/university"

import type { Locale } from "@/i18n/routing"
import type { UniversityFilters } from "@/schemas/university"
import type {
  AssignmentDTO,
  ExamDTO,
  SemesterDTO,
  SubjectDTO,
} from "@/server/queries/university"

type Summary = {
  subjects: number
  pending: number
  overdue: number
  upcomingExams: number
  credits: number
}

export function UniversityView({
  semesters,
  activeSemesterId,
  subjects,
  assignments,
  exams,
  summary,
  filters,
}: {
  semesters: SemesterDTO[]
  activeSemesterId: string | null
  subjects: SubjectDTO[]
  assignments: AssignmentDTO[]
  exams: ExamDTO[]
  summary: Summary
  filters: UniversityFilters
}) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const { set } = useFilterParams()
  const { pending, run } = useAction()

  const [semesterOpen, setSemesterOpen] = useState(false)
  const [editingSemester, setEditingSemester] = useState<SemesterDTO | null>(null)
  const [subjectOpen, setSubjectOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<SubjectDTO | null>(null)
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<AssignmentDTO | null>(
    null
  )
  const [examOpen, setExamOpen] = useState(false)
  const [editingExam, setEditingExam] = useState<ExamDTO | null>(null)
  const [presetSubject, setPresetSubject] = useState<string | undefined>()

  const semester = semesters.find((s) => s.id === activeSemesterId) ?? null
  const hasSubjects = subjects.length > 0

  // --- لا فصول بعد: أول شيء يحتاجه المستخدم هو إنشاء فصل ---
  if (semesters.length === 0) {
    return (
      <>
        <PageHeader title={t("nav.university")} />
        <EmptyState
          Icon={LayersIcon}
          title={t("semester.emptyTitle")}
          description={t("semester.emptyBody")}
          action={
            <Button
              onClick={() => {
                setEditingSemester(null)
                setSemesterOpen(true)
              }}
            >
              <PlusIcon className="size-4" />
              {t("semester.new")}
            </Button>
          }
        />
        <SemesterDialog
          open={semesterOpen}
          onOpenChange={setSemesterOpen}
          semester={null}
        />
      </>
    )
  }

  function openSubject(subject: SubjectDTO | null) {
    setEditingSubject(subject)
    setSubjectOpen(true)
  }

  function openAssignment(
    assignment: AssignmentDTO | null,
    subjectId?: string
  ) {
    setEditingAssignment(assignment)
    setPresetSubject(subjectId)
    setAssignmentOpen(true)
  }

  function openExam(exam: ExamDTO | null, subjectId?: string) {
    setEditingExam(exam)
    setPresetSubject(subjectId)
    setExamOpen(true)
  }

  return (
    <>
      <PageHeader
        title={t("nav.university")}
        description={semester?.name}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={activeSemesterId ?? undefined}
              onValueChange={(value) => set({ semester: value, subject: undefined })}
            >
              <SelectTrigger className="w-44" aria-label={t("semester.one")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {semesters.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <span className="flex items-center gap-2">
                      {item.name}
                      {item.isActive ? (
                        <Badge variant="secondary" className="px-1.5 text-[10px]">
                          {t("semester.active")}
                        </Badge>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t("common.more")}>
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onSelect={() => {
                    setEditingSemester(null)
                    setSemesterOpen(true)
                  }}
                >
                  <PlusIcon className="size-4" />
                  {t("semester.new")}
                </DropdownMenuItem>

                {semester ? (
                  <>
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditingSemester(semester)
                        setSemesterOpen(true)
                      }}
                    >
                      <PencilIcon className="size-4" />
                      {t("semester.edit")}
                    </DropdownMenuItem>

                    {!semester.isActive ? (
                      <DropdownMenuItem
                        disabled={pending}
                        onSelect={() =>
                          run(() => activateSemester({ id: semester.id }), {
                            success: "semester.activated",
                          })
                        }
                      >
                        <CheckIcon className="size-4" />
                        {t("semester.setActive")}
                      </DropdownMenuItem>
                    ) : null}

                    <DropdownMenuSeparator />
                    <ConfirmDialog
                      title={t("semester.deleteConfirmTitle")}
                      description={t("semester.deleteConfirmBody")}
                      onConfirm={() =>
                        run(() => deleteSemester({ id: semester.id }), {
                          success: "semester.deleted",
                          onSuccess: () => set({ semester: undefined }),
                        })
                      }
                      trigger={
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={(event) => event.preventDefault()}
                        >
                          <Trash2Icon className="size-4" />
                          {t("semester.delete")}
                        </DropdownMenuItem>
                      }
                    />
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 pb-6 lg:grid-cols-4">
        <StatCard
          Icon={LayersIcon}
          value={summary.subjects}
          label={t("subject.many")}
          hint={t("subject.creditsLabel", { count: summary.credits })}
        />
        <StatCard
          Icon={BookOpenCheckIcon}
          value={summary.pending}
          label={t("university.pendingAssignments")}
        />
        <StatCard
          Icon={AlarmClockIcon}
          value={summary.overdue}
          label={t("dashboard.overdue")}
          tone={summary.overdue > 0 ? "danger" : "default"}
        />
        <StatCard
          Icon={GraduationCapIcon}
          value={summary.upcomingExams}
          label={t("university.upcomingExams")}
        />
      </div>

      <Tabs value={filters.tab} onValueChange={(tab) => set({ tab })}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="subjects">{t("subject.many")}</TabsTrigger>
          <TabsTrigger value="assignments">
            {t("assignment.many")}
            {summary.pending + summary.overdue > 0 ? (
              <span className="text-muted-foreground ms-1.5 text-xs">
                {summary.pending + summary.overdue}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="exams">{t("exam.many")}</TabsTrigger>
          <TabsTrigger value="calendar">{t("nav.calendar")}</TabsTrigger>
        </TabsList>

        {/* ------------------------------ المواد ------------------------------ */}
        <TabsContent value="subjects" className="mt-4">
          {!hasSubjects ? (
            <EmptyState
              Icon={LayersIcon}
              title={t("subject.emptyTitle")}
              description={t("subject.emptyBody")}
              action={
                <Button onClick={() => openSubject(null)}>
                  <PlusIcon className="size-4" />
                  {t("subject.new")}
                </Button>
              }
            />
          ) : (
            <>
              <Button
                variant="outline"
                className="mb-4"
                onClick={() => openSubject(null)}
              >
                <PlusIcon className="size-4" />
                {t("subject.new")}
              </Button>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {subjects.map((subject) => (
                  <SubjectCard
                    key={subject.id}
                    subject={subject}
                    onEdit={() => openSubject(subject)}
                    onAddAssignment={() => openAssignment(null, subject.id)}
                    onAddExam={() => openExam(null, subject.id)}
                    onDelete={() =>
                      run(() => deleteSubject({ id: subject.id }), {
                        success: "subject.deleted",
                      })
                    }
                  />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ---------------------------- الواجبات ---------------------------- */}
        <TabsContent value="assignments" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={!hasSubjects}
              onClick={() => openAssignment(null)}
            >
              <PlusIcon className="size-4" />
              {t("assignment.new")}
            </Button>

            <Select
              value={filters.subject ?? "all"}
              onValueChange={(value) => set({ subject: value })}
            >
              <SelectTrigger size="sm" className="w-40" aria-label={t("task.subject")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("subject.allSubjects")}</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.status ?? "all"}
              onValueChange={(value) => set({ status: value })}
            >
              <SelectTrigger size="sm" className="w-36" aria-label={t("task.status")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("status.allStatuses")}</SelectItem>
                <SelectItem value="TODO">{t("status.TODO")}</SelectItem>
                <SelectItem value="IN_PROGRESS">
                  {t("status.IN_PROGRESS")}
                </SelectItem>
                <SelectItem value="DONE">{t("status.DONE")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {assignments.length === 0 ? (
            <EmptyState
              Icon={BookOpenCheckIcon}
              title={t("assignment.emptyTitle")}
              description={
                hasSubjects
                  ? t("assignment.emptyBody")
                  : t("subject.emptyBody")
              }
            />
          ) : (
            <ul className="divide-y rounded-xl border">
              {assignments.map((assignment) => {
                const done = assignment.status === "DONE"
                const late = !done && isOverdue(assignment.dueDate)

                return (
                  <li
                    key={assignment.id}
                    className="group hover:bg-accent/40 flex items-start gap-3 px-3 py-2.5 transition-colors"
                  >
                    <Checkbox
                      checked={done}
                      disabled={pending}
                      aria-label={assignment.title}
                      className="mt-1"
                      onCheckedChange={(value) =>
                        run(
                          () =>
                            setAssignmentStatus({
                              id: assignment.id,
                              status: value === true ? "DONE" : "TODO",
                            }),
                          { success: "assignment.updated" }
                        )
                      }
                    />

                    <button
                      type="button"
                      onClick={() => openAssignment(assignment)}
                      aria-label={assignment.title}
                      className="min-w-0 flex-1 text-start"
                    >
                      <span
                        className={cn(
                          "block text-sm leading-snug",
                          done && "text-muted-foreground line-through"
                        )}
                      >
                        {assignment.title}
                      </span>

                      <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                        <span className="text-muted-foreground inline-flex items-center gap-1">
                          <span
                            className="size-1.5 rounded-full"
                            style={{
                              background:
                                assignment.subject.color ??
                                "var(--muted-foreground)",
                            }}
                          />
                          {assignment.subject.name}
                        </span>

                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            late
                              ? "text-destructive font-medium"
                              : "text-muted-foreground"
                          )}
                        >
                          <CalendarClockIcon className="size-3.5" />
                          {relativeDueLabel(assignment.dueDate, locale)}
                          {assignment.dueTime !== "23:59"
                            ? ` · ${formatClock(assignment.dueTime, locale)}`
                            : ""}
                        </span>

                        {assignment.status === "IN_PROGRESS" ? (
                          <Badge
                            variant="outline"
                            className="border-info/40 text-info px-1.5 py-0 font-normal"
                          >
                            {t("status.IN_PROGRESS")}
                          </Badge>
                        ) : null}

                        {assignment.grade !== null &&
                        assignment.maxGrade !== null ? (
                          <span className="text-success font-medium">
                            {assignment.grade}/{assignment.maxGrade}
                          </span>
                        ) : null}
                      </span>
                    </button>

                    <ConfirmDialog
                      title={t("assignment.deleteConfirmTitle")}
                      description={t("task.deleteConfirmBody")}
                      onConfirm={() =>
                        run(() => deleteAssignment({ id: assignment.id }), {
                          success: "assignment.deleted",
                        })
                      }
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 md:opacity-0 md:group-hover:opacity-100"
                          aria-label={t("common.delete")}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      }
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </TabsContent>

        {/* --------------------------- الاختبارات --------------------------- */}
        <TabsContent value="exams" className="mt-4 space-y-4">
          <Button
            variant="outline"
            disabled={!hasSubjects}
            onClick={() => openExam(null)}
          >
            <PlusIcon className="size-4" />
            {t("exam.new")}
          </Button>

          {exams.length === 0 ? (
            <EmptyState
              Icon={GraduationCapIcon}
              title={t("exam.emptyTitle")}
              description={
                hasSubjects ? t("exam.emptyBody") : t("subject.emptyBody")
              }
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {exams.map((exam) => {
                const past = isOverdue(exam.date)

                return (
                  <li
                    key={exam.id}
                    className={cn(
                      "bg-card group relative rounded-xl border p-4",
                      past && "opacity-60"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openExam(exam)}
                      aria-label={exam.title}
                      className="w-full text-start"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{
                            background:
                              exam.subject.color ?? "var(--muted-foreground)",
                          }}
                        />
                        <span className="truncate text-sm font-medium">
                          {exam.title}
                        </span>
                        {exam.weight ? (
                          <Badge
                            variant="outline"
                            className="ms-auto shrink-0 font-normal"
                          >
                            {exam.weight}%
                          </Badge>
                        ) : null}
                      </div>

                      <p className="text-muted-foreground mt-2 text-xs">
                        {exam.subject.name}
                      </p>

                      <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            !past && "text-foreground font-medium"
                          )}
                        >
                          <CalendarClockIcon className="size-3.5" />
                          {formatDateShort(exam.date, locale)} ·{" "}
                          {formatClock(exam.time, locale)}
                        </span>
                        {exam.location ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPinIcon className="size-3.5" />
                            {exam.location}
                          </span>
                        ) : null}
                      </p>
                    </button>

                    <ConfirmDialog
                      title={t("exam.deleteConfirmTitle")}
                      description={t("task.deleteConfirmBody")}
                      onConfirm={() =>
                        run(() => deleteExam({ id: exam.id }), {
                          success: "exam.deleted",
                        })
                      }
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-3 end-3 size-7 md:opacity-0 md:group-hover:opacity-100"
                          aria-label={t("common.delete")}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      }
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </TabsContent>

        {/* ---------------------------- التقويم ---------------------------- */}
        <TabsContent value="calendar" className="mt-4">
          <MonthCalendar
            month={filters.month ?? todayISO().slice(0, 7)}
            onMonthChange={(month) => set({ month })}
            events={[
              ...assignments.map((assignment) => ({
                id: `a-${assignment.id}`,
                date: assignment.dueDate,
                title: assignment.title,
                color: assignment.subject.color ?? undefined,
                muted: assignment.status === "DONE",
                onClick: () => openAssignment(assignment),
              })),
              ...exams.map((exam) => ({
                id: `e-${exam.id}`,
                date: exam.date,
                title: `${t("agenda.exam")}: ${exam.title}`,
                color: "var(--destructive)",
                muted: isOverdue(exam.date),
                onClick: () => openExam(exam),
              })),
            ]}
          />
        </TabsContent>
      </Tabs>

      {/* زر عائم للجوال */}
      {hasSubjects ? (
        <Button
          size="icon"
          aria-label={t("assignment.new")}
          onClick={() => openAssignment(null)}
          className="fixed bottom-24 end-4 z-30 size-12 rounded-full shadow-lg md:hidden"
        >
          <PlusIcon className="size-5" />
        </Button>
      ) : null}

      <SemesterDialog
        open={semesterOpen}
        onOpenChange={setSemesterOpen}
        semester={editingSemester}
      />

      {activeSemesterId ? (
        <SubjectFormDialog
          open={subjectOpen}
          onOpenChange={setSubjectOpen}
          subject={editingSubject}
          semesterId={activeSemesterId}
        />
      ) : null}

      <AssignmentFormDialog
        open={assignmentOpen}
        onOpenChange={setAssignmentOpen}
        assignment={editingAssignment}
        subjects={subjects}
        defaultSubjectId={presetSubject}
      />

      <ExamFormDialog
        open={examOpen}
        onOpenChange={setExamOpen}
        exam={editingExam}
        subjects={subjects}
        defaultSubjectId={presetSubject}
      />
    </>
  )
}
