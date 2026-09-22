import { getTranslations, setRequestLocale } from "next-intl/server"
import { z } from "zod"

import { PageContainer } from "@/components/shared/page-header"
import { StatsView } from "@/components/stats/stats-view"
import { getStats, type StatsRange } from "@/server/queries/stats"

import type { Metadata } from "next"

const filtersSchema = z.object({
  range: z.enum(["7", "30", "90", "365"]).catch("30"),
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return { title: t("stats") }
}

export default async function StatsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/stats">) {
  const { locale } = await params
  setRequestLocale(locale)

  const { range } = filtersSchema.parse(await searchParams)
  const data = await getStats(Number(range) as StatsRange)

  return (
    <PageContainer>
      <StatsView data={data} />
    </PageContainer>
  )
}
