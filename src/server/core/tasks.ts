import "server-only"

import { db } from "@/lib/db"
import {
  addDaysISO,
  addMonthsISO,
  dateColumnToISO,
  isoToDateColumn,
  todayISO,
} from "@/lib/dates"
import { revalidateTasks } from "@/server/revalidate"

import type { Recurrence } from "@/generated/prisma/enums"
import type { TaskInput } from "@/schemas/task"

/**
 * كتابة المهام بمستخدم صريح — لا جلسة ولا كوكي.
 *
 * وُجد هذا الملف لأن `src/server/actions/tasks.ts` عليه `"use server"`،
 * وكل صادر منه يصير server action مرتبطاً بجلسة. البوت لا جلسة له،
 * فنضع المنطق هنا ويستدعيه الاثنان: الإجراءات بعد requireUserId،
 * والبوت بعد التحقق من المحادثة. نسخة واحدة من المنطق لا نسختان.
 */

/**
 * يتحقق أن المشروع/المادة المرتبطين يخصّان المستخدم نفسه.
 * بدون هذا يمكن لمستخدم ربط مهمته بمشروع مستخدم آخر عبر تعديل الطلب.
 */
export async function assertOwnedRelations(input: TaskInput, userId: string) {
  if (input.projectId) {
    const count = await db.project.count({
      where: { id: input.projectId, userId },
    })
    if (count === 0) throw new Error("project not owned")
  }

  if (input.subjectId) {
    const count = await db.subject.count({
      where: { id: input.subjectId, userId },
    })
    if (count === 0) throw new Error("subject not owned")
  }
}

/** الوسوم تُنشأ عند الحاجة، ودائماً ضمن نطاق المستخدم */
export function tagConnect(tags: string[], userId: string) {
  return tags.map((name) => ({
    where: { userId_name: { userId, name } },
    create: { name, userId },
  }))
}

function nextOccurrence(iso: string, recurrence: Recurrence): string | null {
  switch (recurrence) {
    case "DAILY":
      return addDaysISO(iso, 1)
    case "WEEKLY":
      return addDaysISO(iso, 7)
    case "MONTHLY":
      return addMonthsISO(iso, 1)
    default:
      return null
  }
}

export async function createTaskFor(userId: string, input: TaskInput) {
  await assertOwnedRelations(input, userId)

  // المهمة الجديدة تتصدّر عمودها في لوحة كانبان
  const first = await db.task.findFirst({
    where: { userId, status: input.status, archivedAt: null },
    orderBy: { position: "asc" },
    select: { position: true },
  })

  const task = await db.task.create({
    data: {
      userId,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      dueDate: isoToDateColumn(input.dueDate),
      dueTime: input.dueTime,
      recurrence: input.recurrence,
      category: input.category,
      notes: input.notes,
      projectId: input.projectId,
      subjectId: input.subjectId,
      position: (first?.position ?? 0) - 1,
      tags: { connectOrCreate: tagConnect(input.tags, userId) },
    },
    select: { id: true },
  })

  revalidateTasks()
  return task
}

export async function setTaskDoneFor(
  userId: string,
  id: string,
  done: boolean
): Promise<{ id: string; spawned: string | null }> {
  const task = await db.task.findFirst({
    where: { id, userId },
    include: { subtasks: true, tags: { select: { id: true } } },
  })
  if (!task) throw new Error("not found")

  if (!done) {
    await db.task.update({
      where: { id },
      data: { status: "TODO", completedAt: null },
    })
    revalidateTasks()
    return { id, spawned: null }
  }

  await db.task.update({
    where: { id },
    data: { status: "DONE", completedAt: new Date() },
  })

  // المهمة المتكررة تلد نسختها التالية عند إنجازها
  let spawned: string | null = null
  const dueIso = dateColumnToISO(task.dueDate)

  if (task.recurrence !== "NONE" && dueIso) {
    const nextDue = nextOccurrence(dueIso, task.recurrence)
    if (nextDue) {
      const created = await db.task.create({
        data: {
          userId,
          title: task.title,
          description: task.description,
          status: "TODO",
          priority: task.priority,
          dueDate: isoToDateColumn(nextDue),
          dueTime: task.dueTime,
          recurrence: task.recurrence,
          category: task.category,
          notes: task.notes,
          projectId: task.projectId,
          subjectId: task.subjectId,
          position: task.position,
          tags: { connect: task.tags.map((t) => ({ id: t.id })) },
          subtasks: {
            create: task.subtasks.map((s) => ({
              title: s.title,
              done: false,
              position: s.position,
            })),
          },
        },
        select: { id: true },
      })
      spawned = created.id
    }
  }

  revalidateTasks()
  return { id, spawned }
}

/**
 * يؤجّل موعد المهمة عدداً من الأيام.
 *
 * المهمة بلا موعد تُجدول من اليوم لا من العدم، لأن «أجّل يوماً» على
 * مهمة ظهرت في تنبيه متأخر يجب أن تعطي موعداً صالحاً في كل الحالات.
 * والتأجيل يُحسب من الأبعد بين موعدها واليوم، فلا يبقى الموعد في الماضي.
 */
export async function postponeTaskFor(
  userId: string,
  id: string,
  days: number
): Promise<{ id: string; dueDate: string }> {
  const task = await db.task.findFirst({
    where: { id, userId },
    select: { id: true, dueDate: true },
  })
  if (!task) throw new Error("not found")

  const today = todayISO()
  const current = dateColumnToISO(task.dueDate)
  const base = !current || current < today ? today : current
  const dueDate = addDaysISO(base, days)

  await db.task.update({
    where: { id: task.id },
    data: { dueDate: isoToDateColumn(dueDate) },
  })

  revalidateTasks()
  return { id: task.id, dueDate }
}
