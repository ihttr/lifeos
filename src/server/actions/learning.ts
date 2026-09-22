"use server"

import { db } from "@/lib/db"
import { createAction } from "@/lib/safe-action"
import {
  createPathSchema,
  lessonCreateSchema,
  lessonIdSchema,
  lessonToggleSchema,
  pathIdSchema,
  resourceCreateSchema,
  resourceIdSchema,
  sectionCreateSchema,
  sectionIdSchema,
  updatePathSchema,
} from "@/schemas/learning"
import { PATHS, revalidate } from "@/server/revalidate"

function revalidateLearning() {
  revalidate(PATHS.learning, PATHS.dashboard, PATHS.stats)
}

async function assertOwnsPath(id: string, userId: string) {
  const count = await db.learningPath.count({ where: { id, userId } })
  if (count === 0) throw new Error("path not owned")
}

// ------------------------------------------------------------------ المسارات

export const createPath = createAction(createPathSchema, async (input, userId) => {
  const path = await db.learningPath.create({
    data: { userId, ...input },
    select: { id: true },
  })

  revalidateLearning()
  return path
})

export const updatePath = createAction(updatePathSchema, async (input, userId) => {
  const { id, ...data } = input
  const { count } = await db.learningPath.updateMany({
    where: { id, userId },
    data,
  })
  if (count === 0) throw new Error("not found")

  revalidateLearning()
  return { id }
})

export const deletePath = createAction(pathIdSchema, async ({ id }, userId) => {
  // Cascade يحذف الأقسام ودروسها ومصادرها
  const { count } = await db.learningPath.deleteMany({ where: { id, userId } })
  if (count === 0) throw new Error("not found")

  revalidateLearning()
  return { id }
})

// ------------------------------------------------------------------ الأقسام

export const addSection = createAction(
  sectionCreateSchema,
  async ({ learningPathId, title }, userId) => {
    await assertOwnsPath(learningPathId, userId)

    const count = await db.learningSection.count({ where: { learningPathId } })
    const section = await db.learningSection.create({
      data: { learningPathId, title, position: count },
      select: { id: true },
    })

    revalidateLearning()
    return section
  }
)

export const deleteSection = createAction(
  sectionIdSchema,
  async ({ id }, userId) => {
    const { count } = await db.learningSection.deleteMany({
      where: { id, learningPath: { userId } },
    })
    if (count === 0) throw new Error("not found")

    revalidateLearning()
    return { id }
  }
)

// ------------------------------------------------------------------ الدروس

export const addLesson = createAction(
  lessonCreateSchema,
  async ({ sectionId, title }, userId) => {
    const section = await db.learningSection.findFirst({
      where: { id: sectionId, learningPath: { userId } },
      select: { id: true, _count: { select: { lessons: true } } },
    })
    if (!section) throw new Error("not found")

    const lesson = await db.learningLesson.create({
      data: { sectionId, title, position: section._count.lessons },
      select: { id: true },
    })

    revalidateLearning()
    return lesson
  }
)

export const toggleLesson = createAction(
  lessonToggleSchema,
  async ({ id, done }, userId) => {
    const lesson = await db.learningLesson.findFirst({
      where: { id, section: { learningPath: { userId } } },
      select: { id: true, section: { select: { learningPathId: true } } },
    })
    if (!lesson) throw new Error("not found")

    await db.learningLesson.update({
      where: { id },
      data: { done, doneAt: done ? new Date() : null },
    })

    // إنجاز كل الدروس يُكمل المسار، وإلغاء أيٍّ منها يعيده نشطاً
    const pathId = lesson.section.learningPathId
    const [total, doneCount, path] = await Promise.all([
      db.learningLesson.count({
        where: { section: { learningPathId: pathId } },
      }),
      db.learningLesson.count({
        where: { done: true, section: { learningPathId: pathId } },
      }),
      db.learningPath.findUnique({
        where: { id: pathId },
        select: { status: true },
      }),
    ])

    if (total > 0) {
      if (doneCount === total && path?.status === "ACTIVE") {
        await db.learningPath.update({
          where: { id: pathId },
          data: { status: "COMPLETED" },
        })
      } else if (doneCount < total && path?.status === "COMPLETED") {
        await db.learningPath.update({
          where: { id: pathId },
          data: { status: "ACTIVE" },
        })
      }
    }

    revalidateLearning()
    return { id }
  }
)

export const deleteLesson = createAction(lessonIdSchema, async ({ id }, userId) => {
  const { count } = await db.learningLesson.deleteMany({
    where: { id, section: { learningPath: { userId } } },
  })
  if (count === 0) throw new Error("not found")

  revalidateLearning()
  return { id }
})

// ------------------------------------------------------------------ المصادر

export const addResource = createAction(
  resourceCreateSchema,
  async (input, userId) => {
    await assertOwnsPath(input.learningPathId, userId)

    const resource = await db.resource.create({
      data: {
        userId,
        learningPathId: input.learningPathId,
        title: input.title,
        url: input.url,
        type: input.type,
      },
      select: { id: true },
    })

    revalidateLearning()
    return resource
  }
)

export const deleteResource = createAction(
  resourceIdSchema,
  async ({ id }, userId) => {
    const { count } = await db.resource.deleteMany({ where: { id, userId } })
    if (count === 0) throw new Error("not found")

    revalidateLearning()
    return { id }
  }
)
