import "server-only"

import { db } from "@/lib/db"
import {
  addDaysISO,
  riyadhDateTimeToUTC,
  toISODateInTZ,
  todayISO,
} from "@/lib/dates"
import { PATHS, revalidate } from "@/server/revalidate"

import type { WorkStatus } from "@/schemas/university"

/**
 * كتابة الجامعة بمستخدم صريح — نظير src/server/core/tasks.ts، ولنفس السبب:
 * ملف الإجراءات عليه "use server" فلا يصلح أن يشارك منطقه مع البوت.
 */

export function revalidateUniversity() {
  revalidate(PATHS.university, PATHS.dashboard, PATHS.calendar, PATHS.tasks)
}

async function assertOwnsSubject(subjectId: string, userId: string) {
  const count = await db.subject.count({ where: { id: subjectId, userId } })
  if (count === 0) throw new Error("subject not owned")
}

/**
 * مواد الفصل النشط — ما يطابقه البوت عند ذكر اسم مادة.
 *
 * نقتصر على النشط عمداً: مواد الفصول السابقة تبقى للأرشيف، وإدخالها في
 * المطابقة يجعل «واجب الشبكات» يصيب مادة فصلٍ منتهٍ.
 */
export async function getActiveSubjects(userId: string) {
  const semester = await db.semester.findFirst({
    where: { userId, isActive: true },
    select: { id: true },
  })

  return db.subject.findMany({
    where: { userId, ...(semester ? { semesterId: semester.id } : {}) },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  })
}

export async function createAssignmentFor(
  userId: string,
  input: {
    subjectId: string
    title: string
    dueDate: string
    dueTime?: string
  }
) {
  await assertOwnsSubject(input.subjectId, userId)

  const assignment = await db.assignment.create({
    data: {
      userId,
      subjectId: input.subjectId,
      title: input.title,
      // الوقت الافتراضي نهاية اليوم بتوقيت الرياض
      dueDate: riyadhDateTimeToUTC(input.dueDate, input.dueTime ?? "23:59"),
      status: "TODO",
    },
    select: { id: true },
  })

  revalidateUniversity()
  return assignment
}

export async function createExamFor(
  userId: string,
  input: { subjectId: string; title: string; date: string; time?: string }
) {
  await assertOwnsSubject(input.subjectId, userId)

  const exam = await db.exam.create({
    data: {
      userId,
      subjectId: input.subjectId,
      title: input.title,
      // الاختبار بلا وقت محدد يُفترض صباحياً، لا آخر الليل
      date: riyadhDateTimeToUTC(input.date, input.time ?? "08:00"),
    },
    select: { id: true },
  })

  revalidateUniversity()
  return exam
}

export async function setAssignmentStatusFor(
  userId: string,
  id: string,
  status: WorkStatus
) {
  const { count } = await db.assignment.updateMany({
    where: { id, userId },
    data: { status },
  })
  if (count === 0) throw new Error("not found")

  revalidateUniversity()
  return { id }
}

/** يؤجّل الواجب أياماً — بنفس منطق المهام: لا يبقى الموعد في الماضي */
export async function postponeAssignmentFor(
  userId: string,
  id: string,
  days: number
): Promise<{ id: string; dueDate: string }> {
  const assignment = await db.assignment.findFirst({
    where: { id, userId },
    select: { id: true, dueDate: true },
  })
  if (!assignment) throw new Error("not found")

  const today = todayISO()
  const current = toISODateInTZ(assignment.dueDate)
  const base = current < today ? today : current
  const dueDate = addDaysISO(base, days)

  await db.assignment.update({
    where: { id: assignment.id },
    data: { dueDate: riyadhDateTimeToUTC(dueDate, "23:59") },
  })

  revalidateUniversity()
  return { id: assignment.id, dueDate }
}
