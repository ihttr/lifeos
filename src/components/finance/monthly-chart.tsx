"use client"

import { cn } from "cn"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { formatMonthYear } from "@/lib/dates"
import { formatCurrency } from "@/lib/format"

import type { Locale } from "@/i18n/routing"
import type { MonthTotals } from "@/server/queries/finance"

/**
 * الدخل مقابل المصروف على ستة أشهر — أعمدة مجمّعة، سلسلتان.
 *
 * اللونان أزرق وكهرماني لا أخضر وأحمر: زوج الأخضر/الأحمر يفشل فحص
 * عمى الألوان (ΔE 2.1 في الوضع الداكن) فلا يميّزه مصاب الـdeuteranopia،
 * بينما هذا الزوج يحقق ΔE 30. الدلالة تأتي من المفتاح والتسميات لا من اللون.
 *
 * محور واحد فقط — السلسلتان بنفس الوحدة (ريال).
 */
export function MonthlyChart({ data }: { data: MonthTotals[] }) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const [hovered, setHovered] = useState<string | null>(null)

  const max = Math.max(...data.flatMap((m) => [m.income, m.expense]), 1)
  const active = data.find((m) => m.month === hovered)

  return (
    <section className="bg-card rounded-xl border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{t("finance.trendTitle")}</h2>

        {/* مفتاح دائم — سلسلتان فأكثر لا تُترك للون وحده */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <span className="bg-chart-1 size-2.5 rounded-[3px]" />
            {t("finance.income")}
          </span>
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <span className="bg-chart-3 size-2.5 rounded-[3px]" />
            {t("finance.expense")}
          </span>
        </div>
      </div>

      <div
        className="mt-5 flex h-40 items-end justify-between gap-2"
        onMouseLeave={() => setHovered(null)}
      >
        {data.map((month) => {
          const isActive = hovered === month.month

          return (
            <button
              key={month.month}
              type="button"
              className="group flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setHovered(month.month)}
              onFocus={() => setHovered(month.month)}
              onBlur={() => setHovered(null)}
              aria-label={`${formatMonthYear(`${month.month}-01`, locale)}: ${t("finance.income")} ${formatCurrency(month.income, locale, { compact: true })}, ${t("finance.expense")} ${formatCurrency(month.expense, locale, { compact: true })}`}
            >
              {/* فجوة ٢px بين العمودين المتجاورين */}
              <span className="flex h-full items-end justify-center gap-[2px]">
                {/* الصفر محايد اللون حتى لا يُقرأ كمبلغ صغير */}
                <span
                  className={cn(
                    "w-1/2 max-w-5 rounded-t-[4px] transition-opacity",
                    month.income > 0 ? "bg-chart-1" : "bg-muted",
                    isActive && month.income > 0 && "opacity-80"
                  )}
                  style={{
                    height:
                      month.income > 0
                        ? `${Math.max(4, (month.income / max) * 100)}%`
                        : "3px",
                  }}
                />
                <span
                  className={cn(
                    "w-1/2 max-w-5 rounded-t-[4px] transition-opacity",
                    month.expense > 0 ? "bg-chart-3" : "bg-muted",
                    isActive && month.expense > 0 && "opacity-80"
                  )}
                  style={{
                    height:
                      month.expense > 0
                        ? `${Math.max(4, (month.expense / max) * 100)}%`
                        : "3px",
                  }}
                />
              </span>

              <span
                className={cn(
                  "mt-2 block truncate text-[11px]",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {formatMonthYear(`${month.month}-01`, locale).split(" ")[0]}
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-muted-foreground mt-2 min-h-5 text-xs">
        {active
          ? `${formatMonthYear(`${active.month}-01`, locale)} · ${t("finance.income")} ${formatCurrency(active.income, locale)} · ${t("finance.expense")} ${formatCurrency(active.expense, locale)}`
          : t("finance.trendHint")}
      </p>

      {/* الأرقام نفسها كجدول — لقارئ الشاشة وللطباعة */}
      <table className="sr-only">
        <caption>{t("finance.trendTitle")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("finance.month")}</th>
            <th scope="col">{t("finance.income")}</th>
            <th scope="col">{t("finance.expense")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((month) => (
            <tr key={month.month}>
              <th scope="row">{formatMonthYear(`${month.month}-01`, locale)}</th>
              <td>{formatCurrency(month.income, locale)}</td>
              <td>{formatCurrency(month.expense, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
