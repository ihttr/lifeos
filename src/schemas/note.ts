import { z } from "zod"

import { cuid, optionalId, optionalText, requiredText, tagNames } from "@/schemas/common"

export const noteInputSchema = z.object({
  title: requiredText(200),
  contentMd: z
    .string()
    .max(100_000, { message: "errors.tooLong" })
    .optional()
    .transform((v) => v ?? ""),
  category: optionalText(60),
  projectId: optionalId,
  subjectId: optionalId,
  learningPathId: optionalId,
  tags: tagNames,
})

export const createNoteSchema = noteInputSchema
export const updateNoteSchema = noteInputSchema.extend({ id: cuid })
export const noteIdSchema = z.object({ id: cuid })

export const noteToggleSchema = z.object({
  id: cuid,
  value: z.boolean(),
})

export const noteFiltersSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  category: z.string().trim().max(60).optional().catch(undefined),
  tag: z.string().trim().max(60).optional().catch(undefined),
  favorites: z
    .enum(["true", "false"])
    .catch("false")
    .transform((v) => v === "true"),
  archived: z
    .enum(["true", "false"])
    .catch("false")
    .transform((v) => v === "true"),
  open: z.string().optional().catch(undefined),
})

export type NoteFilters = z.output<typeof noteFiltersSchema>
