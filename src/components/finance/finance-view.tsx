"use client"

import { cn } from "cn"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  ScaleIcon,
  Trash2Icon,
  WalletIcon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { CategoryChart } from "@/components/finance/category-chart"
import { MonthlyChart } from "@/components/finance/monthly-chart"
import { TransactionFormDialog } from "@/components/finance/transaction-form-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAction } from "@/hooks/use-action"
import { useFilterParams } from "@/hooks/use-filter-params"
import { addMonthsISO, formatDateShort, formatMonthYear, todayISO } from "@/lib/dates"
import { formatCurrency } from "@/lib/format"
import { deleteTransaction } from "@/server/actions/finance"

import type { Locale } from "@/i18n/routing"
import type { FinanceFilters } from "@/schemas/finance"
import type { FinanceData, TransactionDTO } from "@/server/queries/finance"

export function FinanceView({
  data,
  filters,
}: {
  data: FinanceData
  filters: FinanceFilters
}) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const { set } = useFilterParams()
  const { pending, run } = useAction()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TransactionDTO | null>(null)

  const anchor = `${data.month}-01`
  const isCurrentMonth = data.month === todayISO().slice(0, 7)

  function open(transaction: TransactionDTO | null) {
    setEditing(transaction)
    setFormOpen(true)
  }

  const positive = data.summary.balance >= 0

  return (
    <>
      <PageHeader
        title={t("nav.finance")}
        description={t("finance.subtitle")}
        actions={
          <Button onClick={() => open(null)} className="hidden md:inline-flex">
            <PlusIcon className="size-4" />
            {t("finance.new")}
          </Button>
        }
      />

      {/* متصفّح الشهر */}
      <div className="flex items-center justify-center gap-2 pb-5">
        <Button
          variant="outline"
          size="icon"
          aria-label={t("common.previous")}
          onClick={() => set({ month: addMonthsISO(anchor, -1).slice(0, 7) })}
        >
          <ChevronRightIcon className="size-4 rtl:hidden" />
          <ChevronLeftIcon className="hidden size-4 rtl:block" />
        </Button>

        <span className="min-w-40 text-center text-sm font-medium">
          {formatMonthYear(anchor, locale)}
        </span>

        <Button
          variant="outline"
          size="icon"
          aria-label={t("common.next")}
          disabled={isCurrentMonth}
          onClick={() => set({ month: addMonthsISO(anchor, 1).slice(0, 7) })}
        >
          <ChevronLeftIcon className="size-4 rtl:hidden" />
          <ChevronRightIcon className="hidden size-4 rtl:block" />
        </Button>
      </div>

      {/* المجاميع — اللون هنا مصحوب بأيقونة ونص، لا يحمل المعنى وحده */}
      <div className="grid grid-cols-1 gap-2.5 pb-6 sm:grid-cols-3">
        <div className="bg-card rounded-xl border p-4">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <ArrowUpRightIcon className="size-3.5" />
            {t("finance.income")}
          </p>
          <p className="text-success mt-1.5 text-2xl font-semibold tabular-nums">
            {formatCurrency(data.summary.income, locale)}
          </p>
        </div>

        <div className="bg-card rounded-xl border p-4">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <ArrowDownLeftIcon className="size-3.5" />
            {t("finance.expense")}
          </p>
          <p className="text-destructive mt-1.5 text-2xl font-semibold tabular-nums">
            {formatCurrency(data.summary.expense, locale)}
          </p>
        </div>

        <div className="bg-card rounded-xl border p-4">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <ScaleIcon className="size-3.5" />
            {t("finance.balance")}
          </p>
          <p
            className={cn(
              "mt-1.5 text-2xl font-semibold tabular-nums",
              positive ? "text-foreground" : "text-destructive"
            )}
          >
            {formatCurrency(data.summary.balance, locale)}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {positive ? t("finance.surplus") : t("finance.deficit")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 pb-6 lg:grid-cols-2">
        <MonthlyChart data={data.monthly} />
        <CategoryChart data={data.categories} />
      </div>

      {/* الحركات */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium">{t("finance.transactions")}</h2>

          <div className="ms-auto flex items-center gap-2">
            <Select
              value={filters.type ?? "all"}
              onValueChange={(value) => set({ type: value })}
            >
              <SelectTrigger size="sm" className="w-32" aria-label={t("finance.type")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("finance.allTypes")}</SelectItem>
                <SelectItem value="INCOME">{t("finance.income")}</SelectItem>
                <SelectItem value="EXPENSE">{t("finance.expense")}</SelectItem>
              </SelectContent>
            </Select>

            {data.categoryOptions.all.length > 0 ? (
              <Select
                value={filters.category ?? "all"}
                onValueChange={(value) => set({ category: value })}
              >
                <SelectTrigger
                  size="sm"
                  className="w-36"
                  aria-label={t("finance.category")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("goal.allCategories")}</SelectItem>
                  {data.categoryOptions.all.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>

        {data.transactions.length === 0 ? (
          <EmptyState
            Icon={WalletIcon}
            title={t("finance.emptyTitle")}
            description={t("finance.emptyBody")}
            action={
              <Button onClick={() => open(null)}>
                <PlusIcon className="size-4" />
                {t("finance.new")}
              </Button>
            }
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {data.transactions.map((transaction) => {
              const income = transaction.type === "INCOME"

              return (
                <li
                  key={transaction.id}
                  className="group hover:bg-accent/40 flex items-center gap-3 px-3 py-2.5 transition-colors"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      income
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    )}
                    aria-hidden
                  >
                    {income ? (
                      <ArrowUpRightIcon className="size-4" />
                    ) : (
                      <ArrowDownLeftIcon className="size-4" />
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() => open(transaction)}
                    aria-label={transaction.category}
                    className="min-w-0 flex-1 text-start"
                  >
                    <span className="block truncate text-sm">
                      {transaction.category}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                      {formatDateShort(transaction.date, locale)}
                      {transaction.description ? ` · ${transaction.description}` : ""}
                    </span>
                  </button>

                  <span
                    className={cn(
                      "shrink-0 text-sm font-medium tabular-nums",
                      income ? "text-success" : "text-foreground"
                    )}
                    dir="ltr"
                  >
                    {income ? "+" : "−"}
                    {formatCurrency(transaction.amount, locale)}
                  </span>

                  <ConfirmDialog
                    title={t("finance.deleteConfirmTitle")}
                    description={t("task.deleteConfirmBody")}
                    onConfirm={() =>
                      run(() => deleteTransaction({ id: transaction.id }), {
                        success: "finance.deleted",
                      })
                    }
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 md:opacity-0 md:group-hover:opacity-100"
                        disabled={pending}
                        aria-label={t("common.delete")}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    }
                  />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <Button
        size="icon"
        onClick={() => open(null)}
        aria-label={t("finance.new")}
        className="fixed bottom-24 end-4 z-30 size-12 rounded-full shadow-lg md:hidden"
      >
        <PlusIcon className="size-5" />
      </Button>

      <TransactionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        transaction={editing}
        categories={data.categoryOptions}
      />
    </>
  )
}
