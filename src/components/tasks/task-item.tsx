"use client"

import { cn } from "cn"
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CopyIcon,
  ListTreeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SquareCheckIcon,
  Trash2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  DueBadge,
  PriorityDot,
  RecurrenceBadge,
  TagChips,
} from "@/components/tasks/task-badges"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type { TaskDTO } from "@/server/queries/tasks"

export function TaskItem({
  task,
  selected,
  selectionActive,
  onToggleDone,
  onSelect,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
  disabled,
}: {
  task: TaskDTO
  selected?: boolean
  /** هناك صف محدد بالفعل — نُظهر مربعات التحديد في كل الصفوف */
  selectionActive?: boolean
  onToggleDone: (done: boolean) => void
  onSelect?: (selected: boolean) => void
  onEdit: () => void
  onDuplicate: () => void
  onArchive: () => void
  onDelete: () => void
  disabled?: boolean
}) {
  const t = useTranslations()
  const done = task.status === "DONE"
  const doneSubtasks = task.subtasks.filter((s) => s.done).length
  const showSelect = Boolean(selected || selectionActive)

  return (
    <li
      className={cn(
        "group hover:bg-accent/40 relative flex items-start gap-3 px-3 py-2.5 transition-colors",
        selected && "bg-accent/60"
      )}
    >
      {onSelect ? (
        <Checkbox
          checked={selected}
          onCheckedChange={(value) => onSelect(value === true)}
          aria-label={t("common.select")}
          className={cn(
            "mt-1 transition-opacity",
            // مربع التحديد يظهر عند التمرير على سطح المكتب،
            // وعلى الجوال فقط بعد بدء التحديد من قائمة "المزيد"
            !showSelect &&
              "max-md:hidden opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          )}
        />
      ) : null}

      <Checkbox
        checked={done}
        disabled={disabled}
        onCheckedChange={(value) => onToggleDone(value === true)}
        aria-label={task.title}
        className="mt-1"
      />

      <button
        type="button"
        onClick={onEdit}
        aria-label={task.title}
        className="min-w-0 flex-1 text-start"
      >
        <span
          className={cn(
            "block text-sm leading-snug",
            done && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <PriorityDot priority={task.priority} />

          {task.dueDate ? (
            <DueBadge
              dueDate={task.dueDate}
              dueTime={task.dueTime}
              done={done}
            />
          ) : null}

          <RecurrenceBadge recurrence={task.recurrence} />

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

          {task.subject ? (
            <span className="text-muted-foreground text-xs">
              {task.subject.name}
            </span>
          ) : null}

          {task.subtasks.length > 0 ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <ListTreeIcon className="size-3.5" />
              {doneSubtasks}/{task.subtasks.length}
            </span>
          ) : null}

          <TagChips tags={task.tags} />
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "text-muted-foreground hover:bg-accent hover:text-foreground",
            "focus-visible:ring-ring/50 rounded-md p-1.5 transition-colors",
            "focus-visible:ring-2 focus-visible:outline-none",
            // يظهر دائماً على الجوال، وعند التمرير على سطح المكتب
            "md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
            "data-[state=open]:opacity-100"
          )}
          aria-label={t("common.more")}
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onEdit}>
            <PencilIcon className="size-4" />
            {t("common.edit")}
          </DropdownMenuItem>
          {onSelect && !selected ? (
            <DropdownMenuItem
              className="md:hidden"
              onSelect={() => onSelect(true)}
            >
              <SquareCheckIcon className="size-4" />
              {t("common.select")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={onDuplicate}>
            <CopyIcon className="size-4" />
            {t("common.duplicate")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onArchive}>
            {task.archivedAt ? (
              <>
                <ArchiveRestoreIcon className="size-4" />
                {t("common.unarchive")}
              </>
            ) : (
              <>
                <ArchiveIcon className="size-4" />
                {t("common.archive")}
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <ConfirmDialog
            title={t("task.deleteConfirmTitle")}
            description={t("task.deleteConfirmBody")}
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
    </li>
  )
}
