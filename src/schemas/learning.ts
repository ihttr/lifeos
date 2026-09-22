import { z } from "zod"

import { cuid, httpUrl, optionalText, requiredText } from "@/schemas/common"

export const pathStatus = z.enum(["ACTIVE", "COMPLETED", "PAUSED"])

export const resourceType = z.enum([
  "YOUTUBE",
  "WEBSITE",
  "DOCS",
  "COURSE",
  "GITHUB",
  "OTHER",
])

export const pathInputSchema = z.object({
  title: requiredText(200),
  description: optionalText(2000),
  category: optionalText(60),
  color: optionalText(40),
  status: pathStatus.default("ACTIVE"),
})

export const createPathSchema = pathInputSchema
export const updatePathSchema = pathInputSchema.extend({ id: cuid })
export const pathIdSchema = z.object({ id: cuid })

export const sectionCreateSchema = z.object({
  learningPathId: cuid,
  title: requiredText(200),
})

export const sectionIdSchema = z.object({ id: cuid })

export const lessonCreateSchema = z.object({
  sectionId: cuid,
  title: requiredText(200),
})

export const lessonToggleSchema = z.object({
  id: cuid,
  done: z.boolean(),
})

export const lessonIdSchema = z.object({ id: cuid })

export const resourceCreateSchema = z.object({
  learningPathId: cuid,
  title: requiredText(200),
  url: httpUrl,
  type: resourceType.default("WEBSITE"),
})

export const resourceIdSchema = z.object({ id: cuid })

export const learningFiltersSchema = z.object({
  status: pathStatus.optional().catch(undefined),
  open: z.string().optional().catch(undefined),
})

export type PathStatus = z.output<typeof pathStatus>
export type ResourceType = z.output<typeof resourceType>
export type LearningFilters = z.output<typeof learningFiltersSchema>
