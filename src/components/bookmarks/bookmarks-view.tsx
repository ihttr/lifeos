"use client"

import { cn } from "cn"
import {
  BookmarkIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState, type FormEvent } from "react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveDialog } from "@/components/shared/responsive-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAction } from "@/hooks/use-action"
import { useFieldErrors } from "@/hooks/use-field-errors"
import { useFilterParams } from "@/hooks/use-filter-params"
import { formDataToObject } from "@/lib/form"
import {
  createBookmark,
  deleteBookmark,
  toggleBookmarkFavorite,
  updateBookmark,
} from "@/server/actions/bookmarks"

import type { BookmarkCategory, BookmarkFilters } from "@/schemas/bookmark"
import type { BookmarkDTO } from "@/server/queries/bookmarks"

const CATEGORIES: BookmarkCategory[] = [
  "DEVELOPMENT",
  "UNIVERSITY",
  "LEARNING",
  "PROJECTS",
  "TOOLS",
  "PERSONAL",
]

/** اسم المضيف وحده — الرابط الكامل طويل ولا يضيف شيئاً في البطاقة */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function BookmarksView({
  bookmarks,
  counts,
  filters,
}: {
  bookmarks: BookmarkDTO[]
  counts: {
    counts: Record<string, number | undefined>
    total: number
    favorites: number
  }
  filters: BookmarkFilters
}) {
  const t = useTranslations()
  const { set } = useFilterParams()
  const { pending, run } = useAction()
  const { setErrors, error: fieldError, reset: resetErrors } = useFieldErrors()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BookmarkDTO | null>(null)
  const [query, setQuery] = useState(filters.q ?? "")

  useEffect(() => setQuery(filters.q ?? ""), [filters.q])

  useEffect(() => {
    const current = filters.q ?? ""
    if (query === current) return
    const timer = setTimeout(() => set({ q: query || undefined }), 300)
    return () => clearTimeout(timer)
  }, [query, filters.q, set])

  function open(bookmark: BookmarkDTO | null) {
    setEditing(bookmark)
    resetErrors()
    setFormOpen(true)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetErrors()

    const input = formDataToObject(new FormData(event.currentTarget))

    run(
      () =>
        editing
          ? updateBookmark({ ...input, id: editing.id })
          : createBookmark(input),
      {
        success: editing ? "bookmark.updated" : "bookmark.created",
        silentValidation: true,
        onSuccess: () => setFormOpen(false),
        onError: (_error, fieldErrors) => setErrors(fieldErrors ?? {}),
      }
    )
  }

  const hasFilters = Boolean(filters.q || filters.category || filters.favorites)

  return (
    <>
      <PageHeader
        title={t("nav.bookmarks")}
        description={t("bookmark.countLabel", { count: counts.total })}
        actions={
          <Button onClick={() => open(null)} className="hidden md:inline-flex">
            <PlusIcon className="size-4" />
            {t("bookmark.new")}
          </Button>
        }
      />

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

        <Button
          variant={filters.favorites ? "secondary" : "outline"}
          size="icon"
          aria-pressed={filters.favorites}
          aria-label={t("note.favorites")}
          onClick={() => set({ favorites: filters.favorites ? undefined : "true" })}
        >
          <StarIcon className={cn("size-4", filters.favorites && "fill-current")} />
        </Button>
      </div>

      {/* شريط التصنيفات */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-5 sm:mx-0 sm:flex-wrap sm:px-0">
        <Button
          variant={filters.category ? "outline" : "secondary"}
          size="sm"
          className="shrink-0"
          onClick={() => set({ category: undefined })}
        >
          {t("common.all")}
          <span className="text-muted-foreground ms-1.5 text-xs">
            {counts.total}
          </span>
        </Button>

        {CATEGORIES.map((category) => (
          <Button
            key={category}
            variant={filters.category === category ? "secondary" : "outline"}
            size="sm"
            className="shrink-0"
            onClick={() =>
              set({ category: filters.category === category ? undefined : category })
            }
          >
            {t(`bookmark.category.${category}`)}
            <span className="text-muted-foreground ms-1.5 text-xs">
              {counts.counts[category] ?? 0}
            </span>
          </Button>
        ))}
      </div>

      {bookmarks.length === 0 ? (
        <EmptyState
          Icon={BookmarkIcon}
          title={hasFilters ? t("empty.searchTitle") : t("bookmark.emptyTitle")}
          description={hasFilters ? t("empty.searchBody") : t("bookmark.emptyBody")}
          action={
            hasFilters ? null : (
              <Button onClick={() => open(null)}>
                <PlusIcon className="size-4" />
                {t("bookmark.new")}
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bookmarks.map((bookmark) => (
            <article
              key={bookmark.id}
              className="bg-card group relative flex flex-col rounded-xl border p-4"
            >
              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1"
              >
                <h3 className="truncate pe-8 font-medium">{bookmark.title}</h3>
                <p
                  className="text-muted-foreground mt-1 truncate text-xs"
                  dir="ltr"
                >
                  {hostOf(bookmark.url)}
                </p>
                {bookmark.description ? (
                  <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                    {bookmark.description}
                  </p>
                ) : null}
              </a>

              <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {bookmark.isFavorite ? (
                  <StarIcon className="text-warning size-3.5 fill-current" />
                ) : null}
                <span className="bg-muted rounded px-1.5 py-0.5">
                  {t(`bookmark.category.${bookmark.category}`)}
                </span>
                {bookmark.tags.slice(0, 2).map((tag) => (
                  <span key={tag.id} className="bg-muted rounded px-1.5 py-0.5">
                    {tag.name}
                  </span>
                ))}
                <ExternalLinkIcon className="ms-auto size-3.5" />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 absolute top-3 end-3 rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  aria-label={t("common.more")}
                >
                  <MoreHorizontalIcon className="size-4" />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onSelect={() => open(bookmark)}>
                    <PencilIcon className="size-4" />
                    {t("common.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={pending}
                    onSelect={() =>
                      run(() =>
                        toggleBookmarkFavorite({
                          id: bookmark.id,
                          value: !bookmark.isFavorite,
                        })
                      )
                    }
                  >
                    <StarIcon className="size-4" />
                    {bookmark.isFavorite
                      ? t("note.unfavorite")
                      : t("note.favorite")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <ConfirmDialog
                    title={t("bookmark.deleteConfirmTitle")}
                    description={t("task.deleteConfirmBody")}
                    onConfirm={() =>
                      run(() => deleteBookmark({ id: bookmark.id }), {
                        success: "bookmark.deleted",
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
        onClick={() => open(null)}
        aria-label={t("bookmark.new")}
        className="fixed bottom-24 end-4 z-30 size-12 rounded-full shadow-lg md:hidden"
      >
        <PlusIcon className="size-5" />
      </Button>

      <ResponsiveDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? t("common.edit") : t("bookmark.new")}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="bookmark-form" disabled={pending}>
              {pending
                ? t("common.saving")
                : editing
                  ? t("common.save")
                  : t("common.create")}
            </Button>
          </>
        }
      >
        <form id="bookmark-form" onSubmit={handleSubmit} noValidate className="pb-2">
          <FieldGroup>
            <Field data-invalid={fieldError("title") ? true : undefined}>
              <FieldLabel htmlFor="bookmark-title">{t("note.title")}</FieldLabel>
              <Input
                id="bookmark-title"
                name="title"
                defaultValue={editing?.title ?? ""}
                autoComplete="off"
                autoFocus
                required
                aria-invalid={fieldError("title") ? true : undefined}
              />
              {fieldError("title") ? (
                <FieldError>{fieldError("title")}</FieldError>
              ) : null}
            </Field>

            <Field data-invalid={fieldError("url") ? true : undefined}>
              <FieldLabel htmlFor="bookmark-url">{t("learning.url")}</FieldLabel>
              <Input
                id="bookmark-url"
                name="url"
                type="url"
                dir="ltr"
                inputMode="url"
                placeholder="https://…"
                defaultValue={editing?.url ?? ""}
                required
                aria-invalid={fieldError("url") ? true : undefined}
              />
              {fieldError("url") ? <FieldError>{fieldError("url")}</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="bookmark-category">
                {t("note.category")}
              </FieldLabel>
              <Select
                name="category"
                defaultValue={editing?.category ?? "PERSONAL"}
              >
                <SelectTrigger id="bookmark-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {t(`bookmark.category.${category}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="bookmark-tags">{t("task.tags")}</FieldLabel>
              <Input
                id="bookmark-tags"
                name="tags"
                autoComplete="off"
                defaultValue={editing?.tags.map((tag) => tag.name).join("، ") ?? ""}
              />
              <FieldDescription>{t("task.tagsHint")}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="bookmark-description">
                {t("task.description")}
              </FieldLabel>
              <Textarea
                id="bookmark-description"
                name="description"
                rows={2}
                defaultValue={editing?.description ?? ""}
              />
            </Field>
          </FieldGroup>
        </form>
      </ResponsiveDialog>
    </>
  )
}
