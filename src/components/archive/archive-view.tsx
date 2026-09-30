"use client"

import { cn } from "cn"
import {
  ArchiveIcon,
  FileTextIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { ArchiveUploadDialog } from "@/components/archive/archive-upload-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
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
import { deleteArchiveFile } from "@/server/actions/archive"

import type { ArchiveFilters, ArchiveKind } from "@/schemas/archive"
import type { ArchiveFileDTO } from "@/server/queries/archive"

export type ArchiveOptions = {
  semesters: { id: string; name: string; isActive: boolean }[]
  subjects: { id: string; name: string; semesterId: string }[]
  projects: { id: string; name: string }[]
  total: number
  bytes: number
}

const KINDS: ArchiveKind[] = ["THEORY", "PRACTICAL", "OTHER"]

/**
 * حجم مقروء.
 *
 * يُلفّ بعازل اتجاه (U+2068…U+2069): الرقم لاتيني والنص حوله عربي،
 * وبدون العزل يقلب المحرّك «68 B» إلى «B 68». يلزم في كل موضع يخالف
 * فيه اتجاهُ الجزء اتجاهَ الفقرة.
 */
export function formatSize(bytes: number): string {
  const text =
    bytes < 1024
      ? `${bytes} B`
      : bytes < 1024 * 1024
        ? `${(bytes / 1024).toFixed(0)} KB`
        : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

  return `⁨${text}⁩`
}

export function ArchiveView({
  files,
  options,
  filters,
  directUpload,
}: {
  files: ArchiveFileDTO[]
  options: ArchiveOptions
  filters: ArchiveFilters
  directUpload: boolean
}) {
  const t = useTranslations("archive")
  const tc = useTranslations("common")
  const { set, clear, pending: filtering } = useFilterParams()
  const { pending, run } = useAction()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ArchiveFileDTO | null>(null)
  const [query, setQuery] = useState(filters.q ?? "")

  useEffect(() => setQuery(filters.q ?? ""), [filters.q])

  // تأخير البحث: كل ضغطة زر تُعيد تحميل الصفحة وإلا
  useEffect(() => {
    const current = filters.q ?? ""
    if (query === current) return
    const timer = setTimeout(() => set({ q: query || undefined }), 300)
    return () => clearTimeout(timer)
  }, [query, filters.q, set])

  // المواد تُقصر على الفصل المختار، وإلا ظهرت مواد لا علاقة لها بالتصفية
  const subjects = filters.semesterId
    ? options.subjects.filter((s) => s.semesterId === filters.semesterId)
    : options.subjects

  const hasFilters = Boolean(
    filters.q || filters.kind || filters.subjectId || filters.semesterId
  )

  function open(file: ArchiveFileDTO | null) {
    setEditing(file)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        description={
          options.total > 0
            ? t("summary", {
                count: options.total,
                size: formatSize(options.bytes),
              })
            : t("description")
        }
        actions={
          <Button onClick={() => open(null)}>
            <UploadIcon className="size-4" />
            {t("upload")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="ps-9"
            aria-label={t("searchPlaceholder")}
          />
        </div>

        <Select
          value={filters.kind ?? "all"}
          onValueChange={(value) => set({ kind: value })}
        >
          <SelectTrigger className="w-36" aria-label={t("kind")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allKinds")}</SelectItem>
            {KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {t(`kinds.${kind}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.semesterId ?? "all"}
          onValueChange={(value) =>
            // تغيير الفصل يُسقط المادة: مادة الفصل السابق لا تنتمي للجديد
            set({ semesterId: value, subjectId: undefined })
          }
        >
          <SelectTrigger className="w-44" aria-label={t("semester")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allSemesters")}</SelectItem>
            {options.semesters.map((semester) => (
              <SelectItem key={semester.id} value={semester.id}>
                {semester.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.subjectId ?? "all"}
          onValueChange={(value) => set({ subjectId: value })}
        >
          <SelectTrigger className="w-44" aria-label={t("subject")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allSubjects")}</SelectItem>
            {subjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>
                {subject.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={() => clear()}>
            <XIcon className="size-4" />
            {tc("clear")}
          </Button>
        ) : null}
      </div>

      {files.length === 0 ? (
        <EmptyState
          Icon={ArchiveIcon}
          title={hasFilters ? t("noResults") : t("empty")}
          description={hasFilters ? t("noResultsHint") : t("emptyHint")}
          action={
            hasFilters ? (
              <Button variant="outline" onClick={() => clear()}>
                {tc("clear")}
              </Button>
            ) : (
              <Button onClick={() => open(null)}>
                <UploadIcon className="size-4" />
                {t("upload")}
              </Button>
            )
          }
        />
      ) : (
        <ul
          className={cn(
            "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
            filtering && "opacity-60 transition-opacity"
          )}
        >
          {files.map((file) => (
            <li
              key={file.id}
              className="bg-card flex flex-col gap-3 rounded-lg border p-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className="bg-muted text-muted-foreground mt-0.5 grid size-9 shrink-0 place-items-center rounded-md"
                  style={
                    file.subject?.color
                      ? { backgroundColor: `${file.subject.color}20` }
                      : undefined
                  }
                >
                  <FileTextIcon className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                  {/* الملف يُقدَّم من مسار محميّ بالجلسة، لا برابط عام */}
                  <a
                    href={`/api/archive/${file.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {file.title}
                  </a>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {formatSize(file.size)}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      aria-label={file.title}
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => open(file)}>
                      <PencilIcon className="size-4" />
                      {tc("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <ConfirmDialog
                      title={t("deleteTitle")}
                      description={t("deleteDescription")}
                      onConfirm={() =>
                        run(() => deleteArchiveFile({ id: file.id }), {
                          success: "archive.deleted",
                        })
                      }
                      trigger={
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={(event) => event.preventDefault()}
                        >
                          <Trash2Icon className="size-4" />
                          {tc("delete")}
                        </DropdownMenuItem>
                      }
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {file.description ? (
                <p className="text-muted-foreground line-clamp-2 text-xs">
                  {file.description}
                </p>
              ) : null}

              <div className="mt-auto flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{t(`kinds.${file.kind}`)}</Badge>
                {file.subject ? (
                  <Badge variant="outline">{file.subject.name}</Badge>
                ) : null}
                {file.project ? (
                  <Badge variant="outline">{file.project.name}</Badge>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ArchiveUploadDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        file={editing}
        options={options}
        directUpload={directUpload}
      />
    </>
  )
}
