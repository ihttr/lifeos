import { getTranslations, setRequestLocale } from "next-intl/server"
import { z } from "zod"

import { CalendarView } from "@/components/calendar/calendar-view"
import { PageContainer } from "@/components/shared/page-header"
import { endOfMonthISO, todayISO } from "@/lib/dates"
import { getAgenda } from "@/server/queries/agenda"

import type { Metadata } from "next"

const filtersSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .catch(undefined),
  kind: z
    .enum(["task", "assignment", "exam", "project", "goal"])
    .optional()
    .catch(undefined),
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return { title: t("calendar") }
}

export default async function CalendarPage({
  params,
  searchParams,
}: PageProps<"/[locale]/calendar">) {
  const { locale } = await params
  setRequestLocale(locale)

  const filters = filtersSchema.parse(await searchParams)
  const month = filters.month ?? todayISO().slice(0, 7)

  // نوسّع المدى أسبوعاً على الطرفين ليشمل أيام الشبكة من الشهرين المجاورين
  const items = await getAgenda({
    from: `${month}-01`,
    to: endOfMonthISO(`${month}-01`),
  })

  const filtered = filters.kind
    ? items.filter((item) => item.kind === filters.kind)
    : items

  return (
    <PageContainer>
      <CalendarView items={filtered} month={month} kind={filters.kind} />
    </PageContainer>
  )
}
