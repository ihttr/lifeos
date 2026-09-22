"use client"

import { cn } from "cn"
import {
  BookOpenCheckIcon,
  BookOpenIcon,
  BookmarkIcon,
  FolderKanbanIcon,
  GraduationCapIcon,
  LayersIcon,
  ListChecksIcon,
  LoaderCircleIcon,
  MonitorIcon,
  MoonIcon,
  NotebookPenIcon,
  SunIcon,
  TargetIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useEffect, useState, useTransition } from "react"

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
import { searchEverything, type SearchHit } from "@/server/actions/search"

const KIND_ICON = {
  task: ListChecksIcon,
  project: FolderKanbanIcon,
  note: NotebookPenIcon,
  goal: TargetIcon,
  subject: LayersIcon,
  assignment: BookOpenCheckIcon,
  exam: GraduationCapIcon,
  path: BookOpenIcon,
  bookmark: BookmarkIcon,
} as const

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

  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<SearchHit[]>([])
  const [pending, startTransition] = useTransition()

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

  // تفريغ الحالة عند الإغلاق حتى لا تظهر نتائج قديمة عند الفتح التالي
  useEffect(() => {
    if (!open) {
      setQuery("")
      setHits([])
    }
  }, [open])

  // بحث مؤجّل — لا نطلب من الخادم عند كل حرف
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setHits([])
      return
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await searchEverything({ q: term })
        // نتجاهل النتيجة إن تغيّر النص أثناء الانتظار
        if (result.ok) setHits(result.data)
        else setHits([])
      })
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  function go(href: string) {
    onOpenChange(false)
    router.push(href)
  }

  const searching = query.trim().length >= 2

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("common.search")}
      description={t("search.description")}
      // البحث يتم على الخادم، فلا نُخضع النتائج لترشيح cmdk المحلي
      shouldFilter={!searching}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("search.placeholder")}
      />

      <CommandList>
        {searching ? (
          <>
            {pending && hits.length === 0 ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
                <LoaderCircleIcon className="size-4 animate-spin" />
                {t("common.loading")}
              </div>
            ) : (
              <CommandEmpty>{t("empty.searchTitle")}</CommandEmpty>
            )}

            {hits.length > 0 ? (
              <CommandGroup heading={t("search.results")}>
                {hits.map((hit) => {
                  const Icon = KIND_ICON[hit.kind]

                  return (
                    <CommandItem
                      key={`${hit.kind}:${hit.id}`}
                      value={`${hit.kind}:${hit.id}`}
                      onSelect={() => go(hit.href)}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span
                        className={cn(
                          "truncate",
                          hit.done && "text-muted-foreground line-through"
                        )}
                      >
                        {hit.title}
                      </span>
                      <span className="text-muted-foreground ms-auto shrink-0 text-xs">
                        {hit.context ? `${hit.context} · ` : ""}
                        {t(`search.kind.${hit.kind}`)}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : null}
          </>
        ) : (
          <>
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
              {(
                [
                  ["light", SunIcon, "themeLight"],
                  ["dark", MoonIcon, "themeDark"],
                  ["system", MonitorIcon, "themeSystem"],
                ] as const
              ).map(([value, Icon, key]) => (
                <CommandItem
                  key={value}
                  value={t(`common.${key}`)}
                  onSelect={() => {
                    setTheme(value)
                    onOpenChange(false)
                  }}
                >
                  <Icon className="size-4" />
                  {t(`common.${key}`)}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
