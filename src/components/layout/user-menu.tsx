"use client"

import {
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useTransition } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePathname, useRouter } from "@/i18n/navigation"
import { LOCALE_LABEL, routing, type Locale } from "@/i18n/routing"
import { logoutAction } from "@/server/actions/auth"

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
}

export function UserMenu({
  name,
  email,
  compact = false,
}: {
  name: string
  email: string
  /** في شريط الجوال نعرض الصورة الرمزية فقط */
  compact?: boolean
}) {
  const t = useTranslations("common")
  const locale = useLocale() as Locale
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "default"}
          aria-label={compact ? name : undefined}
          className={
            compact ? "" : "h-auto w-full justify-start gap-2.5 px-2.5 py-2"
          }
        >
          <Avatar className="size-6">
            <AvatarFallback className="text-[10px]">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          {compact ? null : (
            <span className="truncate text-sm font-normal">{name}</span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-muted-foreground truncate text-xs" dir="ltr">
            {email}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <SunIcon className="size-4" />
            {t("theme")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                <SunIcon className="size-4" />
                {t("themeLight")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <MoonIcon className="size-4" />
                {t("themeDark")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <MonitorIcon className="size-4" />
                {t("themeSystem")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t("language")}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={locale}
              onValueChange={(next) =>
                startTransition(() =>
                  router.replace(pathname, { locale: next as Locale })
                )
              }
            >
              {routing.locales.map((l) => (
                <DropdownMenuRadioItem key={l} value={l}>
                  {LOCALE_LABEL[l]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onSelect={() => startTransition(() => void logoutAction(locale))}
        >
          <LogOutIcon className="size-4" />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
