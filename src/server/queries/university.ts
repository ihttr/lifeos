import "server-only"

import { db } from "@/lib/db"
import { dateColumnToISO, toISODateInTZ, todayISO } from "@/lib/dates"
import { requireUserId } from "@/server/auth"

import type { Prisma } from "@/generated/prisma/client"
import type { UniversityFilters } from "@/schemas/university"

/** "HH:mm" بتوقيت الرياض من لحظة زمنية مخزّنة بـ UTC */
function riyadhClock(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

// ------------------------------------------------------------------ الفصول

export async function getSemesters() {
  const userId = await requireUserId()

  const semesters = await db.semester.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      isActive: true,
      _count: { select: { subjects: true } },
    },
    orderBy: [{ isActive: "desc" }, { startDate: { sort: "desc", nulls: "last" } }],
  })

  return semesters.map((semester) => ({
    id: semester.id,
    name: semester.name,
    startDate: dateColumnToISO(semester.startDate),
    endDate: dateColumnToISO(semester.endDate),
    isActive: semester.isActive,
    subjectCount: semester._count.subjects,
  }))
}

export type SemesterDTO = Awaited<ReturnType<typeof getSemesters>>[number]

/** الفصل المعروض: المطلوب في الرابط، أو النشط، أو الأحدث */
export function resolveSemesterId(
  semesters: SemesterDTO[],
  requested?: string
): string | null {
  if (requested && semesters.some((s) => s.id === requested)) return requested
  return semesters.find((s) => s.isActive)?.id ?? semesters[0]?.id ?? null
}

// ------------------------------------------------------------------ المواد

export async function getSubjects(semesterId: string) {
  const userId = await requireUserId()
  const today = new Date(`${todayISO()}T00:00:00.000+03:00`)

  const subjects = await db.subject.findMany({
    where: { userId, semesterId },
    select: {
      id: true,
      name: true,
      code: true,
      instructor: true,
      credits: true,
      color: true,
      notes: true,
      assignments: {
        select: { id: true, status: true, dueDate: true, grade: true, maxGrade: true },
      },
      exams: { select: { id: true, date: true } },
      _count: { select: { tasks: true, subjectNotes: true } },
    },
    orderBy: { name: "asc" },
  })

  return subjects.map((subject) => {
    const done = subject.assignments.filter((a) => a.status === "DONE").length
    const graded = subject.assignments.filter(
      (a) => a.grade !== null && a.maxGrade !== null && a.maxGrade > 0
    )

    return {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      instructor: subject.instructor,
      credits: subject.credits,
      color: subject.color,
      notes: subject.notes,
      assignmentCount: subject.assignments.length,
      doneAssignmentCount: done,
      pendingAssignmentCount: subject.assignments.filter(
        (a) => a.status !== "DONE" && a.dueDate >= today
      ).length,
      overdueAssignmentCount: subject.assignments.filter(
        (a) => a.status !== "DONE" && a.dueDate < today
      ).length,
      upcomingExamCount: subject.exams.filter((e) => e.date >= today).length,
      taskCount: subject._count.tasks,
      noteCount: subject._count.subjectNotes,
      /** نسبة الدرجات المصحّحة — null إن لم يُصحَّح شيء بعد */
      gradeAverage:
        graded.length > 0
          ? Math.round(
              (graded.reduce((sum, a) => sum + a.grade! / a.maxGrade!, 0) /
                graded.length) *
                100
            )
          : null,
    }
  })
}

export type SubjectDTO = Awaited<ReturnType<typeof getSubjects>>[number]

// ------------------------------------------------------------------ الواجبات

const assignmentSelect = {
  id: true,
  title: true,
  description: true,
  dueDate: true,
  status: true,
  grade: true,
  maxGrade: true,
  subjectId: true,
  subject: { select: { id: true, name: true, color: true } },
} satisfies Prisma.AssignmentSelect

export type AssignmentDTO = {
  id: string
  title: string
  description: string | null
  /** "YYYY-MM-DD" بتوقيت الرياض */
  dueDate: string
  /** "HH:mm" بتوقيت الرياض */
  dueTime: string
  status: "TODO" | "IN_PROGRESS" | "DONE"
  grade: number | null
  maxGrade: number | null
  subjectId: string
  subject: { id: string; name: string; color: string | null }
}

export async function getAssignments(
  semesterId: string,
  filters: Pick<UniversityFilters, "subject" | "status"> = {}
): Promise<AssignmentDTO[]> {
  const userId = await requireUserId()

  const where: Prisma.AssignmentWhereInput = {
    userId,
    subject: { semesterId },
  }
  if (filters.subject) where.subjectId = filters.subject
  if (filters.status) where.status = filters.status

  const assignments = await db.assignment.findMany({
    where,
    select: assignmentSelect,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    take: 300,
  })

  return assignments.map((assignment) => ({
    ...assignment,
    dueDate: toISODateInTZ(assignment.dueDate),
    dueTime: riyadhClock(assignment.dueDate),
  }))
}

// ------------------------------------------------------------------ الاختبارات

export type ExamDTO = {
  id: string
  title: string
  date: string
  time: string
  location: string | null
  weight: number | null
  notes: string | null
  subjectId: string
  subject: { id: string; name: string; color: string | null }
}

export async function getExams(
  semesterId: string,
  filters: Pick<UniversityFilters, "subject"> = {}
): Promise<ExamDTO[]> {
  const userId = await requireUserId()

  const where: Prisma.ExamWhereInput = { userId, subject: { semesterId } }
  if (filters.subject) where.subjectId = filters.subject

  const exams = await db.exam.findMany({
    where,
    select: {
      id: true,
      title: true,
      date: true,
      location: true,
      weight: true,
      notes: true,
      subjectId: true,
      subject: { select: { id: true, name: true, color: true } },
    },
    orderBy: { date: "asc" },
    take: 200,
  })

  return exams.map((exam) => ({
    ...exam,
    date: toISODateInTZ(exam.date),
    time: riyadhClock(exam.date),
  }))
}

// ------------------------------------------------------------------ الملخّص

export async function getUniversitySummary(semesterId: string) {
  const userId = await requireUserId()
  const today = new Date(`${todayISO()}T00:00:00.000+03:00`)

  const [subjects, pending, overdue, upcomingExams, credits] = await Promise.all([
    db.subject.count({ where: { userId, semesterId } }),
    db.assignment.count({
      where: {
        userId,
        subject: { semesterId },
        status: { not: "DONE" },
        dueDate: { gte: today },
      },
    }),
    db.assignment.count({
      where: {
        userId,
        subject: { semesterId },
        status: { not: "DONE" },
        dueDate: { lt: today },
      },
    }),
    db.exam.count({
      where: { userId, subject: { semesterId }, date: { gte: today } },
    }),
    db.subject.aggregate({
      where: { userId, semesterId },
      _sum: { credits: true },
    }),
  ])

  return {
    subjects,
    pending,
    overdue,
    upcomingExams,
    credits: credits._sum.credits ?? 0,
  }
}
