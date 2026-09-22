import "server-only"

import { redirect } from "next/navigation"
import { cache } from "react"

import { db } from "@/lib/db"
import { requireUserId } from "@/server/auth"

/** بيانات المستخدم الحالي — لا تُعيد passwordHash أبداً */
export const getCurrentUser = cache(async () => {
  const userId = await requireUserId()

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      locale: true,
      pomodoroWorkMin: true,
      pomodoroBreakMin: true,
      pomodoroLongBreakMin: true,
      pomodoroUntilLong: true,
    },
  })

  // الجلسة صالحة لكن المستخدم محذوف — نعامله كغير مسجّل
  if (!user) redirect("/login")

  return user
})
