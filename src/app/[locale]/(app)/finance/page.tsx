import { getTranslations, setRequestLocale } from "next-intl/server"

import { FinanceView } from "@/components/finance/finance-view"
import { PageContainer } from "@/components/shared/page-header"
import { financeFiltersSchema } from "@/schemas/finance"
import { getFinanceData } from "@/server/queries/finance"

import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return { title: t("finance") }
}

export default async function FinancePage({
  params,
  searchParams,
}: PageProps<"/[locale]/finance">) {
  const { locale } = await params
  setRequestLocale(locale)

  const filters = financeFiltersSchema.parse(await searchParams)
  const data = await getFinanceData(filters)

  return (
    <PageContainer>
      <FinanceView data={data} filters={filters} />
    </PageContainer>
  )
}
