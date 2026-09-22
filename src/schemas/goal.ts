import { z } from "zod"

import { cuid, optionalIsoDate, optionalText, requiredText } from "@/schemas/common"

export const goalStatus = z.enum(["ACTIVE", "COMPLETED", "PAUSED"])

export const goalInputSchema = z.object({
  title: requiredText(200),
  description: optionalText(2000),
  category: optionalText(60),
  deadline: optionalIsoDate,
  status: goalStatus.default("ACTIVE"),
})

export const createGoalSchema = goalInputSchema
export const updateGoalSchema = goalInputSchema.extend({ id: cuid })
export const goalIdSchema = z.object({ id: cuid })

export const goalStatusSchema = z.object({
  id: cuid,
  status: goalStatus,
})

export const milestoneCreateSchema = z.object({
  goalId: cuid,
  title: requiredText(200),
})

export const milestoneToggleSchema = z.object({
  id: cuid,
  done: z.boolean(),
})

export const milestoneIdSchema = z.object({ id: cuid })

export const goalFiltersSchema = z.object({
  status: goalStatus.optional().catch(undefined),
  category: z.string().trim().max(60).optional().catch(undefined),
})

export type GoalStatus = z.output<typeof goalStatus>
export type GoalFilters = z.output<typeof goalFiltersSchema>
