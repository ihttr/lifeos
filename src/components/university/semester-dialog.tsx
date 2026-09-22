"use client"

import { useTranslations } from "next-intl"
import { type FormEvent } from "react"

import { ResponsiveDialog } from "@/components/shared/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAction } from "@/hooks/use-action"
import { useFieldErrors } from "@/hooks/use-field-errors"
import { formDataToObject } from "@/lib/form"
import { createSemester, updateSemester } from "@/server/actions/university"

import type { SemesterDTO } from "@/server/queries/university"

export function SemesterDialog({
  open,
  onOpenChange,
  semester,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  semester: SemesterDTO | null
}) {
  const t = useTranslations()
  const { pending, run } = useAction()
  const { setErrors, error: fieldError, reset: resetErrors } = useFieldErrors()

  const isEdit = semester !== null
  const formId = "semester-form"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetErrors()

    const input = formDataToObject(new FormData(event.currentTarget))

    run(
      () =>
        isEdit
          ? updateSemester({ ...input, id: semester.id })
          : createSemester(input),
      {
        success: isEdit ? "semester.updated" : "semester.created",
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
      title={isEdit ? t("common.edit") : t("semester.new")}
      description={t("semester.hint")}
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
            <FieldLabel htmlFor="semester-name">{t("semester.name")}</FieldLabel>
            <Input
              id="semester-name"
              name="name"
              defaultValue={semester?.name ?? ""}
              placeholder={t("semester.namePlaceholder")}
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
              <FieldLabel htmlFor="semester-start">
                {t("project.startDate")}
              </FieldLabel>
              <Input
                id="semester-start"
                name="startDate"
                type="date"
                dir="ltr"
                defaultValue={semester?.startDate ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="semester-end">
                {t("semester.endDate")}
              </FieldLabel>
              <Input
                id="semester-end"
                name="endDate"
                type="date"
                dir="ltr"
                defaultValue={semester?.endDate ?? ""}
              />
            </Field>
          </div>
        </FieldGroup>
      </form>
    </ResponsiveDialog>
  )
}
