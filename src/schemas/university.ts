import { z } from "zod"

import {
  cuid,
  isoDate,
  optionalClock,
  optionalIsoDate,
  optionalText,
  requiredText,
} from "@/schemas/common"

export const workStatus = z.enum(["TODO", "IN_PROGRESS", "DONE"])

// ------------------------------------------------------------------ الفصول

export const semesterInputSchema = z.object({
  name: requiredText(80),
  startDate: optionalIsoDate,
  endDate: optionalIsoDate,
})

export const createSemesterSchema = semesterInputSchema
export const updateSemesterSchema = semesterInputSchema.extend({ id: cuid })
export const semesterIdSchema = z.object({ id: cuid })

// ------------------------------------------------------------------ المواد

export const subjectInputSchema = z.object({
  semesterId: cuid,
  name: requiredText(120),
  code: optionalText(20),
  instructor: optionalText(120),
  credits: z.coerce
    .number({ error: "errors.validation" })
    .int({ error: "errors.validation" })
    .min(0, { error: "errors.validation" })
    .max(12, { error: "errors.validation" })
    .default(3),
  color: optionalText(40),
  notes: optionalText(2000),
})

export const createSubjectSchema = subjectInputSchema
export const updateSubjectSchema = subjectInputSchema.extend({ id: cuid })
export const subjectIdSchema = z.object({ id: cuid })

// ------------------------------------------------------------------ الواجبات

/** الدرجة اختيارية، ونقبل الفراغ لأن الواجب قد يكون غير مصحّح بعد */
const optionalGrade = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  })
  .refine((value) => value === null || (value >= 0 && value <= 1000), {
    error: "errors.validation",
  })

export const assignmentInputSchema = z.object({
  subjectId: cuid,
  title: requiredText(200),
  description: optionalText(2000),
  dueDate: isoDate,
  dueTime: optionalClock,
  status: workStatus.default("TODO"),
  grade: optionalGrade,
  maxGrade: optionalGrade,
})

export const createAssignmentSchema = assignmentInputSchema
export const updateAssignmentSchema = assignmentInputSchema.extend({ id: cuid })
export const assignmentIdSchema = z.object({ id: cuid })

export const assignmentStatusSchema = z.object({
  id: cuid,
  status: workStatus,
})

// ------------------------------------------------------------------ الاختبارات

export const examInputSchema = z.object({
  subjectId: cuid,
  title: requiredText(200),
  date: isoDate,
  time: optionalClock,
  location: optionalText(120),
  weight: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") return null
      const parsed = Number(value)
      return Number.isFinite(parsed) ? Math.round(parsed) : null
    })
    .refine((value) => value === null || (value >= 0 && value <= 100), {
      error: "errors.validation",
    }),
  notes: optionalText(2000),
})

export const createExamSchema = examInputSchema
export const updateExamSchema = examInputSchema.extend({ id: cuid })
export const examIdSchema = z.object({ id: cuid })

// ------------------------------------------------------------------ التصفية

export const universityTabSchema = z.enum([
  "subjects",
  "assignments",
  "exams",
  "calendar",
])

export const universityFiltersSchema = z.object({
  tab: universityTabSchema.catch("subjects"),
  semester: z.string().optional().catch(undefined),
  subject: z.string().optional().catch(undefined),
  status: workStatus.optional().catch(undefined),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .catch(undefined),
})

export type UniversityFilters = z.output<typeof universityFiltersSchema>
export type WorkStatus = z.output<typeof workStatus>
