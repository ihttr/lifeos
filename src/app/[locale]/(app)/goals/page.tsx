import { getTranslations, setRequestLocale } from "next-intl/server"

import { GoalsView } from "@/components/goals/goals-view"
import { PageContainer } from "@/components/shared/page-header"
import { goalFiltersSchema } from "@/schemas/goal"
import {
  getGoalCategories,
  getGoalSummary,
  getGoals,
} from "@/server/queries/goals"

import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return { title: t("goals") }
}

export default async function GoalsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/goals">) {
  const { locale } = await params
  setRequestLocale(locale)

  const filters = goalFiltersSchema.parse(await searchParams)

  const [goals, categories, summary] = await Promise.all([
    getGoals(filters),
    getGoalCategories(),
    getGoalSummary(),
  ])

  return (
    <PageContainer>
      <GoalsView
        goals={goals}
        categories={categories}
        summary={summary}
        filters={filters}
      />
    </PageContainer>
  )
}
