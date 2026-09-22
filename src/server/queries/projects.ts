import "server-only"

import { db } from "@/lib/db"
import { dateColumnToISO } from "@/lib/dates"
import { percentOf } from "@/lib/format"
import { requireUserId } from "@/server/auth"

import type { Prisma } from "@/generated/prisma/client"
import type { ProjectFilters } from "@/schemas/project"

const listSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  priority: true,
  startDate: true,
  deadline: true,
  technologies: true,
  githubUrl: true,
  websiteUrl: true,
  deployUrl: true,
  color: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect

export type ProjectListItem = {
  id: string
  name: string
  description: string | null
  status: Prisma.ProjectGetPayload<{ select: { status: true } }>["status"]
  priority: Prisma.ProjectGetPayload<{ select: { priority: true } }>["priority"]
  startDate: string | null
  deadline: string | null
  technologies: string[]
  githubUrl: string | null
  websiteUrl: string | null
  deployUrl: string | null
  color: string | null
  progress: number
  taskCount: number
  doneTaskCount: number
  milestoneCount: number
  doneMilestoneCount: number
}

/**
 * التقدم محسوب لا مخزّن: مجموع المهام والمراحل المنجزة على إجماليها.
 * هذا يمنع تضارب رقم محفوظ مع الواقع.
 */
function progressOf(counts: {
  tasks: number
  doneTasks: number
  milestones: number
  doneMilestones: number
}): number {
  const total = counts.tasks + counts.milestones
  const done = counts.doneTasks + counts.doneMilestones
  return percentOf(done, total)
}

export async function getProjects(
  filters: ProjectFilters = {}
): Promise<ProjectListItem[]> {
  const userId = await requireUserId()

  const where: Prisma.ProjectWhereInput = { userId }
  if (filters.status) where.status = filters.status
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
      { technologies: { has: filters.q } },
    ]
  }

  const projects = await db.project.findMany({
    where,
    select: {
      ...listSelect,
      tasks: { select: { status: true }, where: { archivedAt: null } },
      milestones: { select: { done: true } },
    },
    orderBy: [{ status: "asc" }, { deadline: { sort: "asc", nulls: "last" } }],
    take: 200,
  })

  return projects.map((project) => {
    const doneTasks = project.tasks.filter((t) => t.status === "DONE").length
    const doneMilestones = project.milestones.filter((m) => m.done).length

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      startDate: dateColumnToISO(project.startDate),
      deadline: dateColumnToISO(project.deadline),
      technologies: project.technologies,
      githubUrl: project.githubUrl,
      websiteUrl: project.websiteUrl,
      deployUrl: project.deployUrl,
      color: project.color,
      taskCount: project.tasks.length,
      doneTaskCount: doneTasks,
      milestoneCount: project.milestones.length,
      doneMilestoneCount: doneMilestones,
      progress: progressOf({
        tasks: project.tasks.length,
        doneTasks,
        milestones: project.milestones.length,
        doneMilestones,
      }),
    }
  })
}

export async function getProject(id: string) {
  const userId = await requireUserId()

  const project = await db.project.findFirst({
    where: { id, userId },
    select: {
      ...listSelect,
      notes: true,
      createdAt: true,
      milestones: {
        select: { id: true, title: true, done: true, dueDate: true, position: true },
        orderBy: { position: "asc" },
      },
      projectNotes: {
        select: { id: true, title: true, updatedAt: true },
        where: { archivedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 20,
      },
      _count: { select: { tasks: true } },
    },
  })

  if (!project) return null

  const tasks = await db.task.findMany({
    where: { projectId: id, userId, archivedAt: null },
    select: { id: true, status: true },
  })

  const doneTasks = tasks.filter((t) => t.status === "DONE").length
  const doneMilestones = project.milestones.filter((m) => m.done).length

  return {
    ...project,
    startDate: dateColumnToISO(project.startDate),
    deadline: dateColumnToISO(project.deadline),
    createdAt: project.createdAt.toISOString(),
    milestones: project.milestones.map((milestone) => ({
      ...milestone,
      dueDate: dateColumnToISO(milestone.dueDate),
    })),
    projectNotes: project.projectNotes.map((note) => ({
      ...note,
      updatedAt: note.updatedAt.toISOString(),
    })),
    taskCount: tasks.length,
    doneTaskCount: doneTasks,
    progress: progressOf({
      tasks: tasks.length,
      doneTasks,
      milestones: project.milestones.length,
      doneMilestones,
    }),
  }
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>

/** المشاريع النشطة للوحة التحكم */
export async function getActiveProjects(limit = 4) {
  const projects = await getProjects({ status: undefined, q: undefined })
  return projects
    .filter((project) => project.status === "IN_PROGRESS")
    .slice(0, limit)
}
