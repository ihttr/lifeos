"use client"

import { useLocale, useTranslations } from "next-intl"

import { formatCurrency, formatPercent } from "@/lib/format"

import type { Locale } from "@/i18n/routing"
import type { CategoryTotal } from "@/server/queries/finance"

/**
 * المصروف حسب التصنيف — أعمدة أفقية مع تسمية مباشرة لكل صف.
 *
 * اخترناها على الدائرية لأن مقارنة الأطوال أدق من مقارنة الزوايا،
 * والتسمية المباشرة تجعل اللون زينة لا حاملاً للهوية —
 * فلا نحتاج لوحة تصنيفية ولا نصطدم بحد الثماني سلاسل.
 */
export function CategoryChart({ data }: { data: CategoryTotal[] }) {
  const t = useTranslations()
  const locale = useLocale() as Locale

  if (data.length === 0) {
    return (
      <section className="bg-card rounded-xl border p-4">
        <h2 className="text-sm font-medium">{t("finance.byCategory")}</h2>
        <p className="text-muted-foreground py-8 text-center text-sm">
          {t("finance.noExpenses")}
        </p>
      </section>
    )
  }

  const max = Math.max(...data.map((row) => row.total), 1)

  return (
    <section className="bg-card rounded-xl border p-4">
      <h2 className="text-sm font-medium">{t("finance.byCategory")}</h2>

      <ul className="mt-4 space-y-2.5">
        {data.map((row) => (
          <li key={row.category}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate">{row.category}</span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {formatCurrency(row.total, locale, { compact: true })}
                <span className="ms-1.5">{formatPercent(row.share, locale)}</span>
              </span>
            </div>

            <div
              className="bg-muted mt-1.5 h-2 overflow-hidden rounded-full"
              role="img"
              aria-label={`${row.category}: ${formatCurrency(row.total, locale)}`}
            >
              <div
                className="bg-chart-3 h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(2, (row.total / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
