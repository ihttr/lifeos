"use client"

import { useTranslations } from "next-intl"
import { type FormEvent } from "react"

import { ResponsiveDialog } from "@/components/shared/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
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
import { createGoal, updateGoal } from "@/server/actions/goals"

import type { GoalStatus } from "@/schemas/goal"
import type { GoalDTO } from "@/server/queries/goals"

const STATUSES: GoalStatus[] = ["ACTIVE", "PAUSED", "COMPLETED"]

export function GoalFormDialog({
  open,
  onOpenChange,
  goal,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: GoalDTO | null
  categories: string[]
}) {
  const t = useTranslations()
  const { pending, run } = useAction()
  const { setErrors, error: fieldError, reset: resetErrors } = useFieldErrors()

  const isEdit = goal !== null
  const formId = "goal-form"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetErrors()

    const input = formDataToObject(new FormData(event.currentTarget))

    run(() => (isEdit ? updateGoal({ ...input, id: goal.id }) : createGoal(input)), {
      success: isEdit ? "goal.updated" : "goal.created",
      silentValidation: true,
      onSuccess: () => onOpenChange(false),
      onError: (_error, fieldErrors) => setErrors(fieldErrors ?? {}),
    })
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t("common.edit") : t("goal.new")}
      description={isEdit ? undefined : t("goal.hint")}
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
            <FieldLabel htmlFor="goal-title">{t("goal.title")}</FieldLabel>
            <Input
              id="goal-title"
              name="title"
              defaultValue={goal?.title ?? ""}
              placeholder={t("goal.titlePlaceholder")}
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
            <FieldLabel htmlFor="goal-description">
              {t("task.description")}
            </FieldLabel>
            <Textarea
              id="goal-description"
              name="description"
              rows={2}
              defaultValue={goal?.description ?? ""}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="goal-category">{t("note.category")}</FieldLabel>
              <Input
                id="goal-category"
                name="category"
                list="goal-categories"
                autoComplete="off"
                defaultValue={goal?.category ?? ""}
              />
              <datalist id="goal-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </Field>

            <Field>
              <FieldLabel htmlFor="goal-deadline">
                {t("project.deadline")}
              </FieldLabel>
              <Input
                id="goal-deadline"
                name="deadline"
                type="date"
                dir="ltr"
                defaultValue={goal?.deadline ?? ""}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="goal-status">{t("task.status")}</FieldLabel>
            <Select name="status" defaultValue={goal?.status ?? "ACTIVE"}>
              <SelectTrigger id="goal-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`goalStatus.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </form>
    </ResponsiveDialog>
  )
}
