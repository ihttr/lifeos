"use server"

import { db } from "@/lib/db"
import { isoToDateColumn, riyadhDateTimeToUTC } from "@/lib/dates"
import { createAction } from "@/lib/safe-action"
import {
  assignmentIdSchema,
  assignmentStatusSchema,
  createAssignmentSchema,
  createExamSchema,
  createSemesterSchema,
  createSubjectSchema,
  examIdSchema,
  semesterIdSchema,
  subjectIdSchema,
  updateAssignmentSchema,
  updateExamSchema,
  updateSemesterSchema,
  updateSubjectSchema,
} from "@/schemas/university"
import { PATHS, revalidate } from "@/server/revalidate"

function revalidateUniversity() {
  revalidate(PATHS.university, PATHS.dashboard, PATHS.calendar, PATHS.tasks)
}

/** يمنع ربط أي سجل بفصل أو مادة يخصّان مستخدماً آخر */
async function assertOwnsSemester(semesterId: string, userId: string) {
  const count = await db.semester.count({ where: { id: semesterId, userId } })
  if (count === 0) throw new Error("semester not owned")
}

async function assertOwnsSubject(subjectId: string, userId: string) {
  const count = await db.subject.count({ where: { id: subjectId, userId } })
  if (count === 0) throw new Error("subject not owned")
}

// ------------------------------------------------------------------ الفصول

export const createSemester = createAction(
  createSemesterSchema,
  async (input, userId) => {
    const existing = await db.semester.count({ where: { userId } })

    const semester = await db.semester.create({
      data: {
        userId,
        name: input.name,
        startDate: isoToDateColumn(input.startDate),
        endDate: isoToDateColumn(input.endDate),
        // أول فصل يُنشأ يصبح النشط تلقائياً
        isActive: existing === 0,
      },
      select: { id: true },
    })

    revalidateUniversity()
    return semester
  }
)

export const updateSemester = createAction(
  updateSemesterSchema,
  async (input, userId) => {
    const { count } = await db.semester.updateMany({
      where: { id: input.id, userId },
      data: {
        name: input.name,
        startDate: isoToDateColumn(input.startDate),
        endDate: isoToDateColumn(input.endDate),
      },
    })
    if (count === 0) throw new Error("not found")

    revalidateUniversity()
    return { id: input.id }
  }
)

/** فصل نشط واحد فقط — نلغي تنشيط البقية في نفس المعاملة */
export const activateSemester = createAction(
  semesterIdSchema,
  async ({ id }, userId) => {
    await assertOwnsSemester(id, userId)

    await db.$transaction([
      db.semester.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      }),
      db.semester.updateMany({ where: { id, userId }, data: { isActive: true } }),
    ])

    revalidateUniversity()
    return { id }
  }
)

export const deleteSemester = createAction(
  semesterIdSchema,
  async ({ id }, userId) => {
    // Cascade يحذف المواد وواجباتها واختباراتها
    const { count } = await db.semester.deleteMany({ where: { id, userId } })
    if (count === 0) throw new Error("not found")

    revalidateUniversity()
    return { id }
  }
)

// ------------------------------------------------------------------ المواد

export const createSubject = createAction(
  createSubjectSchema,
  async (input, userId) => {
    await assertOwnsSemester(input.semesterId, userId)

    const subject = await db.subject.create({
      data: {
        userId,
        semesterId: input.semesterId,
        name: input.name,
        code: input.code,
        instructor: input.instructor,
        credits: input.credits,
        color: input.color,
        notes: input.notes,
      },
      select: { id: true },
    })

    revalidateUniversity()
    return subject
  }
)

export const updateSubject = createAction(
  updateSubjectSchema,
  async (input, userId) => {
    await assertOwnsSemester(input.semesterId, userId)

    const { count } = await db.subject.updateMany({
      where: { id: input.id, userId },
      data: {
        semesterId: input.semesterId,
        name: input.name,
        code: input.code,
        instructor: input.instructor,
        credits: input.credits,
        color: input.color,
        notes: input.notes,
      },
    })
    if (count === 0) throw new Error("not found")

    revalidateUniversity()
    return { id: input.id }
  }
)

