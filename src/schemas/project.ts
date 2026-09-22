import { z } from "zod"

import {
  cuid,
  optionalHttpUrl,
  optionalIsoDate,
  optionalText,
  requiredText,
} from "@/schemas/common"

export const projectStatus = z.enum([
  "PLANNING",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
])

export const projectPriority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"])

/** التقنيات تصل كنص مفصول بفواصل */
const technologies = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (!value) return [] as string[]
    const raw = Array.isArray(value) ? value : value.split(/[,،]/)
    return [...new Set(raw.map((v) => v.trim()).filter(Boolean))].slice(0, 30)
  })

export const projectInputSchema = z.object({
  name: requiredText(120),
  description: optionalText(2000),
  status: projectStatus.default("PLANNING"),
  priority: projectPriority.default("MEDIUM"),
  startDate: optionalIsoDate,
  deadline: optionalIsoDate,
  technologies,
  githubUrl: optionalHttpUrl,
  websiteUrl: optionalHttpUrl,
  deployUrl: optionalHttpUrl,
  notes: optionalText(5000),
  color: optionalText(40),
})

export const createProjectSchema = projectInputSchema
export const updateProjectSchema = projectInputSchema.extend({ id: cuid })
export const projectIdSchema = z.object({ id: cuid })

export const milestoneCreateSchema = z.object({
  projectId: cuid,
  title: requiredText(200),
  dueDate: optionalIsoDate,
})

export const milestoneToggleSchema = z.object({
  id: cuid,
  done: z.boolean(),
})

export const milestoneIdSchema = z.object({ id: cuid })

export const projectFiltersSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  status: projectStatus.optional().catch(undefined),
})

export type ProjectInput = z.output<typeof projectInputSchema>
export type ProjectStatus = z.output<typeof projectStatus>
export type ProjectFilters = z.output<typeof projectFiltersSchema>
