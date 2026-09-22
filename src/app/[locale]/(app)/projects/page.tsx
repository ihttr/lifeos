import { getTranslations, setRequestLocale } from "next-intl/server"

import { ProjectsView } from "@/components/projects/projects-view"
import { PageContainer } from "@/components/shared/page-header"
import { projectFiltersSchema } from "@/schemas/project"
import { getProjects } from "@/server/queries/projects"

import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return { title: t("projects") }
}

export default async function ProjectsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/projects">) {
  const { locale } = await params
  setRequestLocale(locale)

  const filters = projectFiltersSchema.parse(await searchParams)
  const projects = await getProjects(filters)

  return (
    <PageContainer>
      <ProjectsView projects={projects} filters={filters} />
    </PageContainer>
  )
}
