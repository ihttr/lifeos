"use server"

import { z } from "zod"

import { db } from "@/lib/db"
import { createAction } from "@/lib/safe-action"
import { PATHS, revalidate } from "@/server/revalidate"
import { getNotifications } from "@/server/queries/notifications"

const markSchema = z.object({
  key: z.string().min(1).max(200),
})

/**
 * "مقروء" يعني مفتاحاً واحداً فقط.
 * لا نخزّن الإشعار نفسه — هو مشتق — بل علامة أنك رأيته.
 */
export const markNotificationRead = createAction(
  markSchema,
  async ({ key }, userId) => {
    await db.notificationRead.upsert({
      where: { userId_key: { userId, key } },
      update: {},
      create: { userId, key },
    })

    revalidate(PATHS.dashboard)
    return { key }
  }
)

export const markAllNotificationsRead = createAction(
  z.object({}),
  async (_input, userId) => {
    const notifications = await getNotifications()
    const unread = notifications.filter((item) => !item.read)

    if (unread.length > 0) {
      await db.notificationRead.createMany({
        data: unread.map((item) => ({ userId, key: item.key })),
        skipDuplicates: true,
      })
    }

    revalidate(PATHS.dashboard)
    return { count: unread.length }
  }
)

/**
 * ينظّف علامات القراءة القديمة.
 * المفاتيح تحمل عدد الأيام فتتراكم بلا فائدة بعد مرور الموعد.
 */
export const pruneNotificationReads = createAction(
  z.object({}),
  async (_input, userId) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 60)

    const { count } = await db.notificationRead.deleteMany({
      where: { userId, readAt: { lt: cutoff } },
    })

    return { count }
  }
)
