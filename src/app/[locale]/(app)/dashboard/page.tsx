import { getTranslations, setRequestLocale } from "next-intl/server"

import { DashboardView } from "@/components/dashboard/dashboard-view"
import { PageContainer } from "@/components/shared/page-header"
import { getDashboardData } from "@/server/queries/dashboard"
import { getTaskFormOptions } from "@/server/queries/tasks"
import { getCurrentUser } from "@/server/queries/user"

import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "dashboard" })
  return { title: t("title") }
}

export default async function DashboardPage({
  params,
}: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params
  setRequestLocale(locale)

  const [user, data, taskOptions] = await Promise.all([
    getCurrentUser(),
    getDashboardData(),
    getTaskFormOptions(),
  ])

  return (
    <PageContainer>
      <DashboardView
        data={data}
        userName={user.name ?? user.email}
        taskOptions={taskOptions}
      />
    </PageContainer>
  )
}
