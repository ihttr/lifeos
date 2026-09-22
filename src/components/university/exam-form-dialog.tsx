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
import { todayISO } from "@/lib/dates"
import { formDataToObject } from "@/lib/form"
import { createExam, updateExam } from "@/server/actions/university"

import type { ExamDTO, SubjectDTO } from "@/server/queries/university"

export function ExamFormDialog({
  open,
  onOpenChange,
  exam,
  subjects,
  defaultSubjectId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exam: ExamDTO | null
  subjects: SubjectDTO[]
  defaultSubjectId?: string
}) {
  const t = useTranslations()
  const { pending, run } = useAction()
  const { setErrors, error: fieldError, reset: resetErrors } = useFieldErrors()

  const isEdit = exam !== null
  const formId = "exam-form"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetErrors()

    const input = formDataToObject(new FormData(event.currentTarget))

    run(() => (isEdit ? updateExam({ ...input, id: exam.id }) : createExam(input)), {
      success: isEdit ? "exam.updated" : "exam.created",
      silentValidation: true,
      onSuccess: () => onOpenChange(false),
      onError: (_error, fieldErrors) => setErrors(fieldErrors ?? {}),
    })
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t("common.edit") : t("exam.new")}
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
            <FieldLabel htmlFor="exam-title">{t("exam.title")}</FieldLabel>
            <Input
              id="exam-title"
              name="title"
              defaultValue={exam?.title ?? ""}
              placeholder={t("exam.titlePlaceholder")}
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
            <FieldLabel htmlFor="exam-subject">{t("task.subject")}</FieldLabel>
            <Select
              name="subjectId"
              defaultValue={exam?.subjectId ?? defaultSubjectId ?? subjects[0]?.id}
              required
            >
              <SelectTrigger id="exam-subject" className="w-full">
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
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={fieldError("date") ? true : undefined}>
              <FieldLabel htmlFor="exam-date">{t("exam.date")}</FieldLabel>
              <Input
                id="exam-date"
                name="date"
                type="date"
                dir="ltr"
                required
                defaultValue={exam?.date ?? todayISO()}
                aria-invalid={fieldError("date") ? true : undefined}
              />
              {fieldError("date") ? (
                <FieldError>{fieldError("date")}</FieldError>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="exam-time">{t("task.dueTime")}</FieldLabel>
              <Input
                id="exam-time"
                name="time"
                type="time"
                dir="ltr"
                defaultValue={exam?.time ?? "08:00"}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="exam-location">
                {t("exam.location")}
              </FieldLabel>
              <Input
                id="exam-location"
                name="location"
                autoComplete="off"
                defaultValue={exam?.location ?? ""}
              />
            </Field>

            <Field data-invalid={fieldError("weight") ? true : undefined}>
              <FieldLabel htmlFor="exam-weight">{t("exam.weight")}</FieldLabel>
              <Input
                id="exam-weight"
                name="weight"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                dir="ltr"
                defaultValue={exam?.weight ?? ""}
                aria-invalid={fieldError("weight") ? true : undefined}
              />
              <FieldDescription>{t("exam.weightHint")}</FieldDescription>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="exam-notes">{t("task.notes")}</FieldLabel>
            <Textarea
              id="exam-notes"
              name="notes"
              rows={3}
              defaultValue={exam?.notes ?? ""}
            />
          </Field>
        </FieldGroup>
      </form>
    </ResponsiveDialog>
  )
}
