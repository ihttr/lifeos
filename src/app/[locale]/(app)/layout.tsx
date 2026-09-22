import { setRequestLocale } from "next-intl/server"

import { AppShell } from "@/components/layout/app-shell"
import { getNotifications } from "@/server/queries/notifications"
import { getCurrentUser } from "@/server/queries/user"

export default async function AppLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params
  setRequestLocale(locale)

  const [user, notifications] = await Promise.all([
    getCurrentUser(),
    getNotifications(),
  ])

  return (
    <AppShell
      userName={user.name ?? user.email}
      userEmail={user.email}
      notifications={notifications}
    >
      {children}
    </AppShell>
  )
}
