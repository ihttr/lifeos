"use client"

import { useTranslations } from "next-intl"
import { useState, type FormEvent } from "react"

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
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAction } from "@/hooks/use-action"
import { useFieldErrors } from "@/hooks/use-field-errors"
import { todayISO } from "@/lib/dates"
import { formDataToObject } from "@/lib/form"
import {
  createTransaction,
  updateTransaction,
} from "@/server/actions/finance"

import type { TransactionType } from "@/schemas/finance"
import type { TransactionDTO } from "@/server/queries/finance"

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: TransactionDTO | null
  categories: { income: string[]; expense: string[] }
}) {
  const t = useTranslations()
  const { pending, run } = useAction()
  const { setErrors, error: fieldError, reset: resetErrors } = useFieldErrors()
  const [type, setType] = useState<TransactionType>(
    transaction?.type ?? "EXPENSE"
  )

  const isEdit = transaction !== null
  const formId = "transaction-form"
  const suggestions = type === "INCOME" ? categories.income : categories.expense

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetErrors()

    const input = {
      ...formDataToObject(new FormData(event.currentTarget)),
      type,
    }

    run(
      () =>
        isEdit
          ? updateTransaction({ ...input, id: transaction.id })
          : createTransaction(input),
      {
        success: isEdit ? "finance.updated" : "finance.created",
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
      title={isEdit ? t("common.edit") : t("finance.new")}
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
          <Field>
            <FieldLabel>{t("finance.type")}</FieldLabel>
            <ToggleGroup
              type="single"
              value={type}
              onValueChange={(value) => value && setType(value as TransactionType)}
              variant="outline"
              className="w-full"
            >
              <ToggleGroupItem value="EXPENSE" className="flex-1">
                {t("finance.expense")}
              </ToggleGroupItem>
              <ToggleGroupItem value="INCOME" className="flex-1">
                {t("finance.income")}
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <Field data-invalid={fieldError("amount") ? true : undefined}>
            <FieldLabel htmlFor="amount">{t("finance.amount")}</FieldLabel>
            <Input
              id="amount"
              name="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              dir="ltr"
              autoFocus
              required
              defaultValue={transaction?.amount ?? ""}
              aria-invalid={fieldError("amount") ? true : undefined}
            />
            {fieldError("amount") ? (
              <FieldError>{fieldError("amount")}</FieldError>
            ) : (
              <FieldDescription>{t("finance.amountHint")}</FieldDescription>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={fieldError("category") ? true : undefined}>
              <FieldLabel htmlFor="category">{t("finance.category")}</FieldLabel>
              <Input
                id="category"
                name="category"
                list="finance-categories"
                autoComplete="off"
                required
                defaultValue={transaction?.category ?? ""}
                aria-invalid={fieldError("category") ? true : undefined}
              />
              <datalist id="finance-categories">
                {suggestions.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
              {fieldError("category") ? (
                <FieldError>{fieldError("category")}</FieldError>
              ) : null}
            </Field>

            <Field data-invalid={fieldError("date") ? true : undefined}>
              <FieldLabel htmlFor="date">{t("exam.date")}</FieldLabel>
              <Input
                id="date"
                name="date"
                type="date"
                dir="ltr"
                required
                defaultValue={transaction?.date ?? todayISO()}
                aria-invalid={fieldError("date") ? true : undefined}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="description">{t("task.description")}</FieldLabel>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={transaction?.description ?? ""}
            />
          </Field>
        </FieldGroup>
      </form>
    </ResponsiveDialog>
  )
}
