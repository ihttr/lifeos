import { getTranslations, setRequestLocale } from "next-intl/server"

import { DashboardView } from "@/components/dashboard/dashboard-view"
import { resolveWidgets } from "@/components/dashboard/widgets"
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

  // نحتاج تفضيلات المستخدم أولاً لنعرف أي بيانات نجلب
  const user = await getCurrentUser()
  const widgets = resolveWidgets(user.dashboardWidgets)

  const [data, taskOptions] = await Promise.all([
    getDashboardData(widgets),
    getTaskFormOptions(),
  ])

  return (
    <PageContainer>
      <DashboardView
        data={data}
        widgets={widgets}
        userName={user.name ?? user.email}
        taskOptions={taskOptions}
      />
    </PageContainer>
  )
}
