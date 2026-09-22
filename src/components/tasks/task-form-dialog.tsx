"use client"

import { PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef, useState, type FormEvent } from "react"

import { ResponsiveDialog } from "@/components/shared/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAction } from "@/hooks/use-action"
import { useFieldErrors } from "@/hooks/use-field-errors"
import { formDataToObject } from "@/lib/form"
import {
  addSubtask,
  createTask,
  deleteSubtask,
  toggleSubtask,
  updateTask,
} from "@/server/actions/tasks"

import type { TaskPriority, TaskRecurrence, TaskStatus } from "@/schemas/task"
import type { TaskDTO } from "@/server/queries/tasks"

export type TaskFormOptions = {
  projects: { id: string; name: string; color: string | null }[]
  subjects: { id: string; name: string; color: string | null }[]
  tags: { id: string; name: string; color: string | null }[]
}

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"]
const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"]
const RECURRENCES: TaskRecurrence[] = ["NONE", "DAILY", "WEEKLY", "MONTHLY"]

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  options,
  defaults,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = إنشاء جديد */
  task: TaskDTO | null
  options: TaskFormOptions
  defaults?: { status?: TaskStatus; dueDate?: string; projectId?: string }
}) {
  const t = useTranslations()
  const { pending, run } = useAction()
  const { setErrors, error: fieldError, reset: resetErrors } = useFieldErrors()
  const formRef = useRef<HTMLFormElement>(null)

  const isEdit = task !== null
  const formId = "task-form"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetErrors()

    const input = formDataToObject(new FormData(event.currentTarget))

    run(
      () => (isEdit ? updateTask({ ...input, id: task.id }) : createTask(input)),
      {
        success: isEdit ? "task.updated" : "task.created",
        silentValidation: true,
        onSuccess: () => onOpenChange(false),
        onError: (_error, fieldErrors) => setErrors(fieldErrors ?? {}),
      }
    )
  }


  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t("common.edit") : t("task.new")}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending
              ? t("common.saving")
              : isEdit
                ? t("common.save")
                : t("common.create")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="pb-2"
      >
        <FieldGroup>
          <Field data-invalid={fieldError("title") ? true : undefined}>
            <FieldLabel htmlFor="title">{t("task.title")}</FieldLabel>
            <Input
              id="title"
              name="title"
              defaultValue={task?.title ?? ""}
              placeholder={t("task.titlePlaceholder")}
              autoComplete="off"
              autoFocus
              required
              aria-invalid={fieldError("title") ? true : undefined}
            />
            {fieldError("title") ? (
              <FieldError>{fieldError("title")}</FieldError>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="description">
              {t("task.description")}
            </FieldLabel>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={task?.description ?? ""}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="status">{t("task.status")}</FieldLabel>
              <Select
                name="status"
                defaultValue={task?.status ?? defaults?.status ?? "TODO"}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`status.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="priority">{t("task.priority")}</FieldLabel>
              <Select name="priority" defaultValue={task?.priority ?? "MEDIUM"}>
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`priority.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="dueDate">{t("task.dueDate")}</FieldLabel>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                dir="ltr"
                defaultValue={task?.dueDate ?? defaults?.dueDate ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="dueTime">{t("task.dueTime")}</FieldLabel>
              <Input
                id="dueTime"
                name="dueTime"
                type="time"
                dir="ltr"
                defaultValue={task?.dueTime ?? ""}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="projectId">{t("task.project")}</FieldLabel>
              <Select
                name="projectId"
                defaultValue={task?.projectId ?? defaults?.projectId ?? "none"}
              >
                <SelectTrigger id="projectId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common.none")}</SelectItem>
                  {options.projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="subjectId">{t("task.subject")}</FieldLabel>
              <Select name="subjectId" defaultValue={task?.subjectId ?? "none"}>
                <SelectTrigger id="subjectId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common.none")}</SelectItem>
                  {options.subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="recurrence">
                {t("task.recurrence")}
              </FieldLabel>
              <Select
                name="recurrence"
                defaultValue={task?.recurrence ?? "NONE"}
              >
                <SelectTrigger id="recurrence" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`recurrence.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="category">{t("task.category")}</FieldLabel>
              <Input
                id="category"
                name="category"
                defaultValue={task?.category ?? ""}
                autoComplete="off"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="tags">{t("task.tags")}</FieldLabel>
            <Input
              id="tags"
              name="tags"
              list="tag-suggestions"
              autoComplete="off"
              defaultValue={task?.tags.map((tag) => tag.name).join("، ") ?? ""}
            />
            <datalist id="tag-suggestions">
              {options.tags.map((tag) => (
                <option key={tag.id} value={tag.name} />
              ))}
            </datalist>
            <FieldDescription>{t("task.tagsHint")}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="notes">{t("task.notes")}</FieldLabel>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={task?.notes ?? ""}
            />
          </Field>
        </FieldGroup>
      </form>

      {isEdit ? <SubtaskEditor task={task} /> : null}
    </ResponsiveDialog>
  )
}

// ------------------------------------------------------------------

function SubtaskEditor({ task }: { task: TaskDTO }) {
  const t = useTranslations()
  const { pending, run } = useAction()
  const [draft, setDraft] = useState("")

  const done = task.subtasks.filter((s) => s.done).length

  function add() {
    const title = draft.trim()
    if (!title) return
    setDraft("")
    run(() => addSubtask({ taskId: task.id, title }))
  }

  return (
    <div className="mt-2 border-t pt-4 pb-2">
      <p className="mb-2 text-sm font-medium">
        {t("task.subtasks")}{" "}
        {task.subtasks.length > 0 ? (
          <span className="text-muted-foreground font-normal">
            {done}/{task.subtasks.length}
          </span>
        ) : null}
      </p>

      <ul className="mb-2 space-y-1">
        {task.subtasks.map((subtask) => (
          <li key={subtask.id} className="flex items-center gap-2">
            <Checkbox
              checked={subtask.done}
              disabled={pending}
              onCheckedChange={(value) =>
                run(() => toggleSubtask({ id: subtask.id, done: value === true }))
              }
              aria-label={subtask.title}
            />
            <span
              className={
                subtask.done
                  ? "text-muted-foreground flex-1 text-sm line-through"
                  : "flex-1 text-sm"
              }
            >
              {subtask.title}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={t("common.delete")}
              disabled={pending}
              onClick={() => run(() => deleteSubtask({ id: subtask.id }))}
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              add()
            }
          }}
          placeholder={t("task.addSubtask")}
          autoComplete="off"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={add}
          disabled={pending || draft.trim() === ""}
          aria-label={t("task.addSubtask")}
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
