"use client"

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "cn"
import { ListTreeIcon, PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import {
  DueBadge,
  PriorityDot,
  RecurrenceBadge,
  TagChips,
} from "@/components/tasks/task-badges"
import { Button } from "@/components/ui/button"

import type { TaskStatus } from "@/schemas/task"
import type { TaskDTO } from "@/server/queries/tasks"

const COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"]

type Board = Record<TaskStatus, TaskDTO[]>

function groupTasks(tasks: TaskDTO[]): Board {
  return {
    TODO: tasks.filter((task) => task.status === "TODO"),
    IN_PROGRESS: tasks.filter((task) => task.status === "IN_PROGRESS"),
    DONE: tasks.filter((task) => task.status === "DONE"),
  }
}

export function TaskBoard({
  tasks,
  onMove,
  onOpen,
  onCreate,
}: {
  tasks: TaskDTO[]
  onMove: (id: string, status: TaskStatus, order: string[]) => void
  onOpen: (task: TaskDTO) => void
  onCreate: (status: TaskStatus) => void
}) {
  const t = useTranslations()
  const [board, setBoard] = useState<Board>(() => groupTasks(tasks))
  const [activeId, setActiveId] = useState<string | null>(null)

  // البيانات القادمة من الخادم هي مصدر الحقيقة بعد كل تحديث
  useEffect(() => setBoard(groupTasks(tasks)), [tasks])

  const sensors = useSensors(
    // مسافة تفعيل صغيرة حتى تبقى النقرة نقرة والسحب سحباً
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const activeTask = activeId
    ? Object.values(board).flat().find((task) => task.id === activeId)
    : null

  function columnOf(id: string): TaskStatus | null {
    if (COLUMNS.includes(id as TaskStatus)) return id as TaskStatus
    return (
      COLUMNS.find((column) => board[column].some((task) => task.id === id)) ??
      null
    )
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const from = columnOf(String(active.id))
    const to = columnOf(String(over.id))
    if (!from || !to || from === to) return

    setBoard((current) => {
      const moving = current[from].find((task) => task.id === active.id)
      if (!moving) return current

      const overIndex = current[to].findIndex((task) => task.id === over.id)
      const insertAt = overIndex >= 0 ? overIndex : current[to].length

      const target = [...current[to]]
      target.splice(insertAt, 0, { ...moving, status: to })

      return {
        ...current,
        [from]: current[from].filter((task) => task.id !== active.id),
        [to]: target,
      }
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const column = columnOf(String(active.id))
    if (!column) return

    const items = board[column]
    const oldIndex = items.findIndex((task) => task.id === active.id)
    const newIndex = items.findIndex((task) => task.id === over.id)

    const ordered =
      oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex
        ? arrayMove(items, oldIndex, newIndex)
        : items

    if (ordered !== items) {
      setBoard((current) => ({ ...current, [column]: ordered }))
    }

    onMove(
      String(active.id),
      column,
      ordered.map((task) => task.id)
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {/* تمرير أفقي على الجوال، ثلاثة أعمدة على سطح المكتب */}
      <div
        data-testid="task-board"
        className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 md:grid md:grid-cols-3"
      >
        {COLUMNS.map((column) => (
          <Column
            key={column}
            status={column}
            tasks={board[column]}
            onOpen={onOpen}
            onCreate={() => onCreate(column)}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <Card task={activeTask} onOpen={() => {}} dragging />
        ) : null}
      </DragOverlay>

      <p className="sr-only" aria-live="polite">
        {activeTask ? t("task.dragHint", { title: activeTask.title }) : ""}
      </p>
    </DndContext>
  )
}

// ------------------------------------------------------------------

function Column({
  status,
  tasks,
  onOpen,
  onCreate,
}: {
  status: TaskStatus
  tasks: TaskDTO[]
  onOpen: (task: TaskDTO) => void
  onCreate: () => void
}) {
  const t = useTranslations()
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <section
      className={cn(
        "bg-muted/40 flex w-[82vw] shrink-0 flex-col rounded-xl border p-2 transition-colors sm:w-72 md:w-auto",
        isOver && "border-ring bg-accent/50"
      )}
    >
      <header className="flex items-center justify-between px-1.5 py-1">
        <h2 className="text-sm font-medium">
          {t(`status.${status}`)}
          <span className="text-muted-foreground ms-1.5 font-normal">
            {tasks.length}
          </span>
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onCreate}
          aria-label={t("task.new")}
        >
          <PlusIcon className="size-4" />
        </Button>
      </header>

      <div ref={setNodeRef} className="min-h-24 flex-1 space-y-2 p-0.5">
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} onOpen={onOpen} />
          ))}
        </SortableContext>

        {tasks.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-xs">
            {t("task.emptyColumn")}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function SortableCard({
  task,
  onOpen,
}: {
  task: TaskDTO
  onOpen: (task: TaskDTO) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "opacity-40" : undefined}
      {...attributes}
      {...listeners}
    >
      <Card task={task} onOpen={() => onOpen(task)} />
    </div>
  )
}

function Card({
  task,
  onOpen,
  dragging,
}: {
  task: TaskDTO
  onOpen: () => void
  dragging?: boolean
}) {
  const done = task.status === "DONE"
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.done).length

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={task.title}
      className={cn(
        "bg-card w-full rounded-lg border p-2.5 text-start shadow-xs transition-shadow",
        "hover:shadow-sm focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
        dragging && "rotate-1 cursor-grabbing shadow-lg"
      )}
    >
      <span
        className={cn(
          "block text-sm leading-snug",
          done && "text-muted-foreground line-through"
        )}
      >
        {task.title}
      </span>

      <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <PriorityDot priority={task.priority} />

        {task.dueDate ? (
          <DueBadge dueDate={task.dueDate} dueTime={task.dueTime} done={done} />
        ) : null}

        <RecurrenceBadge recurrence={task.recurrence} />

        {task.subtasks.length > 0 ? (
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
            <ListTreeIcon className="size-3.5" />
            {doneSubtasks}/{task.subtasks.length}
          </span>
        ) : null}
      </span>

      {task.project || task.tags.length > 0 ? (
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {task.project ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <span
                className="size-1.5 rounded-full"
                style={{
                  background: task.project.color ?? "var(--muted-foreground)",
                }}
              />
              {task.project.name}
            </span>
          ) : null}
          <TagChips tags={task.tags} max={2} />
        </span>
      ) : null}
    </button>
  )
}
