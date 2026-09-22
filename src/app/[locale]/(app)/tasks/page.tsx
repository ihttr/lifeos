import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageContainer } from "@/components/shared/page-header"
import { TasksView } from "@/components/tasks/tasks-view"
import { taskFiltersSchema } from "@/schemas/task"
import { getTaskFormOptions, getTasks } from "@/server/queries/tasks"

import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return { title: t("tasks") }
}

export default async function TasksPage({
  params,
  searchParams,
}: PageProps<"/[locale]/tasks">) {
  const { locale } = await params
  setRequestLocale(locale)

  const filters = taskFiltersSchema.parse(await searchParams)

  const [tasks, options] = await Promise.all([
    getTasks(filters),
    getTaskFormOptions(),
  ])

  return (
    <PageContainer>
      <TasksView tasks={tasks} filters={filters} options={options} />
    </PageContainer>
  )
}
