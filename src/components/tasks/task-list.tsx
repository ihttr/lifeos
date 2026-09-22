"use client"

import { useTranslations } from "next-intl"

import { TaskItem } from "@/components/tasks/task-item"

import type { TaskStatus } from "@/schemas/task"
import type { TaskDTO } from "@/server/queries/tasks"

const GROUP_ORDER: TaskStatus[] = ["IN_PROGRESS", "TODO", "DONE"]

export type TaskRowHandlers = {
  onToggleDone: (task: TaskDTO, done: boolean) => void
  onEdit: (task: TaskDTO) => void
  onDuplicate: (task: TaskDTO) => void
  onArchive: (task: TaskDTO) => void
  onDelete: (task: TaskDTO) => void
}

export function TaskList({
  tasks,
  handlers,
  selected,
  onSelect,
  disabled,
}: {
  tasks: TaskDTO[]
  handlers: TaskRowHandlers
  /** التحديد الجماعي اختياري — لا نعرضه في لوحة التحكم وصفحة المشروع */
  selected?: Set<string>
  onSelect?: (id: string, selected: boolean) => void
  disabled?: boolean
}) {
  const t = useTranslations("status")
  const selectionActive = (selected?.size ?? 0) > 0

  const groups = GROUP_ORDER.map((status) => ({
    status,
    items: tasks.filter((task) => task.status === status),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.status}>
          <h2 className="text-muted-foreground mb-1.5 px-1 text-xs font-medium tracking-wide uppercase">
            {t(group.status)}
            <span className="ms-1.5 font-normal">{group.items.length}</span>
          </h2>

          <ul className="divide-y rounded-xl border">
            {group.items.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                disabled={disabled}
                selected={selected?.has(task.id)}
                selectionActive={selectionActive}
                onSelect={
                  onSelect ? (value) => onSelect(task.id, value) : undefined
                }
                onToggleDone={(done) => handlers.onToggleDone(task, done)}
                onEdit={() => handlers.onEdit(task)}
                onDuplicate={() => handlers.onDuplicate(task)}
                onArchive={() => handlers.onArchive(task)}
                onDelete={() => handlers.onDelete(task)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
