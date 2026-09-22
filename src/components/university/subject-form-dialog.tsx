"use client"

import { useTranslations } from "next-intl"
import { useState, type FormEvent } from "react"

import { ResponsiveDialog } from "@/components/shared/responsive-dialog"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAction } from "@/hooks/use-action"
import { useFieldErrors } from "@/hooks/use-field-errors"
import { formDataToObject } from "@/lib/form"
import { createSubject, updateSubject } from "@/server/actions/university"

import type { SubjectDTO } from "@/server/queries/university"

/** ألوان تكفي لتمييز ست مواد في الفصل الواحد */
const COLORS = [
  "oklch(0.6 0.16 265)",
  "oklch(0.63 0.13 195)",
  "oklch(0.62 0.15 148)",
  "oklch(0.7 0.16 75)",
  "oklch(0.6 0.2 340)",
  "oklch(0.6 0.2 25)",
]

export function SubjectFormDialog({
  open,
  onOpenChange,
  subject,
  semesterId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subject: SubjectDTO | null
  semesterId: string
}) {
  const t = useTranslations()
  const { pending, run } = useAction()
  const { setErrors, error: fieldError, reset: resetErrors } = useFieldErrors()
  const [color, setColor] = useState(subject?.color ?? COLORS[0])

  const isEdit = subject !== null
  const formId = "subject-form"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetErrors()

    const input = {
      ...formDataToObject(new FormData(event.currentTarget)),
      semesterId,
      color,
    }

    run(
      () =>
        isEdit
          ? updateSubject({ ...input, id: subject.id })
          : createSubject(input),
      {
        success: isEdit ? "subject.updated" : "subject.created",
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
      title={isEdit ? t("common.edit") : t("subject.new")}
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
          <Field data-invalid={fieldError("name") ? true : undefined}>
            <FieldLabel htmlFor="subject-name">{t("subject.name")}</FieldLabel>
            <Input
              id="subject-name"
              name="name"
              defaultValue={subject?.name ?? ""}
              autoComplete="off"
              autoFocus
              required
              aria-invalid={fieldError("name") ? true : undefined}
            />
            {fieldError("name") ? (
              <FieldError>{fieldError("name")}</FieldError>
            ) : null}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="subject-code">{t("subject.code")}</FieldLabel>
              <Input
                id="subject-code"
                name="code"
                dir="ltr"
                placeholder="CS461"
                autoComplete="off"
                defaultValue={subject?.code ?? ""}
              />
            </Field>

            <Field data-invalid={fieldError("credits") ? true : undefined}>
              <FieldLabel htmlFor="subject-credits">
                {t("subject.credits")}
              </FieldLabel>
              <Input
                id="subject-credits"
                name="credits"
                type="number"
                inputMode="numeric"
                min={0}
                max={12}
                dir="ltr"
                defaultValue={subject?.credits ?? 3}
                aria-invalid={fieldError("credits") ? true : undefined}
              />
              {fieldError("credits") ? (
                <FieldError>{fieldError("credits")}</FieldError>
              ) : null}
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="subject-instructor">
              {t("subject.instructor")}
            </FieldLabel>
            <Input
              id="subject-instructor"
              name="instructor"
              autoComplete="off"
              defaultValue={subject?.instructor ?? ""}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="subject-notes">{t("task.notes")}</FieldLabel>
            <Textarea
              id="subject-notes"
              name="notes"
              rows={3}
              defaultValue={subject?.notes ?? ""}
            />
          </Field>

          <Field>
            <FieldLabel>{t("project.color")}</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setColor(value)}
                  aria-label={value}
                  aria-pressed={color === value}
                  className="ring-offset-background focus-visible:ring-ring size-7 rounded-full transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none aria-pressed:scale-110 aria-pressed:ring-2 aria-pressed:ring-offset-2"
                  style={{ background: value }}
                />
              ))}
            </div>
          </Field>
        </FieldGroup>
      </form>
    </ResponsiveDialog>
  )
}
