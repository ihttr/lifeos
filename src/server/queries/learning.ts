import "server-only"

import { db } from "@/lib/db"
import { percentOf } from "@/lib/format"
import { requireUserId } from "@/server/auth"

import type { Prisma } from "@/generated/prisma/client"
import type { LearningFilters } from "@/schemas/learning"

export type LessonDTO = {
  id: string
  title: string
  done: boolean
  position: number
}

export type SectionDTO = {
  id: string
  title: string
  position: number
  lessons: LessonDTO[]
  doneCount: number
  progress: number
}

export type ResourceDTO = {
  id: string
  title: string
  url: string
  type: "YOUTUBE" | "WEBSITE" | "DOCS" | "COURSE" | "GITHUB" | "OTHER"
}

export type PathDTO = {
  id: string
  title: string
  description: string | null
  category: string | null
  color: string | null
  status: "ACTIVE" | "COMPLETED" | "PAUSED"
  sections: SectionDTO[]
  resources: ResourceDTO[]
  totalLessons: number
  doneLessons: number
  progress: number
}

export async function getLearningPaths(
  filters: LearningFilters = {}
): Promise<PathDTO[]> {
  const userId = await requireUserId()

  const where: Prisma.LearningPathWhereInput = { userId }
  if (filters.status) where.status = filters.status

  const paths = await db.learningPath.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      color: true,
      status: true,
      sections: {
        select: {
          id: true,
          title: true,
          position: true,
          lessons: {
            select: { id: true, title: true, done: true, position: true },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { position: "asc" },
      },
      resources: {
        select: { id: true, title: true, url: true, type: true },
        where: { lessonId: null },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  })

  return paths.map((path) => {
    const sections = path.sections.map((section) => {
      const doneCount = section.lessons.filter((lesson) => lesson.done).length
      return {
        ...section,
        doneCount,
        progress: percentOf(doneCount, section.lessons.length),
      }
    })

    const totalLessons = sections.reduce((sum, s) => sum + s.lessons.length, 0)
    const doneLessons = sections.reduce((sum, s) => sum + s.doneCount, 0)

    return {
      ...path,
      sections,
      totalLessons,
      doneLessons,
      // المسار المكتمل يُعرض ١٠٠٪ حتى لو لم تُسجَّل له دروس
      progress:
        path.status === "COMPLETED"
          ? 100
          : percentOf(doneLessons, totalLessons),
    }
  })
}

export async function getLearningSummary() {
  const userId = await requireUserId()

  const [active, completed, lessons, doneLessons] = await Promise.all([
    db.learningPath.count({ where: { userId, status: "ACTIVE" } }),
    db.learningPath.count({ where: { userId, status: "COMPLETED" } }),
    db.learningLesson.count({ where: { section: { learningPath: { userId } } } }),
    db.learningLesson.count({
      where: { done: true, section: { learningPath: { userId } } },
    }),
  ])

  return { active, completed, lessons, doneLessons }
}
