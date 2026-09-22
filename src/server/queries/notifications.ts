import "server-only"

import { db } from "@/lib/db"
import { daysFromToday, todayISO } from "@/lib/dates"
import { requireUserId } from "@/server/auth"
import { getAgenda } from "@/server/queries/agenda"

import type { AgendaKind } from "@/server/queries/agenda"

/**
 * الإشعارات مشتقة وقت القراءة لا مخزّنة.
 *
 * لا جدول إشعارات ولا مهام خلفية: نحسبها من التواريخ الموجودة أصلاً،
 * ونخزّن المقروء فقط في NotificationRead. الفائدة العملية أن الإشعار
 * يختفي من نفسه إذا أنجزت المهمة أو أجّلت موعدها، بلا مزامنة.
 *
 * المفتاح ثابت لكل حالة (`task:<id>:due-1`) فيبقى "مقروءاً" عبر الجلسات،
 * ويعود إن تغيّر الموعد لأن المفتاح يحمل عدد الأيام المتبقية.
 */

export type NotificationLevel = "overdue" | "today" | "soon"

export type NotificationDTO = {
  key: string
  kind: AgendaKind
  level: NotificationLevel
  title: string
  context: string | null
  /** عدد الأيام: سالب = فات، صفر = اليوم */
  days: number
  href: string
  read: boolean
}

/** ننبّه قبل الموعد بثلاثة أيام — أبعد من ذلك ضجيج */
const LOOKAHEAD_DAYS = 3

export async function getNotifications(): Promise<NotificationDTO[]> {
  const userId = await requireUserId()
  const today = todayISO()

  // نرجع أسبوعين للخلف لالتقاط المتأخر، وثلاثة أيام للأمام للقادم
  const from = new Date(`${today}T00:00:00.000Z`)
  from.setUTCDate(from.getUTCDate() - 14)
  const to = new Date(`${today}T00:00:00.000Z`)
  to.setUTCDate(to.getUTCDate() + LOOKAHEAD_DAYS)

  const [items, reads] = await Promise.all([
    getAgenda({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      includeDone: false,
    }),
    db.notificationRead.findMany({
      where: { userId },
      select: { key: true },
    }),
  ])

  const readKeys = new Set(reads.map((row) => row.key))

  const notifications = items
    .filter((item) => !item.done)
    .map((item) => {
      const days = daysFromToday(item.date, today)
      const level: NotificationLevel =
        days < 0 ? "overdue" : days === 0 ? "today" : "soon"

      // المفتاح يحمل عدد الأيام: تأجيل الموعد يعيد التنبيه بحق
      const key = `${item.id}:${days}`

      return {
        key,
        kind: item.kind,
        level,
        title: item.title,
        context: item.context,
        days,
        href: item.href,
        read: readKeys.has(key),
      }
    })

  // المتأخر أولاً، ثم اليوم، ثم القادم
  const order: Record<NotificationLevel, number> = {
    overdue: 0,
    today: 1,
    soon: 2,
  }

  return notifications
    .sort((a, b) => order[a.level] - order[b.level] || a.days - b.days)
    .slice(0, 50)
}

export async function getUnreadCount(): Promise<number> {
  const notifications = await getNotifications()
  return notifications.filter((item) => !item.read).length
}
