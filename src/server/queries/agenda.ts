import "server-only"

import { db } from "@/lib/db"
import { dateColumnToISO, toISODateInTZ, todayISO } from "@/lib/dates"
import { requireUserId } from "@/server/auth"

import type { ISODate } from "@/lib/dates"

/**
 * كل ما له موعد في التطبيق، مجمّعاً في شكل واحد.
 *
 * لا يوجد جدول CalendarEvent — الأحداث مشتقة من الجداول الأصلية،
 * فلا تتعارض نسخة محفوظة مع الواقع، ولا نحتاج مزامنة.
 *
 * تستخدمه: لوحة التحكم، التقويم الموحد، والإشعارات.
 */

export type AgendaKind = "task" | "assignment" | "exam" | "project" | "goal"

export type AgendaItem = {
  id: string
  kind: AgendaKind
  title: string
  date: ISODate
  /** "HH:mm" بتوقيت الرياض، إن وُجد */
  time: string | null
  done: boolean
  color: string | null
  /** المادة أو المشروع الذي ينتمي إليه العنصر */
  context: string | null
  href: string
}

const KIND_COLOR: Record<AgendaKind, string> = {
  task: "var(--chart-1)",
  assignment: "var(--chart-3)",
  exam: "var(--destructive)",
  project: "var(--chart-2)",
  goal: "var(--chart-5)",
}

export async function getAgenda({
  from,
  to,
  includeDone = true,
}: {
  from: ISODate
  to: ISODate
  includeDone?: boolean
}): Promise<AgendaItem[]> {
  const userId = await requireUserId()

  const fromDate = new Date(`${from}T00:00:00.000Z`)
  const toDate = new Date(`${to}T23:59:59.999Z`)

  const [tasks, assignments, exams, projects, goals] = await Promise.all([
    db.task.findMany({
      where: {
        userId,
        archivedAt: null,
        dueDate: { gte: fromDate, lte: toDate },
        ...(includeDone ? {} : { status: { not: "DONE" } }),
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        dueTime: true,
        status: true,
        project: { select: { name: true, color: true } },
      },
      take: 400,
    }),

    db.assignment.findMany({
      where: {
        userId,
        dueDate: { gte: fromDate, lte: toDate },
        ...(includeDone ? {} : { status: { not: "DONE" } }),
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        subject: { select: { name: true, color: true } },
      },
      take: 200,
    }),

    db.exam.findMany({
      where: { userId, date: { gte: fromDate, lte: toDate } },
      select: {
        id: true,
        title: true,
        date: true,
        subject: { select: { name: true, color: true } },
      },
      take: 100,
    }),

    db.project.findMany({
      where: {
        userId,
        deadline: { gte: fromDate, lte: toDate },
        status: { notIn: ["ARCHIVED"] },
      },
      select: {
        id: true,
        name: true,
        deadline: true,
        status: true,
        color: true,
      },
      take: 100,
    }),

    db.goal.findMany({
      where: { userId, deadline: { gte: fromDate, lte: toDate } },
      select: { id: true, title: true, deadline: true, status: true },
      take: 100,
    }),
  ])

  const items: AgendaItem[] = [
    ...tasks.map((task) => ({
      id: `task:${task.id}`,
      kind: "task" as const,
      title: task.title,
      date: dateColumnToISO(task.dueDate) as ISODate,
      time: task.dueTime,
      done: task.status === "DONE",
      color: task.project?.color ?? KIND_COLOR.task,
      context: task.project?.name ?? null,
      href: "/tasks",
    })),

    ...assignments.map((assignment) => ({
      id: `assignment:${assignment.id}`,
      kind: "assignment" as const,
      title: assignment.title,
      date: toISODateInTZ(assignment.dueDate),
      time: null,
      done: assignment.status === "DONE",
      color: assignment.subject.color ?? KIND_COLOR.assignment,
      context: assignment.subject.name,
      href: "/university",
    })),

    ...exams.map((exam) => ({
      id: `exam:${exam.id}`,
      kind: "exam" as const,
      title: exam.title,
      date: toISODateInTZ(exam.date),
      time: new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(exam.date),
      done: false,
      color: KIND_COLOR.exam,
      context: exam.subject.name,
      href: "/university",
    })),

    ...projects.map((project) => ({
      id: `project:${project.id}`,
      kind: "project" as const,
      title: project.name,
      date: dateColumnToISO(project.deadline) as ISODate,
      time: null,
      done: project.status === "COMPLETED",
      color: project.color ?? KIND_COLOR.project,
      context: null,
      href: `/projects/${project.id}`,
    })),

    ...goals.map((goal) => ({
      id: `goal:${goal.id}`,
      kind: "goal" as const,
      title: goal.title,
      date: dateColumnToISO(goal.deadline) as ISODate,
      time: null,
      done: goal.status === "COMPLETED",
      color: KIND_COLOR.goal,
      context: null,
      href: "/goals",
    })),
  ]

  return items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    return (a.time ?? "99:99").localeCompare(b.time ?? "99:99")
  })
}

/** القادم خلال أيام — لبطاقة "القادم" في لوحة التحكم */
export async function getUpcoming(days = 14, limit = 8) {
  const today = todayISO()
  const end = new Date(`${today}T00:00:00.000Z`)
  end.setUTCDate(end.getUTCDate() + days)

  const items = await getAgenda({
    from: today,
    to: end.toISOString().slice(0, 10),
    includeDone: false,
  })

  return items.filter((item) => !item.done).slice(0, limit)
}
