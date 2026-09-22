"use client"

import { cn } from "cn"
import { MenuIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import {
  MOBILE_PRIMARY,
  NAV_FOOTER,
  NAV_GROUPS,
} from "@/components/layout/nav-items"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Link, usePathname } from "@/i18n/navigation"

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * تنقّل الجوال: أربعة أقسام متكررة + ورقة "المزيد" لبقية الأقسام.
 * مثبّت أسفل الشاشة ليكون في متناول الإبهام.
 */
export function BottomNav() {
  const t = useTranslations()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const restActive =
    !MOBILE_PRIMARY.some((i) => isActive(pathname, i.href)) &&
    pathname !== "/"

  return (
    <nav
      aria-label={t("nav.more")}
      className={cn(
        "bg-background/85 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-lg md:hidden",
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <div className="grid grid-cols-5">
        {MOBILE_PRIMARY.map(({ href, labelKey, Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] transition-colors",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Icon
                className={cn("size-5", active && "stroke-[2.4]")}
              />
              <span className="max-w-full truncate px-1">{t(labelKey)}</span>
            </Link>
          )
        })}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] transition-colors",
              restActive ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <MenuIcon className={cn("size-5", restActive && "stroke-[2.4]")} />
            <span>{t("nav.more")}</span>
          </SheetTrigger>

          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t("nav.more")}</SheetTitle>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-8">
              {NAV_GROUPS.map((group) => (
                <div key={group.labelKey}>
                  <p className="text-muted-foreground/70 mb-2 text-[11px] font-medium tracking-wide uppercase">
                    {t(group.labelKey)}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map(({ href, labelKey, Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex min-h-11 items-center gap-2.5 rounded-lg border px-3 text-sm",
                          "active:bg-accent transition-colors",
                          isActive(pathname, href) &&
                            "bg-accent font-medium"
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{t(labelKey)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-2 border-t pt-4">
                {NAV_FOOTER.map(({ href, labelKey, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-2.5 rounded-lg border px-3 text-sm",
                      "active:bg-accent transition-colors",
                      isActive(pathname, href) && "bg-accent font-medium"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{t(labelKey)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
