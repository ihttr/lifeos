"use server"

import { db } from "@/lib/db"
import { createAction } from "@/lib/safe-action"
import {
  focusSettingsSchema,
  logSessionSchema,
  sessionIdSchema,
} from "@/schemas/focus"
import { PATHS, revalidate } from "@/server/revalidate"

function revalidateFocus() {
  revalidate(PATHS.focus, PATHS.dashboard, PATHS.stats)
}

/**
 * تُستدعى عند انتهاء الجلسة لا عند بدئها.
 * المؤقت يعمل في المتصفح، فلا جلسات معلّقة في القاعدة لو أُغلق التبويب.
 */
export const logFocusSession = createAction(
  logSessionSchema,
  async (input, userId) => {
    if (input.taskId) {
      const count = await db.task.count({
        where: { id: input.taskId, userId },
      })
      if (count === 0) throw new Error("task not owned")
    }

    const startedAt = new Date(input.startedAt)
    const session = await db.focusSession.create({
      data: {
        userId,
        type: input.type,
        startedAt,
        endedAt: new Date(startedAt.getTime() + input.durationSec * 1000),
        durationSec: input.durationSec,
        taskId: input.taskId,
      },
      select: { id: true },
    })

    revalidateFocus()
    return session
  }
)

export const deleteFocusSession = createAction(
  sessionIdSchema,
  async ({ id }, userId) => {
    const { count } = await db.focusSession.deleteMany({ where: { id, userId } })
    if (count === 0) throw new Error("not found")

    revalidateFocus()
    return { id }
  }
)

export const updateFocusSettings = createAction(
  focusSettingsSchema,
  async (input, userId) => {
    await db.user.update({
      where: { id: userId },
      data: {
        pomodoroWorkMin: input.workMin,
        pomodoroBreakMin: input.breakMin,
        pomodoroLongBreakMin: input.longBreakMin,
        pomodoroUntilLong: input.untilLong,
      },
    })

    revalidateFocus()
    return { ok: true }
  }
)
