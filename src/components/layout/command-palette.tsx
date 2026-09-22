"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useEffect } from "react"

import { NAV_FOOTER, NAV_GROUPS } from "@/components/layout/nav-items"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useRouter } from "@/i18n/navigation"

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations()
  const router = useRouter()
  const { setTheme } = useTheme()

  // ⌘K / Ctrl+K
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  function go(href: string) {
    onOpenChange(false)
    router.push(href)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("common.search")}
      description={t("app.tagline")}
    >
      <CommandInput placeholder={`${t("common.search")}…`} />
      <CommandList>
        <CommandEmpty>{t("empty.searchTitle")}</CommandEmpty>

        {NAV_GROUPS.map((group) => (
          <CommandGroup key={group.labelKey} heading={t(group.labelKey)}>
            {group.items.map(({ href, labelKey, Icon }) => (
              <CommandItem
                key={href}
                value={`${t(labelKey)} ${href}`}
                onSelect={() => go(href)}
              >
                <Icon className="size-4" />
                {t(labelKey)}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandGroup heading={t("nav.more")}>
          {NAV_FOOTER.map(({ href, labelKey, Icon }) => (
            <CommandItem
              key={href}
              value={`${t(labelKey)} ${href}`}
              onSelect={() => go(href)}
            >
              <Icon className="size-4" />
              {t(labelKey)}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("common.theme")}>
          <CommandItem
            value={t("common.themeLight")}
            onSelect={() => {
              setTheme("light")
              onOpenChange(false)
            }}
          >
            <SunIcon className="size-4" />
            {t("common.themeLight")}
          </CommandItem>
          <CommandItem
            value={t("common.themeDark")}
            onSelect={() => {
              setTheme("dark")
              onOpenChange(false)
            }}
          >
            <MoonIcon className="size-4" />
            {t("common.themeDark")}
          </CommandItem>
          <CommandItem
            value={t("common.themeSystem")}
            onSelect={() => {
              setTheme("system")
              onOpenChange(false)
            }}
          >
            <MonitorIcon className="size-4" />
            {t("common.themeSystem")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
