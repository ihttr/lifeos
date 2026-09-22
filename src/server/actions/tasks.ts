"use server"

import { db } from "@/lib/db"
import { addDaysISO, addMonthsISO, isoToDateColumn } from "@/lib/dates"
import { createAction } from "@/lib/safe-action"
import {
  bulkUpdateSchema,
  createTaskSchema,
  moveTaskSchema,
  subtaskCreateSchema,
  subtaskIdSchema,
  subtaskToggleSchema,
  taskIdSchema,
  taskIdsSchema,
  toggleTaskSchema,
  updateTaskSchema,
} from "@/schemas/task"
import { revalidateTasks } from "@/server/revalidate"

import type { Recurrence } from "@/generated/prisma/enums"
import type { TaskInput } from "@/schemas/task"

// ------------------------------------------------------------------ helpers

/**
 * يتحقق أن المشروع/المادة المرتبطين يخصّان المستخدم نفسه.
 * بدون هذا يمكن لمستخدم ربط مهمته بمشروع مستخدم آخر عبر تعديل الطلب.
 */
async function assertOwnedRelations(input: TaskInput, userId: string) {
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
function tagConnect(tags: string[], userId: string) {
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

// ------------------------------------------------------------------ CRUD

export const createTask = createAction(
  createTaskSchema,
  async (input, userId) => {
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
)

export const updateTask = createAction(
  updateTaskSchema,
  async (input, userId) => {
    await assertOwnedRelations(input, userId)

    const existing = await db.task.findFirst({
      where: { id: input.id, userId },
      select: { id: true, status: true, completedAt: true },
    })
    if (!existing) throw new Error("not found")

    const becameDone = input.status === "DONE" && existing.status !== "DONE"
    const leftDone = input.status !== "DONE" && existing.status === "DONE"

    await db.task.update({
      where: { id: existing.id },
      data: {
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
        completedAt: becameDone
          ? new Date()
          : leftDone
            ? null
            : existing.completedAt,
        tags: {
          set: [],
          connectOrCreate: tagConnect(input.tags, userId),
        },
      },
    })

    revalidateTasks()
    return { id: existing.id }
  }
)

export const deleteTask = createAction(taskIdSchema, async ({ id }, userId) => {
  // deleteMany مع userId يجعل العملية آمنة ذرياً: صفر صفوف إن لم تكن ملكه
  const { count } = await db.task.deleteMany({ where: { id, userId } })
  if (count === 0) throw new Error("not found")

  revalidateTasks()
  return { id }
})

export const duplicateTask = createAction(
  taskIdSchema,
  async ({ id }, userId) => {
    const source = await db.task.findFirst({
      where: { id, userId },
      include: { subtasks: true, tags: { select: { id: true } } },
    })
    if (!source) throw new Error("not found")

    const copy = await db.task.create({
      data: {
        userId,
        title: `${source.title} (2)`,
        description: source.description,
        status: "TODO",
        priority: source.priority,
        dueDate: source.dueDate,
        dueTime: source.dueTime,
        recurrence: source.recurrence,
        category: source.category,
        notes: source.notes,
        projectId: source.projectId,
        subjectId: source.subjectId,
        position: source.position - 1,
        tags: { connect: source.tags.map((t) => ({ id: t.id })) },
        subtasks: {
          create: source.subtasks.map((s) => ({
            title: s.title,
            done: false,
            position: s.position,
          })),
        },
      },
      select: { id: true },
    })

    revalidateTasks()
    return copy
  }
)

// ------------------------------------------------------------------ الحالة

export const toggleTask = createAction(
  toggleTaskSchema,
  async ({ id, done }, userId) => {
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
      return { id, spawned: null as string | null }
    }

    await db.task.update({
      where: { id },
      data: { status: "DONE", completedAt: new Date() },
    })

    // المهمة المتكررة تلد نسختها التالية عند إنجازها
    let spawned: string | null = null
    const dueIso = task.dueDate?.toISOString().slice(0, 10) ?? null

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
)

export const moveTask = createAction(
  moveTaskSchema,
  async ({ id, status, order }, userId) => {
    const task = await db.task.findFirst({
      where: { id, userId },
      select: { id: true, status: true },
    })
    if (!task) throw new Error("not found")

    const enteringDone = status === "DONE" && task.status !== "DONE"
    const leavingDone = status !== "DONE" && task.status === "DONE"

    await db.$transaction([
      db.task.update({
        where: { id },
        data: {
          status,
          completedAt: enteringDone
            ? new Date()
            : leavingDone
              ? null
              : undefined,
        },
      }),
      // إعادة ترتيب العمود — updateMany مقيّد بـ userId
      ...order.map((taskId, index) =>
        db.task.updateMany({
          where: { id: taskId, userId },
          data: { position: index },
        })
      ),
    ])

    revalidateTasks()
    return { id }
  }
)

// ------------------------------------------------------------------ جماعي

export const bulkUpdateTasks = createAction(
  bulkUpdateSchema,
  async ({ ids, status, priority }, userId) => {
    const { count } = await db.task.updateMany({
      where: { id: { in: ids }, userId },
      data: {
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(status === "DONE" ? { completedAt: new Date() } : {}),
        ...(status && status !== "DONE" ? { completedAt: null } : {}),
      },
    })

    revalidateTasks()
    return { count }
  }
)

export const archiveTasks = createAction(
  taskIdsSchema,
  async ({ ids }, userId) => {
    const { count } = await db.task.updateMany({
      where: { id: { in: ids }, userId, archivedAt: null },
      data: { archivedAt: new Date() },
    })

    revalidateTasks()
    return { count }
  }
)

export const unarchiveTasks = createAction(
  taskIdsSchema,
  async ({ ids }, userId) => {
    const { count } = await db.task.updateMany({
      where: { id: { in: ids }, userId, archivedAt: { not: null } },
      data: { archivedAt: null },
    })

    revalidateTasks()
    return { count }
  }
)

export const deleteTasks = createAction(
  taskIdsSchema,
  async ({ ids }, userId) => {
    const { count } = await db.task.deleteMany({
      where: { id: { in: ids }, userId },
    })

    revalidateTasks()
    return { count }
  }
)

// ------------------------------------------------------------------ فرعية

export const addSubtask = createAction(
  subtaskCreateSchema,
  async ({ taskId, title }, userId) => {
    const task = await db.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true, _count: { select: { subtasks: true } } },
    })
    if (!task) throw new Error("not found")

    const subtask = await db.subtask.create({
      data: { taskId, title, position: task._count.subtasks },
      select: { id: true },
    })

    revalidateTasks()
    return subtask
  }
)

export const toggleSubtask = createAction(
  subtaskToggleSchema,
  async ({ id, done }, userId) => {
    // التحقق عبر المهمة الأم — لا يوجد userId على Subtask
    const { count } = await db.subtask.updateMany({
      where: { id, task: { userId } },
      data: { done },
    })
    if (count === 0) throw new Error("not found")

    revalidateTasks()
    return { id }
  }
)

export const deleteSubtask = createAction(
  subtaskIdSchema,
  async ({ id }, userId) => {
    const { count } = await db.subtask.deleteMany({
      where: { id, task: { userId } },
    })
    if (count === 0) throw new Error("not found")

    revalidateTasks()
    return { id }
  }
)
