import { getTranslations, setRequestLocale } from "next-intl/server"

import { LearningView } from "@/components/learning/learning-view"
import { PageContainer } from "@/components/shared/page-header"
import { learningFiltersSchema } from "@/schemas/learning"
import { getLearningPaths, getLearningSummary } from "@/server/queries/learning"

import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return { title: t("learning") }
}

export default async function LearningPage({
  params,
  searchParams,
}: PageProps<"/[locale]/learning">) {
  const { locale } = await params
  setRequestLocale(locale)

  const filters = learningFiltersSchema.parse(await searchParams)

  const [paths, summary] = await Promise.all([
    getLearningPaths(filters),
    getLearningSummary(),
  ])

  return (
    <PageContainer>
      <LearningView paths={paths} summary={summary} filters={filters} />
    </PageContainer>
  )
}
