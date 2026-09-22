"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const t = useTranslations("common")
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // الثيم غير معروف قبل الترطيب — نعرض أيقونة ثابتة لتفادي اختلاف الخادم/المتصفح
  useEffect(() => setMounted(true), [])

  const options = [
    { value: "light", label: t("themeLight"), Icon: SunIcon },
    { value: "dark", label: t("themeDark"), Icon: MoonIcon },
    { value: "system", label: t("themeSystem"), Icon: MonitorIcon },
  ] as const

  const Current =
    (mounted && options.find((o) => o.value === theme)?.Icon) || SunIcon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("theme")}>
          <Current className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {options.map(({ value, label, Icon }) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
            <Icon className="size-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
