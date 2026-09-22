import "server-only"

import { db } from "@/lib/db"
import { dateColumnToISO, todayISO } from "@/lib/dates"
import { requireUserId } from "@/server/auth"

import type { Prisma } from "@/generated/prisma/client"
import type { TaskFilters } from "@/schemas/task"

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  dueTime: true,
  recurrence: true,
  category: true,
  notes: true,
  position: true,
  completedAt: true,
  archivedAt: true,
  createdAt: true,
  projectId: true,
  subjectId: true,
  project: { select: { id: true, name: true, color: true } },
  subject: { select: { id: true, name: true, color: true } },
  tags: { select: { id: true, name: true, color: true } },
  subtasks: {
    select: { id: true, title: true, done: true, position: true },
    orderBy: { position: "asc" },
  },
} satisfies Prisma.TaskSelect

type RawTask = Prisma.TaskGetPayload<{ select: typeof taskSelect }>

/** شكل المهمة في الواجهة — التواريخ سلاسل ISO لا كائنات Date */
export type TaskDTO = Omit<RawTask, "dueDate" | "completedAt" | "createdAt"> & {
  dueDate: string | null
  completedAt: string | null
  createdAt: string
}

function toDTO(task: RawTask): TaskDTO {
  return {
    ...task,
    dueDate: dateColumnToISO(task.dueDate),
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
  }
}

function buildWhere(userId: string, filters: TaskFilters): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {
    userId,
    archivedAt: filters.archived ? { not: null } : null,
  }

  if (filters.status) where.status = filters.status
  if (filters.priority) where.priority = filters.priority
  if (filters.projectId) where.projectId = filters.projectId
  if (filters.tag) where.tags = { some: { name: filters.tag } }

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
      { notes: { contains: filters.q, mode: "insensitive" } },
    ]
  }

  if (filters.month) {
    const start = new Date(`${filters.month}-01T00:00:00.000Z`)
    const end = new Date(start)
    end.setUTCMonth(end.getUTCMonth() + 1)
    where.dueDate = { gte: start, lt: end }
  }

  return where
}

function buildOrderBy(
  sort: TaskFilters["sort"]
): Prisma.TaskOrderByWithRelationInput[] {
  switch (sort) {
    case "dueDate":
      return [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }]
    case "priority":
      // ترتيب enum يتبع ترتيب التعريف في المخطط: LOW → URGENT
      return [{ priority: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }]
    case "created":
      return [{ createdAt: "desc" }]
    case "title":
      return [{ title: "asc" }]
    default:
      return [{ position: "asc" }, { createdAt: "desc" }]
  }
}

export async function getTasks(filters: TaskFilters): Promise<TaskDTO[]> {
  const userId = await requireUserId()

  const tasks = await db.task.findMany({
    where: buildWhere(userId, filters),
    orderBy: buildOrderBy(filters.sort),
    select: taskSelect,
    take: 500,
  })

  return tasks.map(toDTO)
}

export async function getTask(id: string): Promise<TaskDTO | null> {
  const userId = await requireUserId()

  // الفلترة بـ userId هنا هي ما يمنع الوصول لمهمة مستخدم آخر
  const task = await db.task.findFirst({
    where: { id, userId },
    select: taskSelect,
  })

  return task ? toDTO(task) : null
}

/** المشاريع والمواد والوسوم المتاحة لنماذج المهام */
export async function getTaskFormOptions() {
  const userId = await requireUserId()

  const [projects, subjects, tags] = await Promise.all([
    db.project.findMany({
      where: { userId, status: { notIn: ["ARCHIVED", "COMPLETED"] } },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    db.subject.findMany({
      where: { userId, semester: { isActive: true } },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    db.tag.findMany({
      where: { userId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ])

  return { projects, subjects, tags }
}

/** مهام اليوم والمتأخرة — تستخدمها لوحة التحكم */
export async function getTodayTasks(): Promise<TaskDTO[]> {
  const userId = await requireUserId()
  const today = new Date(`${todayISO()}T00:00:00.000Z`)
  const tomorrow = new Date(today)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

  const tasks = await db.task.findMany({
    where: {
      userId,
      archivedAt: null,
      OR: [
        { dueDate: { lt: tomorrow }, status: { not: "DONE" } },
        { dueDate: { gte: today, lt: tomorrow } },
      ],
    },
    orderBy: [
      { status: "asc" },
      { priority: "desc" },
      { dueDate: { sort: "asc", nulls: "last" } },
    ],
    select: taskSelect,
    take: 50,
  })

  return tasks.map(toDTO)
}

export async function getTaskCounts() {
  const userId = await requireUserId()
  const today = new Date(`${todayISO()}T00:00:00.000Z`)
  const tomorrow = new Date(today)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

  const [remaining, doneToday, overdue] = await Promise.all([
    db.task.count({
      where: {
        userId,
        archivedAt: null,
        status: { not: "DONE" },
        dueDate: { lt: tomorrow },
      },
    }),
    db.task.count({
      where: { userId, archivedAt: null, completedAt: { gte: today } },
    }),
    db.task.count({
      where: {
        userId,
        archivedAt: null,
        status: { not: "DONE" },
        dueDate: { lt: today },
      },
    }),
  ])

  return { remaining, doneToday, overdue }
}
