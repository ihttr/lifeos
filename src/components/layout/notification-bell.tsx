"use client"

import { cn } from "cn"
import {
  AlarmClockIcon,
  BellIcon,
  BookOpenCheckIcon,
  CalendarClockIcon,
  CheckCheckIcon,
  FolderKanbanIcon,
  GraduationCapIcon,
  ListChecksIcon,
  TargetIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAction } from "@/hooks/use-action"
import { Link } from "@/i18n/navigation"
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/actions/notifications"

import type { NotificationDTO } from "@/server/queries/notifications"

const KIND_ICON = {
  task: ListChecksIcon,
  assignment: BookOpenCheckIcon,
  exam: GraduationCapIcon,
  project: FolderKanbanIcon,
  goal: TargetIcon,
} as const

const LEVEL_CLASS = {
  overdue: "text-destructive",
  today: "text-warning",
  soon: "text-muted-foreground",
} as const

export function NotificationBell({
  notifications,
}: {
  notifications: NotificationDTO[]
}) {
  const t = useTranslations()
  const { pending, run } = useAction()
  const [open, setOpen] = useState(false)

  const unread = notifications.filter((item) => !item.read).length

  function label(item: NotificationDTO): string {
    if (item.level === "overdue") {
      return t("notifications.overdueBy", { days: Math.abs(item.days) })
    }
    if (item.level === "today") return t("notifications.dueToday")
    return t("notifications.dueIn", { days: item.days })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0
              ? t("notifications.unreadLabel", { count: unread })
              : t("notifications.title")
          }
        >
          <BellIcon className="size-4" />
          {unread > 0 ? (
            <span
              className="bg-destructive text-destructive-foreground absolute -top-0.5 -end-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-medium tabular-nums"
              aria-hidden
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b p-3">
          <p className="text-sm font-medium">{t("notifications.title")}</p>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => run(() => markAllNotificationsRead({}))}
            >
              <CheckCheckIcon className="size-4" />
              {t("notifications.markAll")}
            </Button>
          ) : null}
        </div>

        {notifications.length === 0 ? (
          <p className="text-muted-foreground px-4 py-10 text-center text-sm">
            {t("notifications.empty")}
          </p>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y">
              {notifications.map((item) => {
                const Icon = KIND_ICON[item.kind]

                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={() => {
                        setOpen(false)
                        if (!item.read) {
                          run(() => markNotificationRead({ key: item.key }))
                        }
                      }}
                      className={cn(
                        "hover:bg-accent/40 flex items-start gap-2.5 px-3 py-2.5 transition-colors",
                        !item.read && "bg-accent/20"
                      )}
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          LEVEL_CLASS[item.level]
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{item.title}</p>
                        <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              item.level === "overdue" &&
                                "text-destructive font-medium"
                            )}
                          >
                            {item.level === "overdue" ? (
                              <AlarmClockIcon className="size-3" />
                            ) : (
                              <CalendarClockIcon className="size-3" />
                            )}
                            {label(item)}
                          </span>
                          {item.context ? <span>{item.context}</span> : null}
                          <span>{t(`agenda.${item.kind}`)}</span>
                        </p>
                      </div>

                      {!item.read ? (
                        <span
                          className="bg-info mt-1.5 size-2 shrink-0 rounded-full"
                          aria-label={t("notifications.unread")}
                        />
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}

        {notifications.length > 0 ? (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              asChild
              onClick={() => setOpen(false)}
            >
              <Link href="/calendar">{t("notifications.viewCalendar")}</Link>
            </Button>
          </div>
        ) : null}

        {/* عدد غير المقروء لقارئ الشاشة */}
        <p className="sr-only" aria-live="polite">
          {t("notifications.unreadLabel", { count: unread })}
        </p>
      </PopoverContent>
    </Popover>
  )
}
