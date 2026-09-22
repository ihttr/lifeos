"use client"

import { cn } from "cn"
import { SearchIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { NAV_FOOTER, NAV_GROUPS, type NavItem } from "@/components/layout/nav-items"
import { UserMenu } from "@/components/layout/user-menu"
import { Logo } from "@/components/shared/logo"
import { Link, usePathname } from "@/i18n/navigation"

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const t = useTranslations()
  const { Icon } = item

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{t(item.labelKey)}</span>
    </Link>
  )
}

export function AppSidebar({
  onOpenSearch,
  userName,
  userEmail,
}: {
  onOpenSearch: () => void
  userName: string
  userEmail: string
}) {
  const t = useTranslations()
  const pathname = usePathname()

  return (
    <aside className="bg-sidebar sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e md:flex">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Logo className="size-7 rounded-md" />
        <span className="font-semibold tracking-tight">{t("app.name")}</span>
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onOpenSearch}
          className={cn(
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            "focus-visible:ring-ring/50 flex w-full items-center gap-2.5 rounded-md border",
            "px-2.5 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          )}
        >
          <SearchIcon className="size-4 shrink-0" />
          <span>{t("common.search")}</span>
          <kbd className="bg-muted text-muted-foreground ms-auto rounded border px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.labelKey} className="mb-5">
            <p className="text-muted-foreground/70 mb-1.5 px-2.5 text-[11px] font-medium tracking-wide uppercase">
              {t(group.labelKey)}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t p-3">
        {NAV_FOOTER.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}
        <div className="pt-2">
          <UserMenu name={userName} email={userEmail} />
        </div>
      </div>
    </aside>
  )
}