export const deleteSubject = createAction(
  subjectIdSchema,
  async ({ id }, userId) => {
    // المهام والملاحظات المرتبطة تبقى، ويصبح ارتباطها null (onDelete: SetNull)
    const { count } = await db.subject.deleteMany({ where: { id, userId } })
    if (count === 0) throw new Error("not found")

    revalidateUniversity()
    return { id }
  }
)

// ------------------------------------------------------------------ الواجبات

export const createAssignment = createAction(
  createAssignmentSchema,
  async (input, userId) => {
    await assertOwnsSubject(input.subjectId, userId)

    const assignment = await db.assignment.create({
      data: {
        userId,
        subjectId: input.subjectId,
        title: input.title,
        description: input.description,
        // الوقت الافتراضي نهاية اليوم بتوقيت الرياض
        dueDate: riyadhDateTimeToUTC(input.dueDate, input.dueTime ?? "23:59"),
        status: input.status,
        grade: input.grade,
        maxGrade: input.maxGrade,
      },
      select: { id: true },
    })

    revalidateUniversity()
    return assignment
  }
)

export const updateAssignment = createAction(
  updateAssignmentSchema,
  async (input, userId) => {
    await assertOwnsSubject(input.subjectId, userId)

    const { count } = await db.assignment.updateMany({
      where: { id: input.id, userId },
      data: {
        subjectId: input.subjectId,
        title: input.title,
        description: input.description,
        dueDate: riyadhDateTimeToUTC(input.dueDate, input.dueTime ?? "23:59"),
        status: input.status,
        grade: input.grade,
        maxGrade: input.maxGrade,
      },
    })
    if (count === 0) throw new Error("not found")

    revalidateUniversity()
    return { id: input.id }
  }
)

export const setAssignmentStatus = createAction(
  assignmentStatusSchema,
  async ({ id, status }, userId) => {
    const { count } = await db.assignment.updateMany({
      where: { id, userId },
      data: { status },
    })
    if (count === 0) throw new Error("not found")

    revalidateUniversity()
    return { id }
  }
)

export const deleteAssignment = createAction(
  assignmentIdSchema,
  async ({ id }, userId) => {
    const { count } = await db.assignment.deleteMany({ where: { id, userId } })
    if (count === 0) throw new Error("not found")

    revalidateUniversity()
    return { id }
  }
)

// ------------------------------------------------------------------ الاختبارات

export const createExam = createAction(
  createExamSchema,
  async (input, userId) => {
    await assertOwnsSubject(input.subjectId, userId)

    const exam = await db.exam.create({
      data: {
        userId,
        subjectId: input.subjectId,
        title: input.title,
        date: riyadhDateTimeToUTC(input.date, input.time ?? "08:00"),
        location: input.location,
        weight: input.weight,
        notes: input.notes,
      },
      select: { id: true },
    })

    revalidateUniversity()
    return exam
  }
)

export const updateExam = createAction(
  updateExamSchema,
  async (input, userId) => {
    await assertOwnsSubject(input.subjectId, userId)

    const { count } = await db.exam.updateMany({
      where: { id: input.id, userId },
      data: {
        subjectId: input.subjectId,
        title: input.title,
        date: riyadhDateTimeToUTC(input.date, input.time ?? "08:00"),
        location: input.location,
        weight: input.weight,
        notes: input.notes,
      },
    })
    if (count === 0) throw new Error("not found")

    revalidateUniversity()
    return { id: input.id }
  }
)

export const deleteExam = createAction(examIdSchema, async ({ id }, userId) => {
  const { count } = await db.exam.deleteMany({ where: { id, userId } })
  if (count === 0) throw new Error("not found")

  revalidateUniversity()
  return { id }
})
