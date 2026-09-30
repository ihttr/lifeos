"use client"

import { cn } from "cn"
import {
  ArchiveIcon,
  ChevronLeftIcon,
  FileArchiveIcon,
  FileCodeIcon,
  FileImageIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  FolderSymlinkIcon,
  HomeIcon,
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
import { FolderDialog } from "@/components/archive/folder-dialog"
import { MoveFileDialog } from "@/components/archive/move-file-dialog"
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
import { categoryFromType, type FileCategory } from "@/lib/file-types"
import { deleteArchiveFile, deleteArchiveFolder } from "@/server/actions/archive"

import type { ArchiveFilters, ArchiveKind } from "@/schemas/archive"
import type { ArchiveFileDTO, FolderDTO } from "@/server/queries/archive"

export type ArchiveOptions = {
  semesters: { id: string; name: string; isActive: boolean }[]
  subjects: { id: string; name: string; semesterId: string }[]
  projects: { id: string; name: string }[]
  total: number
  bytes: number
}

export type FlatFolder = { id: string; name: string; parentId: string | null }

const KINDS: ArchiveKind[] = ["THEORY", "PRACTICAL", "OTHER"]

const CATEGORY_ICON: Record<FileCategory, typeof FileTextIcon> = {
  code: FileCodeIcon,
  document: FileTextIcon,
  spreadsheet: FileSpreadsheetIcon,
  image: FileImageIcon,
  archive: FileArchiveIcon,
  data: FileJsonIcon,
  other: FileTextIcon,
}

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
  folders,
  path,
  allFolders,
  options,
  filters,
  directUpload,
}: {
  files: ArchiveFileDTO[]
  folders: FolderDTO[]
  path: { id: string; name: string }[]
  allFolders: FlatFolder[]
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
  const [folderOpen, setFolderOpen] = useState(false)
  const [renaming, setRenaming] = useState<FolderDTO | null>(null)
  const [moving, setMoving] = useState<ArchiveFileDTO | null>(null)
  const [query, setQuery] = useState(filters.q ?? "")

  useEffect(() => setQuery(filters.q ?? ""), [filters.q])

  useEffect(() => {
    const current = filters.q ?? ""
    if (query === current) return
    const timer = setTimeout(() => set({ q: query || undefined }), 300)
    return () => clearTimeout(timer)
  }, [query, filters.q, set])

  const subjects = filters.semesterId
    ? options.subjects.filter((s) => s.semesterId === filters.semesterId)
    : options.subjects

  const hasFilters = Boolean(
    filters.q || filters.kind || filters.subjectId || filters.semesterId
  )

  // البحث يسطّح كل المجلدات، فلا معنى لعرض شجرة المجلدات حينئذٍ
  const showFolders = !hasFilters
  const currentFolder = path.at(-1)?.id ?? null

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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFolderOpen(true)}>
              <FolderPlusIcon className="size-4" />
              {t("newFolder")}
            </Button>
            <Button onClick={() => open(null)}>
              <UploadIcon className="size-4" />
              {t("upload")}
            </Button>
          </div>
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
          <SelectTrigger className="w-32" aria-label={t("kind")}>
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
          value={filters.subjectId ?? "all"}
          onValueChange={(value) => set({ subjectId: value })}
        >
          <SelectTrigger className="w-40" aria-label={t("subject")}>
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

      {/* مسار التنقّل — يظهر عند التصفّح لا عند البحث */}
      {showFolders ? (
        <nav
          aria-label={t("breadcrumb")}
          className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm"
        >
          <button
            type="button"
            onClick={() => set({ folder: undefined })}
            className="hover:text-foreground flex items-center gap-1.5 rounded px-1.5 py-1"
          >
            <HomeIcon className="size-3.5" />
            {t("root")}
          </button>

          {path.map((crumb, index) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronLeftIcon className="size-3.5 rtl:rotate-180" />
              <button
                type="button"
                onClick={() => set({ folder: crumb.id })}
                className={cn(
                  "hover:text-foreground rounded px-1.5 py-1",
                  index === path.length - 1 && "text-foreground font-medium"
                )}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>
      ) : (
        <p className="text-muted-foreground text-sm">{t("searchingAll")}</p>
      )}

      {showFolders && folders.length > 0 ? (
        <ul
          className={cn(
            "grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
            filtering && "opacity-60 transition-opacity"
          )}
        >
          {folders.map((folder) => (
            <li key={folder.id} className="flex items-center">
              <button
                type="button"
                onClick={() => set({ folder: folder.id })}
                className="hover:bg-accent flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border p-3 text-start"
              >
                <FolderIcon className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {folder.name}
                </span>
                {/* العدد زينة بصرية: «مجلد ٣» بلا معنى لقارئ الشاشة،
                    ودخوله في اسم الزر يغيّره كلما تغيّر المحتوى */}
                <span
                  aria-hidden="true"
                  className="text-muted-foreground shrink-0 text-xs"
                >
                  {folder.fileCount + folder.folderCount || ""}
                </span>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    // اسمٌ مميّز عن زر الفتح: زرّان بنفس الاسم يُسمعان
                    // متطابقين لقارئ الشاشة رغم اختلاف فعلهما
                    aria-label={t("folderActions", { name: folder.name })}
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setRenaming(folder)}>
                    <PencilIcon className="size-4" />
                    {t("rename")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <ConfirmDialog
                    title={t("deleteFolderTitle")}
                    description={t("deleteFolderDescription")}
                    onConfirm={() =>
                      run(() => deleteArchiveFolder({ id: folder.id }), {
                        success: "archive.folderDeleted",
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
            </li>
          ))}
        </ul>
      ) : null}

      {files.length === 0 && (!showFolders || folders.length === 0) ? (
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
          {files.map((file) => {
            const Icon =
              CATEGORY_ICON[categoryFromType(file.contentType, file.filename)]

            return (
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
                    <Icon className="size-4" />
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
                        aria-label={t("fileActions", { name: file.title })}
                      >
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => open(file)}>
                        <PencilIcon className="size-4" />
                        {tc("edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setMoving(file)}>
                        <FolderSymlinkIcon className="size-4" />
                        {t("moveTo")}
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
            )
          })}
        </ul>
      )}

      <ArchiveUploadDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        file={editing}
        options={options}
        folderId={currentFolder}
        directUpload={directUpload}
      />

      <FolderDialog
        open={folderOpen || renaming !== null}
        onOpenChange={(open) => {
          if (open) return
          setFolderOpen(false)
          setRenaming(null)
        }}
        folder={renaming}
        parentId={currentFolder}
      />

      <MoveFileDialog
        file={moving}
        folders={allFolders}
        onOpenChange={(open) => !open && setMoving(null)}
      />
    </>
  )
}
