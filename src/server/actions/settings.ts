"use server"

import { z } from "zod"

import { db } from "@/lib/db"
import { createAction } from "@/lib/safe-action"
import { WIDGET_IDS } from "@/components/dashboard/widgets"
import { optionalText } from "@/schemas/common"
import { PATHS, revalidate } from "@/server/revalidate"

const profileSchema = z.object({
  name: optionalText(120),
})

const widgetsSchema = z.object({
  widgets: z.array(z.enum(WIDGET_IDS)).max(WIDGET_IDS.length),
})

/**
 * ترتيب بطاقات لوحة التحكم.
 *
 * نزيل التكرار ونقبل القائمة الفارغة (لوحة بلا بطاقات) — لكن
 * resolveWidgets يعيد الافتراضي عندها، فإخفاء الكل يعني "أعد الافتراضي"
 * لا "اترك اللوحة خالية".
 */
export const updateDashboardWidgets = createAction(
  widgetsSchema,
  async ({ widgets }, userId) => {
    await db.user.update({
      where: { id: userId },
      data: { dashboardWidgets: [...new Set(widgets)] },
    })

    revalidate(PATHS.dashboard, PATHS.settings)
    return { count: widgets.length }
  }
)

export const updateProfile = createAction(profileSchema, async (input, userId) => {
  await db.user.update({
    where: { id: userId },
    data: { name: input.name },
  })

  revalidate(PATHS.settings, PATHS.dashboard)
  return { ok: true }
})

/**
 * حذف البيانات التجريبية.
 *
 * كل النماذج الرئيسية تحمل isDemo، فالحذف استعلام واحد لكل جدول
 * ولا يمس سطراً واحداً من بياناتك — وهذا سبب وجود الحقل أصلاً.
 */
export const deleteDemoData = createAction(z.object({}), async (_input, userId) => {
  const results = await db.$transaction([
    db.task.deleteMany({ where: { userId, isDemo: true } }),
    db.project.deleteMany({ where: { userId, isDemo: true } }),
    db.note.deleteMany({ where: { userId, isDemo: true } }),
    db.goal.deleteMany({ where: { userId, isDemo: true } }),
    db.learningPath.deleteMany({ where: { userId, isDemo: true } }),
    db.semester.deleteMany({ where: { userId, isDemo: true } }),
    db.transaction.deleteMany({ where: { userId, isDemo: true } }),
    db.bookmark.deleteMany({ where: { userId, isDemo: true } }),
  ])

  const count = results.reduce((sum, result) => sum + result.count, 0)

  revalidate(...Object.values(PATHS))
  return { count }
})

/** تصدير كامل بصيغة JSON — نسخة احتياطية يملكها المستخدم */
const exportSchema = z.object({})

export const exportData = createAction(exportSchema, async (_input, userId) => {
  const [
    tasks,
    projects,
    notes,
    goals,
    semesters,
    learningPaths,
    transactions,
    bookmarks,
    focusSessions,
    tags,
  ] = await Promise.all([
    db.task.findMany({
      where: { userId },
      include: { subtasks: true, tags: { select: { name: true } } },
    }),
    db.project.findMany({ where: { userId }, include: { milestones: true } }),
    db.note.findMany({
      where: { userId },
      include: { tags: { select: { name: true } } },
    }),
    db.goal.findMany({ where: { userId }, include: { milestones: true } }),
    db.semester.findMany({
      where: { userId },
      include: {
        subjects: { include: { assignments: true, exams: true, resources: true } },
      },
    }),
    db.learningPath.findMany({
      where: { userId },
      include: {
        sections: { include: { lessons: true } },
        resources: true,
      },
    }),
    db.transaction.findMany({ where: { userId } }),
    db.bookmark.findMany({
      where: { userId },
      include: { tags: { select: { name: true } } },
    }),
    db.focusSession.findMany({ where: { userId } }),
    db.tag.findMany({ where: { userId } }),
  ])

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    data: {
      tasks,
      projects,
      notes,
      goals,
      semesters,
      learningPaths,
      transactions,
      bookmarks,
      focusSessions,
      tags,
    },
  }
})

/** إحصاء ما هو تجريبي — حتى لا يُعرض زر الحذف بلا فائدة */
export const countDemoData = createAction(z.object({}), async (_input, userId) => {
  const counts = await Promise.all([
    db.task.count({ where: { userId, isDemo: true } }),
    db.project.count({ where: { userId, isDemo: true } }),
    db.note.count({ where: { userId, isDemo: true } }),
    db.goal.count({ where: { userId, isDemo: true } }),
    db.learningPath.count({ where: { userId, isDemo: true } }),
    db.semester.count({ where: { userId, isDemo: true } }),
    db.transaction.count({ where: { userId, isDemo: true } }),
    db.bookmark.count({ where: { userId, isDemo: true } }),
  ])

  return counts.reduce((sum, value) => sum + value, 0)
})

