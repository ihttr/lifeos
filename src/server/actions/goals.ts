"use server"

import { db } from "@/lib/db"
import { isoToDateColumn } from "@/lib/dates"
import { createAction } from "@/lib/safe-action"
import {
  createGoalSchema,
  goalIdSchema,
  goalStatusSchema,
  milestoneCreateSchema,
  milestoneIdSchema,
  milestoneToggleSchema,
  updateGoalSchema,
} from "@/schemas/goal"
import { PATHS, revalidate } from "@/server/revalidate"

function revalidateGoals() {
  revalidate(PATHS.goals, PATHS.dashboard, PATHS.calendar, PATHS.stats)
}

export const createGoal = createAction(createGoalSchema, async (input, userId) => {
  const goal = await db.goal.create({
    data: {
      userId,
      title: input.title,
      description: input.description,
      category: input.category,
      deadline: isoToDateColumn(input.deadline),
      status: input.status,
    },
    select: { id: true },
  })

  revalidateGoals()
  return goal
})

export const updateGoal = createAction(updateGoalSchema, async (input, userId) => {
  const { count } = await db.goal.updateMany({
    where: { id: input.id, userId },
    data: {
      title: input.title,
      description: input.description,
      category: input.category,
      deadline: isoToDateColumn(input.deadline),
      status: input.status,
    },
  })
  if (count === 0) throw new Error("not found")

  revalidateGoals()
  return { id: input.id }
})

export const setGoalStatus = createAction(
  goalStatusSchema,
  async ({ id, status }, userId) => {
    const { count } = await db.goal.updateMany({
      where: { id, userId },
      data: { status },
    })
    if (count === 0) throw new Error("not found")

    revalidateGoals()
    return { id }
  }
)

export const deleteGoal = createAction(goalIdSchema, async ({ id }, userId) => {
  // Cascade يحذف المراحل
  const { count } = await db.goal.deleteMany({ where: { id, userId } })
  if (count === 0) throw new Error("not found")

  revalidateGoals()
  return { id }
})

// ------------------------------------------------------------------ المراحل

export const addGoalMilestone = createAction(
  milestoneCreateSchema,
  async ({ goalId, title }, userId) => {
    const goal = await db.goal.findFirst({
      where: { id: goalId, userId },
      select: { id: true, _count: { select: { milestones: true } } },
    })
    if (!goal) throw new Error("not found")

    const milestone = await db.goalMilestone.create({
      data: { goalId, title, position: goal._count.milestones },
      select: { id: true },
    })

    revalidateGoals()
    return milestone
  }
)

export const toggleGoalMilestone = createAction(
  milestoneToggleSchema,
  async ({ id, done }, userId) => {
    const milestone = await db.goalMilestone.findFirst({
      where: { id, goal: { userId } },
      select: { id: true, goalId: true },
    })
    if (!milestone) throw new Error("not found")

    await db.goalMilestone.update({ where: { id }, data: { done } })

    // إنجاز آخر مرحلة يُكمل الهدف تلقائياً — ولا نتراجع عن ذلك إلا بإلغاء مرحلة
    const [total, doneCount] = await Promise.all([
      db.goalMilestone.count({ where: { goalId: milestone.goalId } }),
      db.goalMilestone.count({
        where: { goalId: milestone.goalId, done: true },
      }),
    ])

    if (total > 0) {
      const goal = await db.goal.findUnique({
        where: { id: milestone.goalId },
        select: { status: true },
      })

      if (doneCount === total && goal?.status === "ACTIVE") {
        await db.goal.update({
          where: { id: milestone.goalId },
          data: { status: "COMPLETED" },
        })
      } else if (doneCount < total && goal?.status === "COMPLETED") {
        await db.goal.update({
          where: { id: milestone.goalId },
          data: { status: "ACTIVE" },
        })
      }
    }

    revalidateGoals()
    return { id, completed: total > 0 && doneCount === total }
  }
)

export const deleteGoalMilestone = createAction(
  milestoneIdSchema,
  async ({ id }, userId) => {
    const { count } = await db.goalMilestone.deleteMany({
      where: { id, goal: { userId } },
    })
    if (count === 0) throw new Error("not found")

    revalidateGoals()
    return { id }
  }
)
