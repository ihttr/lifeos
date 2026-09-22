"use client"

import { SearchIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, type ReactNode } from "react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { BottomNav } from "@/components/layout/bottom-nav"
import { CommandPalette } from "@/components/layout/command-palette"
import { NotificationBell } from "@/components/layout/notification-bell"
import { UserMenu } from "@/components/layout/user-menu"
import { Logo } from "@/components/shared/logo"
import { Button } from "@/components/ui/button"

import type { NotificationDTO } from "@/server/queries/notifications"

export function AppShell({
  children,
  userName,
  userEmail,
  notifications,
}: {
  children: ReactNode
  userName: string
  userEmail: string
  notifications: NotificationDTO[]
}) {
  const t = useTranslations()
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className="flex min-h-dvh">
      <AppSidebar
        onOpenSearch={() => setSearchOpen(true)}
        userName={userName}
        userEmail={userEmail}
        notifications={notifications}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* شريط علوي للجوال فقط */}
        <header className="bg-background/85 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur-lg md:hidden">
          <Logo className="size-7 rounded-md" />
          <span className="font-semibold tracking-tight">{t("app.name")}</span>

          <div className="ms-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.search")}
              onClick={() => setSearchOpen(true)}
            >
              <SearchIcon className="size-4" />
            </Button>
            <NotificationBell notifications={notifications} />
            <UserMenu name={userName} email={userEmail} compact />
          </div>
        </header>

        {/* المساحة السفلية تترك مكاناً لشريط التنقل في الجوال */}
        <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
      </div>

      <BottomNav />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
