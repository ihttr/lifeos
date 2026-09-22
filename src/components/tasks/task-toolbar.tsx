"use client"

import { cn } from "cn"
import {
  ArchiveIcon,
  CalendarIcon,
  KanbanIcon,
  ListIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useFilterParams } from "@/hooks/use-filter-params"

import type { TaskFilters } from "@/schemas/task"
import type { TaskFormOptions } from "@/components/tasks/task-form-dialog"

const VIEWS = [
  { value: "list", Icon: ListIcon, labelKey: "task.viewList" },
  { value: "board", Icon: KanbanIcon, labelKey: "task.viewBoard" },
  { value: "calendar", Icon: CalendarIcon, labelKey: "task.viewCalendar" },
] as const

export function TaskToolbar({
  filters,
  options,
}: {
  filters: TaskFilters
  options: TaskFormOptions
}) {
  const t = useTranslations()
  const { set, clear } = useFilterParams()
  const [query, setQuery] = useState(filters.q ?? "")

  // مزامنة الحقل عند تغيّر الرابط من الخارج (رجوع للخلف مثلاً)
  useEffect(() => setQuery(filters.q ?? ""), [filters.q])

  // بحث مؤجّل حتى لا نطلب من الخادم عند كل حرف
  useEffect(() => {
    const current = filters.q ?? ""
    if (query === current) return

    const timer = setTimeout(() => set({ q: query || undefined }), 300)
    return () => clearTimeout(timer)
  }, [query, filters.q, set])

  const activeCount = [
    filters.status,
    filters.priority,
    filters.projectId,
    filters.tag,
    filters.archived ? "archived" : undefined,
  ].filter(Boolean).length

  return (
    <div className="flex flex-wrap items-center gap-2 pb-4">
      <div className="relative min-w-40 flex-1">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`${t("common.search")}…`}
          className="ps-9"
          aria-label={t("common.search")}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={t("common.clear")}
            className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2 rounded p-1"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <SlidersHorizontalIcon className="size-4" />
            <span className="hidden sm:inline">{t("common.filter")}</span>
            {activeCount > 0 ? (
              <Badge variant="secondary" className="px-1.5">
                {activeCount}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-72 space-y-3">
          <FilterSelect
            label={t("task.status")}
            value={filters.status ?? "all"}
            onChange={(value) => set({ status: value })}
            options={[
              { value: "all", label: t("common.all") },
              { value: "TODO", label: t("status.TODO") },
              { value: "IN_PROGRESS", label: t("status.IN_PROGRESS") },
              { value: "DONE", label: t("status.DONE") },
            ]}
          />

          <FilterSelect
            label={t("task.priority")}
            value={filters.priority ?? "all"}
            onChange={(value) => set({ priority: value })}
            options={[
              { value: "all", label: t("common.all") },
              { value: "URGENT", label: t("priority.URGENT") },
              { value: "HIGH", label: t("priority.HIGH") },
              { value: "MEDIUM", label: t("priority.MEDIUM") },
              { value: "LOW", label: t("priority.LOW") },
            ]}
          />

          <FilterSelect
            label={t("task.project")}
            value={filters.projectId ?? "all"}
            onChange={(value) => set({ projectId: value })}
            options={[
              { value: "all", label: t("common.all") },
              ...options.projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />

          <FilterSelect
            label={t("task.tags")}
            value={filters.tag ?? "all"}
            onChange={(value) => set({ tag: value })}
            options={[
              { value: "all", label: t("common.all") },
              ...options.tags.map((tag) => ({
                value: tag.name,
                label: tag.name,
              })),
            ]}
          />

          <FilterSelect
            label={t("common.sort")}
            value={filters.sort}
            onChange={(value) => set({ sort: value })}
            options={[
              { value: "manual", label: t("task.sortManual") },
              { value: "dueDate", label: t("task.dueDate") },
              { value: "priority", label: t("task.priority") },
              { value: "created", label: t("task.sortCreated") },
              { value: "title", label: t("task.title") },
            ]}
          />

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <Button
              type="button"
              variant={filters.archived ? "secondary" : "ghost"}
              size="sm"
              className="gap-2"
              onClick={() =>
                set({ archived: filters.archived ? undefined : "true" })
              }
            >
              <ArchiveIcon className="size-4" />
              {t("common.archive")}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => clear(["view"])}
            >
              {t("common.clear")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <ToggleGroup
        type="single"
        value={filters.view}
        onValueChange={(value) => value && set({ view: value })}
        variant="outline"
        className="shrink-0"
      >
        {VIEWS.map(({ value, Icon, labelKey }) => (
          <ToggleGroupItem key={value} value={value} aria-label={t(labelKey)}>
            <Icon className="size-4" />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1.5">
      <Label className={cn("text-muted-foreground text-xs")}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
