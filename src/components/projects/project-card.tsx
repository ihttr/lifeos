"use client"

import { cn } from "cn"
import {
  CalendarClockIcon,
  ExternalLinkIcon,
  GitBranchIcon,
  GlobeIcon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { ProgressBar } from "@/components/shared/progress-bar"
import { Badge } from "@/components/ui/badge"
import { Link } from "@/i18n/navigation"
import { isOverdue, relativeDueLabel } from "@/lib/dates"

import type { Locale } from "@/i18n/routing"
import type { ProjectListItem } from "@/server/queries/projects"

const STATUS_CLASS: Record<ProjectListItem["status"], string> = {
  PLANNING: "",
  IN_PROGRESS: "border-info/40 text-info",
  PAUSED: "border-warning/40 text-warning",
  COMPLETED: "border-success/40 text-success",
  ARCHIVED: "text-muted-foreground",
}

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const t = useTranslations()
  const locale = useLocale() as Locale

  const late =
    project.deadline &&
    project.status !== "COMPLETED" &&
    project.status !== "ARCHIVED" &&
    isOverdue(project.deadline)

  return (
    <Link
      href={`/projects/${project.id}`}
      className={cn(
        "bg-card group relative flex flex-col rounded-xl border p-4 transition-shadow",
        "hover:shadow-sm focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: project.color ?? "var(--muted-foreground)" }}
          />
          <h3 className="truncate font-medium">{project.name}</h3>
        </div>

        <Badge
          variant="outline"
          className={cn("shrink-0 font-normal", STATUS_CLASS[project.status])}
        >
          {t(`projectStatus.${project.status}`)}
        </Badge>
      </div>

      {project.description ? (
        <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
          {project.description}
        </p>
      ) : null}

      {project.technologies.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {project.technologies.slice(0, 5).map((tech) => (
            <span
              key={tech}
              className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px]"
            >
              {tech}
            </span>
          ))}
          {project.technologies.length > 5 ? (
            <span className="text-muted-foreground text-[11px]">
              +{project.technologies.length - 5}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto pt-4">
        <ProgressBar
          value={project.progress}
          label={t("common.progress")}
          color={project.color}
        />

        <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {project.taskCount > 0 ? (
            <span>
              {t("project.tasksRatio", {
                done: project.doneTaskCount,
                total: project.taskCount,
              })}
            </span>
          ) : null}

          {project.milestoneCount > 0 ? (
            <span>
              {t("project.milestonesRatio", {
                done: project.doneMilestoneCount,
                total: project.milestoneCount,
              })}
            </span>
          ) : null}

          {project.deadline ? (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                late && "text-destructive font-medium"
              )}
            >
              <CalendarClockIcon className="size-3.5" />
              {relativeDueLabel(project.deadline, locale)}
            </span>
          ) : null}

          <span className="ms-auto flex items-center gap-1.5">
            {project.githubUrl ? <GitBranchIcon className="size-3.5" /> : null}
            {project.websiteUrl ? <GlobeIcon className="size-3.5" /> : null}
            {project.deployUrl ? (
              <ExternalLinkIcon className="size-3.5" />
            ) : null}
          </span>
        </div>
      </div>
    </Link>
  )
}
