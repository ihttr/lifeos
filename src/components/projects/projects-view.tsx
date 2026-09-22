"use client"

import { FolderKanbanIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { ProjectCard } from "@/components/projects/project-card"
import { ProjectFormDialog } from "@/components/projects/project-form-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFilterParams } from "@/hooks/use-filter-params"

import type { ProjectFilters, ProjectStatus } from "@/schemas/project"
import type { ProjectListItem } from "@/server/queries/projects"

const STATUSES: ProjectStatus[] = [
  "PLANNING",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
]

export function ProjectsView({
  projects,
  filters,
}: {
  projects: ProjectListItem[]
  filters: ProjectFilters
}) {
  const t = useTranslations()
  const { set } = useFilterParams()
  const [formOpen, setFormOpen] = useState(false)
  const [query, setQuery] = useState(filters.q ?? "")

  useEffect(() => setQuery(filters.q ?? ""), [filters.q])

  useEffect(() => {
    const current = filters.q ?? ""
    if (query === current) return
    const timer = setTimeout(() => set({ q: query || undefined }), 300)
    return () => clearTimeout(timer)
  }, [query, filters.q, set])

  const hasFilters = Boolean(filters.q || filters.status)

  return (
    <>
      <PageHeader
        title={t("nav.projects")}
        description={t("project.countLabel", { count: projects.length })}
        actions={
          <Button
            onClick={() => setFormOpen(true)}
            className="hidden md:inline-flex"
          >
            <PlusIcon className="size-4" />
            {t("project.new")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 pb-5">
        <div className="relative min-w-40 flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`${t("common.search")}…`}
            className="ps-9"
            aria-label={t("common.search")}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("common.clear")}
              className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2 rounded p-1"
            >
              <XIcon className="size-3.5" />
            </button>
          ) : null}
        </div>

        <Select
          value={filters.status ?? "all"}
          onValueChange={(value) => set({ status: value })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`projectStatus.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          Icon={FolderKanbanIcon}
          title={hasFilters ? t("empty.searchTitle") : t("empty.projectsTitle")}
          description={
            hasFilters ? t("empty.searchBody") : t("empty.projectsBody")
          }
          action={
            hasFilters ? null : (
              <Button onClick={() => setFormOpen(true)}>
                <PlusIcon className="size-4" />
                {t("project.new")}
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <Button
        size="icon"
        onClick={() => setFormOpen(true)}
        aria-label={t("project.new")}
        className="fixed bottom-24 end-4 z-30 size-12 rounded-full shadow-lg md:hidden"
      >
        <PlusIcon className="size-5" />
      </Button>

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        project={null}
      />
    </>
  )
}
