"use client"

import { cn } from "cn"
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  MoreHorizontalIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ProgressBar } from "@/components/shared/progress-bar"
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
import { Input } from "@/components/ui/input"
import { useAction } from "@/hooks/use-action"
import { isOverdue, relativeDueLabel } from "@/lib/dates"
import {
  addGoalMilestone,
  deleteGoal,
  deleteGoalMilestone,
  setGoalStatus,
  toggleGoalMilestone,
} from "@/server/actions/goals"

import type { Locale } from "@/i18n/routing"
import type { GoalDTO } from "@/server/queries/goals"

const STATUS_CLASS: Record<GoalDTO["status"], string> = {
  ACTIVE: "border-info/40 text-info",
  COMPLETED: "border-success/40 text-success",
  PAUSED: "border-warning/40 text-warning",
}

export function GoalCard({
  goal,
  onEdit,
}: {
  goal: GoalDTO
  onEdit: () => void
}) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const { pending, run } = useAction()
  const [draft, setDraft] = useState("")

  const done = goal.status === "COMPLETED"
  const late = !done && goal.deadline !== null && isOverdue(goal.deadline)

  function addMilestone() {
    const title = draft.trim()
    if (!title) return
    setDraft("")
    run(() => addGoalMilestone({ goalId: goal.id, title }))
  }

  return (
    <article
      className={cn(
        "bg-card flex flex-col rounded-xl border p-4",
        done && "opacity-75"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            className={cn(
              "truncate font-medium",
              done && "text-muted-foreground line-through"
            )}
          >
            {goal.title}
          </h3>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge
              variant="outline"
              className={cn("font-normal", STATUS_CLASS[goal.status])}
            >
              {t(`goalStatus.${goal.status}`)}
            </Badge>

            {goal.category ? (
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px]">
                {goal.category}
              </span>
            ) : null}

            {goal.deadline ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  late ? "text-destructive font-medium" : "text-muted-foreground"
                )}
              >
                <CalendarClockIcon className="size-3.5" />
                {relativeDueLabel(goal.deadline, locale)}
              </span>
            ) : null}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 -me-1 shrink-0 rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            aria-label={t("common.more")}
          >
            <MoreHorizontalIcon className="size-4" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={onEdit}>
              <PencilIcon className="size-4" />
              {t("common.edit")}
            </DropdownMenuItem>

            {goal.status !== "COMPLETED" ? (
              <DropdownMenuItem
                disabled={pending}
                onSelect={() =>
                  run(() => setGoalStatus({ id: goal.id, status: "COMPLETED" }), {
                    success: "goal.completed",
                  })
                }
              >
                <CheckCircle2Icon className="size-4" />
                {t("goal.markComplete")}
              </DropdownMenuItem>
            ) : null}

            {goal.status === "ACTIVE" ? (
              <DropdownMenuItem
                disabled={pending}
                onSelect={() =>
                  run(() => setGoalStatus({ id: goal.id, status: "PAUSED" }))
                }
              >
                <PauseIcon className="size-4" />
                {t("goal.pause")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={pending}
                onSelect={() =>
                  run(() => setGoalStatus({ id: goal.id, status: "ACTIVE" }))
                }
              >
                <PlayIcon className="size-4" />
                {t("goal.resume")}
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <ConfirmDialog
              title={t("goal.deleteConfirmTitle")}
              description={t("goal.deleteConfirmBody")}
              onConfirm={() =>
                run(() => deleteGoal({ id: goal.id }), { success: "goal.deleted" })
              }
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

      {goal.description ? (
        <p className="text-muted-foreground mt-2.5 line-clamp-2 text-sm">
          {goal.description}
        </p>
      ) : null}

      <ProgressBar
        value={goal.progress}
        label={
          goal.milestones.length > 0
            ? t("goal.milestonesDone", {
                done: goal.doneCount,
                total: goal.milestones.length,
              })
            : t("common.progress")
        }
        className="mt-4"
      />

      {/* المراحل: قائمة تحقّق مباشرة داخل البطاقة — لا حاجة لفتح صفحة */}
      <ul className="mt-3 space-y-1">
        {goal.milestones.map((milestone) => (
          <li key={milestone.id} className="group flex items-center gap-2">
            <Checkbox
              checked={milestone.done}
              disabled={pending}
              aria-label={milestone.title}
              onCheckedChange={(value) =>
                run(() =>
                  toggleGoalMilestone({
                    id: milestone.id,
                    done: value === true,
                  })
                )
              }
            />
            <span
              className={cn(
                "flex-1 text-sm",
                milestone.done && "text-muted-foreground line-through"
              )}
            >
              {milestone.title}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 md:opacity-0 md:group-hover:opacity-100"
              disabled={pending}
              aria-label={t("common.delete")}
              onClick={() => run(() => deleteGoalMilestone({ id: milestone.id }))}
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addMilestone()
            }
          }}
          placeholder={t("goal.addMilestone")}
          autoComplete="off"
          className="h-8 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={addMilestone}
          disabled={pending || draft.trim() === ""}
          aria-label={t("goal.addMilestone")}
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
    </article>
  )
}
