"use client"

import { useTranslations } from "next-intl"
import { type FormEvent } from "react"

import { ResponsiveDialog } from "@/components/shared/responsive-dialog"
import { Button } from "@/components/ui/button"
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
import { todayISO } from "@/lib/dates"
import { createAssignment, updateAssignment } from "@/server/actions/university"

import type { WorkStatus } from "@/schemas/university"
import type { AssignmentDTO, SubjectDTO } from "@/server/queries/university"

const STATUSES: WorkStatus[] = ["TODO", "IN_PROGRESS", "DONE"]

export function AssignmentFormDialog({
  open,
  onOpenChange,
  assignment,
  subjects,
  defaultSubjectId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignment: AssignmentDTO | null
  subjects: SubjectDTO[]
  defaultSubjectId?: string
}) {
  const t = useTranslations()
  const { pending, run } = useAction()
  const { setErrors, error: fieldError, reset: resetErrors } = useFieldErrors()

  const isEdit = assignment !== null
  const formId = "assignment-form"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetErrors()

    const input = formDataToObject(new FormData(event.currentTarget))

    run(
      () =>
        isEdit
          ? updateAssignment({ ...input, id: assignment.id })
          : createAssignment(input),
      {
        success: isEdit ? "assignment.updated" : "assignment.created",
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
      title={isEdit ? t("common.edit") : t("assignment.new")}
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
      <form id={formId} onSubmit={handleSubmit} noValidate className="pb-2">
        <FieldGroup>
          <Field data-invalid={fieldError("title") ? true : undefined}>
            <FieldLabel htmlFor="assignment-title">
              {t("assignment.title")}
            </FieldLabel>
            <Input
              id="assignment-title"
              name="title"
              defaultValue={assignment?.title ?? ""}
              autoComplete="off"
              autoFocus
              required
              aria-invalid={fieldError("title") ? true : undefined}
            />
            {fieldError("title") ? (
              <FieldError>{fieldError("title")}</FieldError>
            ) : null}
          </Field>

          <Field data-invalid={fieldError("subjectId") ? true : undefined}>
            <FieldLabel htmlFor="assignment-subject">
              {t("task.subject")}
            </FieldLabel>
            <Select
              name="subjectId"
              defaultValue={
                assignment?.subjectId ?? defaultSubjectId ?? subjects[0]?.id
              }
              required
            >
              <SelectTrigger id="assignment-subject" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError("subjectId") ? (
              <FieldError>{fieldError("subjectId")}</FieldError>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="assignment-description">
              {t("task.description")}
            </FieldLabel>
            <Textarea
              id="assignment-description"
              name="description"
              rows={2}
              defaultValue={assignment?.description ?? ""}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={fieldError("dueDate") ? true : undefined}>
              <FieldLabel htmlFor="assignment-due">
                {t("task.dueDate")}
              </FieldLabel>
              <Input
                id="assignment-due"
                name="dueDate"
                type="date"
                dir="ltr"
                required
                defaultValue={assignment?.dueDate ?? todayISO()}
                aria-invalid={fieldError("dueDate") ? true : undefined}
              />
              {fieldError("dueDate") ? (
                <FieldError>{fieldError("dueDate")}</FieldError>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="assignment-time">
                {t("task.dueTime")}
              </FieldLabel>
              <Input
                id="assignment-time"
                name="dueTime"
                type="time"
                dir="ltr"
                defaultValue={assignment?.dueTime ?? "23:59"}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="assignment-status">
              {t("task.status")}
            </FieldLabel>
            <Select name="status" defaultValue={assignment?.status ?? "TODO"}>
              <SelectTrigger id="assignment-status" className="w-full">
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

          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={fieldError("grade") ? true : undefined}>
              <FieldLabel htmlFor="assignment-grade">
                {t("assignment.grade")}
              </FieldLabel>
              <Input
                id="assignment-grade"
                name="grade"
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0}
                dir="ltr"
                defaultValue={assignment?.grade ?? ""}
                aria-invalid={fieldError("grade") ? true : undefined}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="assignment-max">
                {t("assignment.maxGrade")}
              </FieldLabel>
              <Input
                id="assignment-max"
                name="maxGrade"
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0}
                dir="ltr"
                defaultValue={assignment?.maxGrade ?? ""}
              />
            </Field>
          </div>
          <FieldDescription>{t("assignment.gradeHint")}</FieldDescription>
        </FieldGroup>
      </form>
    </ResponsiveDialog>
  )
}
