"use client"

import { cn } from "cn"
import {
  AlarmClockIcon,
  BookOpenCheckIcon,
  GraduationCapIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ProgressBar } from "@/components/shared/progress-bar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { percentOf } from "@/lib/format"

import type { SubjectDTO } from "@/server/queries/university"

export function SubjectCard({
  subject,
  onEdit,
  onDelete,
  onAddAssignment,
  onAddExam,
}: {
  subject: SubjectDTO
  onEdit: () => void
  onDelete: () => void
  onAddAssignment: () => void
  onAddExam: () => void
}) {
  const t = useTranslations()
  const accent = subject.color ?? "var(--muted-foreground)"

  return (
    <article className="bg-card relative flex flex-col rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className="mt-1.5 size-2.5 shrink-0 rounded-full"
            style={{ background: accent }}
          />
          <div className="min-w-0">
            <h3 className="truncate font-medium">{subject.name}</h3>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {[
                subject.code,
                subject.instructor,
                t("subject.creditsLabel", { count: subject.credits }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 -me-1 shrink-0 rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            aria-label={t("common.more")}
          >
            <MoreHorizontalIcon className="size-4" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={onAddAssignment}>
              <BookOpenCheckIcon className="size-4" />
              {t("assignment.new")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onAddExam}>
              <GraduationCapIcon className="size-4" />
              {t("exam.new")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onEdit}>
              <PencilIcon className="size-4" />
              {t("common.edit")}
            </DropdownMenuItem>
            <ConfirmDialog
              title={t("subject.deleteConfirmTitle")}
              description={t("subject.deleteConfirmBody")}
              onConfirm={onDelete}
              trigger={
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(event) => event.preventDefault()}
                >
                  <Trash2Icon className="size-4" />
                  {t("common.delete")}
                </DropdownMenuItem>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 space-y-3">
        {subject.assignmentCount > 0 ? (
          <ProgressBar
            value={percentOf(subject.doneAssignmentCount, subject.assignmentCount)}
            label={t("subject.assignmentsDone", {
              done: subject.doneAssignmentCount,
              total: subject.assignmentCount,
            })}
            color={accent}
          />
        ) : (
          <p className="text-muted-foreground text-xs">
            {t("subject.noAssignments")}
          </p>
        )}

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {subject.overdueAssignmentCount > 0 ? (
            <span className="text-destructive inline-flex items-center gap-1 font-medium">
              <AlarmClockIcon className="size-3.5" />
              {t("subject.overdueCount", {
                count: subject.overdueAssignmentCount,
              })}
            </span>
          ) : null}

          {subject.pendingAssignmentCount > 0 ? (
            <span>
              {t("subject.pendingCount", {
                count: subject.pendingAssignmentCount,
              })}
            </span>
          ) : null}

          {subject.upcomingExamCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <GraduationCapIcon className="size-3.5" />
              {t("subject.examCount", { count: subject.upcomingExamCount })}
            </span>
          ) : null}

          {subject.gradeAverage !== null ? (
            <span
              className={cn(
                "ms-auto font-medium",
                subject.gradeAverage >= 85
                  ? "text-success"
                  : subject.gradeAverage >= 60
                    ? "text-warning"
                    : "text-destructive"
              )}
            >
              {t("subject.average", { value: subject.gradeAverage })}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}
