"use client"

import { LanguagesIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePathname, useRouter } from "@/i18n/navigation"
import { LOCALE_LABEL, routing, type Locale } from "@/i18n/routing"

export function LocaleSwitcher() {
  const t = useTranslations("common")
  const active = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  function switchTo(locale: Locale) {
    if (locale === active) return
    startTransition(() => {
      router.replace(pathname, { locale })
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("language")}
          disabled={pending}
        >
          <LanguagesIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {routing.locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => switchTo(locale)}
            data-active={locale === active || undefined}
            className="data-active:font-medium"
          >
            {LOCALE_LABEL[locale]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
