import { z } from "zod"

import {
  cuid,
  optionalClock,
  optionalId,
  optionalIsoDate,
  optionalText,
  requiredText,
  tagNames,
} from "@/schemas/common"

export const taskStatus = z.enum(["TODO", "IN_PROGRESS", "DONE"])
export const taskPriority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
export const taskRecurrence = z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"])

export const taskInputSchema = z.object({
  title: requiredText(200),
  description: optionalText(2000),
  status: taskStatus.default("TODO"),
  priority: taskPriority.default("MEDIUM"),
  dueDate: optionalIsoDate,
  dueTime: optionalClock,
  recurrence: taskRecurrence.default("NONE"),
  projectId: optionalId,
  subjectId: optionalId,
  category: optionalText(60),
  notes: optionalText(5000),
  tags: tagNames,
})

export const createTaskSchema = taskInputSchema

export const updateTaskSchema = taskInputSchema.extend({ id: cuid })

export const taskIdSchema = z.object({ id: cuid })

export const taskIdsSchema = z.object({
  ids: z.array(cuid).min(1).max(200),
})

export const toggleTaskSchema = z.object({
  id: cuid,
  done: z.boolean(),
})

export const moveTaskSchema = z.object({
  id: cuid,
  status: taskStatus,
  /** ترتيب المعرّفات داخل العمود بعد الإفلات */
  order: z.array(cuid).max(500).default([]),
})

export const bulkUpdateSchema = z.object({
  ids: z.array(cuid).min(1).max(200),
  status: taskStatus.optional(),
  priority: taskPriority.optional(),
})

export const subtaskCreateSchema = z.object({
  taskId: cuid,
  title: requiredText(200),
})

export const subtaskToggleSchema = z.object({
  id: cuid,
  done: z.boolean(),
})

export const subtaskIdSchema = z.object({ id: cuid })

export type TaskInput = z.output<typeof taskInputSchema>
export type TaskStatus = z.output<typeof taskStatus>
export type TaskPriority = z.output<typeof taskPriority>
export type TaskRecurrence = z.output<typeof taskRecurrence>

// ------------------------------------------------------------------
// معايير التصفية القادمة من searchParams
// ------------------------------------------------------------------

export const taskViewSchema = z.enum(["list", "board", "calendar"])

export const taskSortSchema = z.enum([
  "manual",
  "dueDate",
  "priority",
  "created",
  "title",
])

export const taskFiltersSchema = z.object({
  view: taskViewSchema.catch("list"),
  q: z.string().trim().max(120).optional().catch(undefined),
  status: taskStatus.optional().catch(undefined),
  priority: taskPriority.optional().catch(undefined),
  projectId: z.string().optional().catch(undefined),
  tag: z.string().optional().catch(undefined),
  sort: taskSortSchema.catch("manual"),
  archived: z
    .enum(["true", "false"])
    .catch("false")
    .transform((v) => v === "true"),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .catch(undefined),
})

export type TaskFilters = z.output<typeof taskFiltersSchema>
