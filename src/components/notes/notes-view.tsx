"use client"

import { cn } from "cn"
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  MoreHorizontalIcon,
  NotebookPenIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { NoteEditorDialog } from "@/components/notes/note-editor-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAction } from "@/hooks/use-action"
import { useFilterParams } from "@/hooks/use-filter-params"
import { formatDateShort, toISODateInTZ } from "@/lib/dates"
import {
  deleteNote,
  toggleNoteArchive,
  toggleNoteFavorite,
} from "@/server/actions/notes"

import type { Locale } from "@/i18n/routing"
import type { NoteFilters } from "@/schemas/note"
import type { NoteDTO, NoteFormOptions } from "@/server/queries/notes"

/** أول سطور المحتوى بعد تجريد رموز Markdown — معاينة نظيفة في البطاقة */
function excerpt(markdown: string, length = 160): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-|]/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, length)
}

export function NotesView({
  notes,
  filters,
  options,
}: {
  notes: NoteDTO[]
  filters: NoteFilters
  options: NoteFormOptions
}) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const { set } = useFilterParams()
  const { pending, run } = useAction()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<NoteDTO | null>(null)
  const [query, setQuery] = useState(filters.q ?? "")

  useEffect(() => setQuery(filters.q ?? ""), [filters.q])

  useEffect(() => {
    const current = filters.q ?? ""
    if (query === current) return
    const timer = setTimeout(() => set({ q: query || undefined }), 300)
    return () => clearTimeout(timer)
  }, [query, filters.q, set])

  // فتح ملاحظة مباشرة عبر ?open=<id> (روابط من صفحة المشروع مثلاً)
  useEffect(() => {
    if (!filters.open) return
    const target = notes.find((note) => note.id === filters.open)
    if (target) {
      setEditing(target)
      setEditorOpen(true)
      set({ open: undefined })
    }
  }, [filters.open, notes, set])

  function openNote(note: NoteDTO | null) {
    setEditing(note)
    setEditorOpen(true)
  }

  const hasFilters = Boolean(
    filters.q || filters.category || filters.tag || filters.favorites
  )

  return (
    <>
      <PageHeader
        title={t("nav.notes")}
        description={t("note.countLabel", { count: notes.length })}
        actions={
          <Button
            onClick={() => openNote(null)}
            className="hidden md:inline-flex"
          >
            <PlusIcon className="size-4" />
            {t("note.new")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 pb-5">
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

        <Select
          value={filters.category ?? "all"}
          onValueChange={(value) => set({ category: value })}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t("note.category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            {options.categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filters.favorites ? "secondary" : "outline"}
          size="icon"
          aria-pressed={filters.favorites}
          aria-label={t("note.favorites")}
          onClick={() => set({ favorites: filters.favorites ? undefined : "true" })}
        >
          <StarIcon
            className={cn("size-4", filters.favorites && "fill-current")}
          />
        </Button>

        <Button
          variant={filters.archived ? "secondary" : "outline"}
          size="icon"
          aria-pressed={filters.archived}
          aria-label={t("common.archive")}
          onClick={() => set({ archived: filters.archived ? undefined : "true" })}
        >
          <ArchiveIcon className="size-4" />
        </Button>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          Icon={NotebookPenIcon}
          title={hasFilters ? t("empty.searchTitle") : t("empty.notesTitle")}
          description={hasFilters ? t("empty.searchBody") : t("empty.notesBody")}
          action={
            hasFilters ? null : (
              <Button onClick={() => openNote(null)}>
                <PlusIcon className="size-4" />
                {t("note.new")}
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <article
              key={note.id}
              className="bg-card group relative flex flex-col rounded-xl border p-4 transition-shadow hover:shadow-sm"
            >
              <button
                type="button"
                onClick={() => openNote(note)}
                className="min-w-0 flex-1 text-start"
              >
                <h3 className="truncate pe-8 font-medium">{note.title}</h3>
                <p className="text-muted-foreground mt-1.5 line-clamp-3 text-sm">
                  {excerpt(note.contentMd) || t("note.emptyPreview")}
                </p>
              </button>

              <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {note.isFavorite ? (
                  <StarIcon className="text-warning size-3.5 fill-current" />
                ) : null}
                {note.category ? (
                  <span className="bg-muted rounded px-1.5 py-0.5">
                    {note.category}
                  </span>
                ) : null}
                {note.tags.slice(0, 2).map((tag) => (
                  <span key={tag.id} className="bg-muted rounded px-1.5 py-0.5">
                    {tag.name}
                  </span>
                ))}
                <span className="ms-auto">
                  {formatDateShort(toISODateInTZ(new Date(note.updatedAt)), locale)}
                </span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 absolute top-3 end-3 rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  aria-label={t("common.more")}
                >
                  <MoreHorizontalIcon className="size-4" />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    disabled={pending}
                    onSelect={() =>
                      run(() =>
                        toggleNoteFavorite({
                          id: note.id,
                          value: !note.isFavorite,
                        })
                      )
                    }
                  >
                    <StarIcon className="size-4" />
                    {note.isFavorite
                      ? t("note.unfavorite")
                      : t("note.favorite")}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    disabled={pending}
                    onSelect={() =>
                      run(() =>
                        toggleNoteArchive({
                          id: note.id,
                          value: !note.archivedAt,
                        })
                      )
                    }
                  >
                    {note.archivedAt ? (
                      <>
                        <ArchiveRestoreIcon className="size-4" />
                        {t("common.unarchive")}
                      </>
                    ) : (
                      <>
                        <ArchiveIcon className="size-4" />
                        {t("common.archive")}
                      </>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <ConfirmDialog
                    title={t("note.deleteConfirmTitle")}
                    description={t("note.deleteConfirmBody")}
                    onConfirm={() =>
                      run(() => deleteNote({ id: note.id }), {
                        success: "note.deleted",
                      })
                    }
                    trigger={
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={(event) => event.preventDefault()}
                      >
                        <Trash2Icon className="size-4" />
                        {t("common.delete")}
                      </DropdownMenuItem>
                    }
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </article>
          ))}
        </div>
      )}

      <Button
        size="icon"
        onClick={() => openNote(null)}
        aria-label={t("note.new")}
        className="fixed bottom-24 end-4 z-30 size-12 rounded-full shadow-lg md:hidden"
      >
        <PlusIcon className="size-5" />
      </Button>

      <NoteEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        note={editing}
        options={options}
      />
    </>
  )
}
