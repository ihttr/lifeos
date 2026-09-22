"use client"

import { ListChecksIcon, PlusIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { MonthCalendar } from "@/components/shared/month-calendar"
import { PageHeader } from "@/components/shared/page-header"
import { TaskBoard } from "@/components/tasks/task-board"
import {
  TaskFormDialog,
  type TaskFormOptions,
} from "@/components/tasks/task-form-dialog"
import { TaskList } from "@/components/tasks/task-list"
import { TaskToolbar } from "@/components/tasks/task-toolbar"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAction } from "@/hooks/use-action"
import { useFilterParams } from "@/hooks/use-filter-params"
import { todayISO } from "@/lib/dates"
import {
  archiveTasks,
  bulkUpdateTasks,
  deleteTask,
  deleteTasks,
  duplicateTask,
  moveTask,
  toggleTask,
  unarchiveTasks,
} from "@/server/actions/tasks"

import type { TaskFilters, TaskStatus } from "@/schemas/task"
import type { TaskDTO } from "@/server/queries/tasks"

export function TasksView({
  tasks,
  filters,
  options,
}: {
  tasks: TaskDTO[]
  filters: TaskFilters
  options: TaskFormOptions
}) {
  const t = useTranslations()
  const { pending, run } = useAction()
  const { set } = useFilterParams()

  const [editing, setEditing] = useState<TaskDTO | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [defaults, setDefaults] = useState<{
    status?: TaskStatus
    dueDate?: string
  }>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // المهمة المفتوحة للتعديل قد تتغيّر بعد إعادة الجلب (مثلاً إضافة مهمة فرعية)
  useEffect(() => {
    if (!editing) return
    const fresh = tasks.find((task) => task.id === editing.id)
    if (fresh && fresh !== editing) setEditing(fresh)
    if (!fresh) setFormOpen(false)
  }, [tasks, editing])

  // اختصار N لمهمة جديدة
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey)
        return

      const target = event.target as HTMLElement | null
      const typing =
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      if (typing) return

      event.preventDefault()
      openCreate()
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const openCreate = useCallback(
    (nextDefaults: { status?: TaskStatus; dueDate?: string } = {}) => {
      setEditing(null)
      setDefaults(nextDefaults)
      setFormOpen(true)
    },
    []
  )

  function openEdit(task: TaskDTO) {
    setEditing(task)
    setDefaults({})
    setFormOpen(true)
  }

  function toggleSelect(id: string, value: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (value) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handlers = {
    onToggleDone: (task: TaskDTO, done: boolean) =>
      run(() => toggleTask({ id: task.id, done }), {
        success: done ? "task.completed" : "task.reopened",
      }),
    onEdit: openEdit,
    onDuplicate: (task: TaskDTO) => run(() => duplicateTask({ id: task.id })),
    onArchive: (task: TaskDTO) =>
      run(
        () =>
          task.archivedAt
            ? unarchiveTasks({ ids: [task.id] })
            : archiveTasks({ ids: [task.id] })
      ),
    onDelete: (task: TaskDTO) =>
      run(() => deleteTask({ id: task.id }), { success: "task.deleted" }),
  }

  const selectedIds = [...selected]

  function runBulk(action: () => Promise<unknown>, success?: string) {
    run(action as never, {
      success,
      onSuccess: () => setSelected(new Set()),
    })
  }

  const isEmpty = tasks.length === 0

  return (
    <>
      <PageHeader
        title={t("nav.tasks")}
        description={t("task.countLabel", { count: tasks.length })}
        actions={
          <Button
            onClick={() => openCreate()}
            className="hidden md:inline-flex"
          >
            <PlusIcon className="size-4" />
            {t("task.new")}
          </Button>
        }
      />

      <TaskToolbar filters={filters} options={options} />

      {isEmpty ? (
        <EmptyState
          Icon={ListChecksIcon}
          title={t("empty.tasksTitle")}
          description={t("empty.tasksBody")}
          action={
            <Button onClick={() => openCreate()}>
              <PlusIcon className="size-4" />
              {t("task.new")}
            </Button>
          }
        />
      ) : filters.view === "board" ? (
        <TaskBoard
          tasks={tasks}
          onOpen={openEdit}
          onCreate={(status) => openCreate({ status })}
          onMove={(id, status, order) =>
            run(() => moveTask({ id, status, order }))
          }
        />
      ) : filters.view === "calendar" ? (
        <MonthCalendar
          month={filters.month ?? todayISO().slice(0, 7)}
          onMonthChange={(month) => set({ month })}
          onDayClick={(date) => openCreate({ dueDate: date })}
          events={tasks
            .filter((task) => task.dueDate)
            .map((task) => ({
              id: task.id,
              date: task.dueDate as string,
              title: task.title,
              color: task.project?.color ?? undefined,
              muted: task.status === "DONE",
              onClick: () => openEdit(task),
            }))}
        />
      ) : (
        <TaskList
          tasks={tasks}
          handlers={handlers}
          selected={selected}
          onSelect={toggleSelect}
          disabled={pending}
        />
      )}

      {/* شريط الإجراءات الجماعية */}
      {selectedIds.length > 0 ? (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-6">
          <div className="bg-popover flex flex-wrap items-center gap-2 rounded-xl border p-2 shadow-lg">
            <span className="px-2 text-sm">
              {t("common.selected", { count: selectedIds.length })}
            </span>

            <Select
              onValueChange={(status) =>
                runBulk(() =>
                  bulkUpdateTasks({
                    ids: selectedIds,
                    status: status as TaskStatus,
                  })
                )
              }
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue placeholder={t("task.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODO">{t("status.TODO")}</SelectItem>
                <SelectItem value="IN_PROGRESS">
                  {t("status.IN_PROGRESS")}
                </SelectItem>
                <SelectItem value="DONE">{t("status.DONE")}</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                runBulk(() =>
                  filters.archived
                    ? unarchiveTasks({ ids: selectedIds })
                    : archiveTasks({ ids: selectedIds })
                )
              }
            >
              {filters.archived ? t("common.unarchive") : t("common.archive")}
            </Button>

            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() =>
                runBulk(() => deleteTasks({ ids: selectedIds }), "task.deleted")
              }
            >
              {t("common.delete")}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("common.clear")}
              onClick={() => setSelected(new Set())}
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* زر عائم للجوال */}
      <Button
        size="icon"
        onClick={() => openCreate()}
        aria-label={t("task.new")}
        className="fixed bottom-24 end-4 z-30 size-12 rounded-full shadow-lg md:hidden"
      >
        <PlusIcon className="size-5" />
      </Button>

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
        options={options}
        defaults={defaults}
      />
    </>
  )
}
