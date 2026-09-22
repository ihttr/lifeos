"use server"

import { z } from "zod"

import { db } from "@/lib/db"
import { dateColumnToISO, toISODateInTZ } from "@/lib/dates"
import { createAction } from "@/lib/safe-action"

export type SearchKind =
  | "task"
  | "project"
  | "note"
  | "goal"
  | "subject"
  | "assignment"
  | "exam"
  | "path"
  | "bookmark"

export type SearchHit = {
  id: string
  kind: SearchKind
  title: string
  /** سطر سياق: المشروع، المادة، التصنيف… */
  context: string | null
  href: string
  done: boolean
}

const searchSchema = z.object({
  q: z.string().trim().min(1).max(100),
})

/** كل قسم يساهم بعدد محدود حتى تبقى النتائج متوازنة لا يبتلعها قسم واحد */
const PER_KIND = 5

/**
 * بحث شامل عبر كل الأقسام في استعلام متوازٍ واحد.
 *
 * `mode: "insensitive"` يجعل البحث غير حسّاس لحالة الأحرف في اللاتينية،
 * وللعربية لا فرق أصلاً. لا نستخدم بحث Postgres النصي الكامل لأن
 * محلّلاته الافتراضية لا تدعم العربية جيداً، و`contains` كافٍ لحجم
 * بيانات مستخدم واحد ويستفيد من الفهارس على userId.
 */
export const searchEverything = createAction(
  searchSchema,
  async ({ q }, userId): Promise<SearchHit[]> => {
    const like = { contains: q, mode: "insensitive" as const }

    const [
      tasks,
      projects,
      notes,
      goals,
      subjects,
      assignments,
      exams,
      paths,
      bookmarks,
    ] = await Promise.all([
      db.task.findMany({
        where: { userId, archivedAt: null, OR: [{ title: like }, { description: like }] },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          project: { select: { name: true } },
        },
        orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }],
        take: PER_KIND,
      }),

      db.project.findMany({
        where: { userId, OR: [{ name: like }, { description: like }] },
        select: { id: true, name: true, status: true },
        take: PER_KIND,
      }),

      db.note.findMany({
        where: { userId, archivedAt: null, OR: [{ title: like }, { contentMd: like }] },
        select: { id: true, title: true, category: true },
        orderBy: { updatedAt: "desc" },
        take: PER_KIND,
      }),

      db.goal.findMany({
        where: { userId, OR: [{ title: like }, { description: like }] },
        select: { id: true, title: true, status: true, category: true },
        take: PER_KIND,
      }),

      db.subject.findMany({
        where: { userId, OR: [{ name: like }, { code: like }, { instructor: like }] },
        select: { id: true, name: true, code: true },
        take: PER_KIND,
      }),

      db.assignment.findMany({
        where: { userId, OR: [{ title: like }, { description: like }] },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          subject: { select: { name: true } },
        },
        orderBy: { dueDate: "desc" },
        take: PER_KIND,
      }),

      db.exam.findMany({
        where: { userId, OR: [{ title: like }, { location: like }] },
        select: {
          id: true,
          title: true,
          date: true,
          subject: { select: { name: true } },
        },
        take: PER_KIND,
      }),

      db.learningPath.findMany({
        where: { userId, OR: [{ title: like }, { description: like }] },
        select: { id: true, title: true, category: true, status: true },
        take: PER_KIND,
      }),

      db.bookmark.findMany({
        where: { userId, OR: [{ title: like }, { description: like }, { url: like }] },
        select: { id: true, title: true, category: true, url: true },
        take: PER_KIND,
      }),
    ])

    return [
      ...tasks.map((row) => ({
        id: row.id,
        kind: "task" as const,
        title: row.title,
        context: row.project?.name ?? dateColumnToISO(row.dueDate),
        href: "/tasks",
        done: row.status === "DONE",
      })),

      ...projects.map((row) => ({
        id: row.id,
        kind: "project" as const,
        title: row.name,
        context: null,
        href: `/projects/${row.id}`,
        done: row.status === "COMPLETED",
      })),

      ...notes.map((row) => ({
        id: row.id,
        kind: "note" as const,
        title: row.title,
        context: row.category,
        href: `/notes?open=${row.id}`,
        done: false,
      })),

      ...goals.map((row) => ({
        id: row.id,
        kind: "goal" as const,
        title: row.title,
        context: row.category,
        href: "/goals",
        done: row.status === "COMPLETED",
      })),

      ...subjects.map((row) => ({
        id: row.id,
        kind: "subject" as const,
        title: row.name,
        context: row.code,
        href: "/university",
        done: false,
      })),

      ...assignments.map((row) => ({
        id: row.id,
        kind: "assignment" as const,
        title: row.title,
        context: row.subject.name,
        href: "/university?tab=assignments",
        done: row.status === "DONE",
      })),

      ...exams.map((row) => ({
        id: row.id,
        kind: "exam" as const,
        title: row.title,
        context: `${row.subject.name} · ${toISODateInTZ(row.date)}`,
        href: "/university?tab=exams",
        done: false,
      })),

      ...paths.map((row) => ({
        id: row.id,
        kind: "path" as const,
        title: row.title,
        context: row.category,
        href: "/learning",
        done: row.status === "COMPLETED",
      })),

      ...bookmarks.map((row) => ({
        id: row.id,
        kind: "bookmark" as const,
        title: row.title,
        context: row.category,
        href: "/bookmarks",
        done: false,
      })),
    ]
  }
)
