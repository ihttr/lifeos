"use server"

import { db } from "@/lib/db"
import { isoToDateColumn } from "@/lib/dates"
import { createAction } from "@/lib/safe-action"
import {
  createProjectSchema,
  milestoneCreateSchema,
  milestoneIdSchema,
  milestoneToggleSchema,
  projectIdSchema,
  updateProjectSchema,
} from "@/schemas/project"
import { PATHS, revalidate } from "@/server/revalidate"

function revalidateProjects() {
  revalidate(PATHS.projects, PATHS.dashboard, PATHS.tasks, PATHS.calendar)
}

export const createProject = createAction(
  createProjectSchema,
  async (input, userId) => {
    const project = await db.project.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        status: input.status,
        priority: input.priority,
        startDate: isoToDateColumn(input.startDate),
        deadline: isoToDateColumn(input.deadline),
        technologies: input.technologies,
        githubUrl: input.githubUrl,
        websiteUrl: input.websiteUrl,
        deployUrl: input.deployUrl,
        notes: input.notes,
        color: input.color,
      },
      select: { id: true },
    })

    revalidateProjects()
    return project
  }
)

export const updateProject = createAction(
  updateProjectSchema,
  async (input, userId) => {
    const { count } = await db.project.updateMany({
      where: { id: input.id, userId },
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
        priority: input.priority,
        startDate: isoToDateColumn(input.startDate),
        deadline: isoToDateColumn(input.deadline),
        technologies: input.technologies,
        githubUrl: input.githubUrl,
        websiteUrl: input.websiteUrl,
        deployUrl: input.deployUrl,
        notes: input.notes,
        color: input.color,
      },
    })
    if (count === 0) throw new Error("not found")

    revalidateProjects()
    return { id: input.id }
  }
)

export const deleteProject = createAction(
  projectIdSchema,
  async ({ id }, userId) => {
    // مهام المشروع لا تُحذف — projectId يصبح null (onDelete: SetNull)
    const { count } = await db.project.deleteMany({ where: { id, userId } })
    if (count === 0) throw new Error("not found")

    revalidateProjects()
    return { id }
  }
)

export const addMilestone = createAction(
  milestoneCreateSchema,
  async ({ projectId, title, dueDate }, userId) => {
    const project = await db.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true, _count: { select: { milestones: true } } },
    })
    if (!project) throw new Error("not found")

    const milestone = await db.milestone.create({
      data: {
        projectId,
        title,
        dueDate: isoToDateColumn(dueDate),
        position: project._count.milestones,
      },
      select: { id: true },
    })

    revalidateProjects()
    return milestone
  }
)

export const toggleMilestone = createAction(
  milestoneToggleSchema,
  async ({ id, done }, userId) => {
    const { count } = await db.milestone.updateMany({
      where: { id, project: { userId } },
      data: { done },
    })
    if (count === 0) throw new Error("not found")

    revalidateProjects()
    return { id }
  }
)

export const deleteMilestone = createAction(
  milestoneIdSchema,
  async ({ id }, userId) => {
    const { count } = await db.milestone.deleteMany({
      where: { id, project: { userId } },
    })
    if (count === 0) throw new Error("not found")

    revalidateProjects()
    return { id }
  }
)
