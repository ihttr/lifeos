"use client"

import { CheckCircle2Icon, PauseIcon, PlusIcon, TargetIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { StatCard } from "@/components/dashboard/stat-card"
import { GoalCard } from "@/components/goals/goal-card"
import { GoalFormDialog } from "@/components/goals/goal-form-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFilterParams } from "@/hooks/use-filter-params"

import type { GoalFilters, GoalStatus } from "@/schemas/goal"
import type { GoalDTO } from "@/server/queries/goals"

const STATUSES: GoalStatus[] = ["ACTIVE", "PAUSED", "COMPLETED"]

export function GoalsView({
  goals,
  categories,
  summary,
  filters,
}: {
  goals: GoalDTO[]
  categories: string[]
  summary: { active: number; completed: number; paused: number }
  filters: GoalFilters
}) {
  const t = useTranslations()
  const { set } = useFilterParams()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<GoalDTO | null>(null)

  function openGoal(goal: GoalDTO | null) {
    setEditing(goal)
    setFormOpen(true)
  }

  const hasFilters = Boolean(filters.status || filters.category)

  return (
    <>
      <PageHeader
        title={t("nav.goals")}
        description={t("goal.countLabel", { count: goals.length })}
        actions={
          <Button onClick={() => openGoal(null)} className="hidden md:inline-flex">
            <PlusIcon className="size-4" />
            {t("goal.new")}
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-2.5 pb-6">
        <StatCard
          Icon={TargetIcon}
          value={summary.active}
          label={t("goalStatus.ACTIVE")}
        />
        <StatCard
          Icon={CheckCircle2Icon}
          value={summary.completed}
          label={t("goalStatus.COMPLETED")}
          tone={summary.completed > 0 ? "success" : "default"}
        />
        <StatCard
          Icon={PauseIcon}
          value={summary.paused}
          label={t("goalStatus.PAUSED")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pb-5">
        <Select
          value={filters.status ?? "all"}
          onValueChange={(value) => set({ status: value })}
        >
          <SelectTrigger className="w-40" aria-label={t("task.status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("status.allStatuses")}</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`goalStatus.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {categories.length > 0 ? (
          <Select
            value={filters.category ?? "all"}
            onValueChange={(value) => set({ category: value })}
          >
            <SelectTrigger className="w-40" aria-label={t("note.category")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("goal.allCategories")}</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {goals.length === 0 ? (
        <EmptyState
          Icon={TargetIcon}
          title={hasFilters ? t("empty.searchTitle") : t("empty.goalsTitle")}
          description={hasFilters ? t("empty.searchBody") : t("empty.goalsBody")}
          action={
            hasFilters ? null : (
              <Button onClick={() => openGoal(null)}>
                <PlusIcon className="size-4" />
                {t("goal.new")}
              </Button>
            )
          }
        />
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onEdit={() => openGoal(goal)} />
          ))}
        </div>
      )}

      <Button
        size="icon"
        onClick={() => openGoal(null)}
        aria-label={t("goal.new")}
        className="fixed bottom-24 end-4 z-30 size-12 rounded-full shadow-lg md:hidden"
      >
        <PlusIcon className="size-5" />
      </Button>

      <GoalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        goal={editing}
        categories={categories}
      />
    </>
  )
}
