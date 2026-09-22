import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { ProjectDetail } from "@/components/projects/project-detail"
import { PageContainer } from "@/components/shared/page-header"
import { taskFiltersSchema } from "@/schemas/task"
import { getProject } from "@/server/queries/projects"
import { getTaskFormOptions, getTasks } from "@/server/queries/tasks"

import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = await getProject(id)
  return { title: project?.name ?? "" }
}

export default async function ProjectPage({
  params,
}: PageProps<"/[locale]/projects/[id]">) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const project = await getProject(id)
  if (!project) notFound()

  const [tasks, taskOptions] = await Promise.all([
    getTasks(taskFiltersSchema.parse({ projectId: id, sort: "manual" })),
    getTaskFormOptions(),
  ])

  return (
    <PageContainer>
      <ProjectDetail
        project={project}
        tasks={tasks}
        taskOptions={taskOptions}
      />
    </PageContainer>
  )
}
