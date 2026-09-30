"use client"

import { FolderIcon, HomeIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { ResponsiveDialog } from "@/components/shared/responsive-dialog"
import { Button } from "@/components/ui/button"
import { useAction } from "@/hooks/use-action"
import { moveArchiveFiles } from "@/server/actions/archive"

import type { FlatFolder } from "@/components/archive/archive-view"
import type { ArchiveFileDTO } from "@/server/queries/archive"

/** المسافة البادئة تُظهر عمق الشجرة بلا مكوّن شجرة كامل */
function depthOf(folder: FlatFolder, all: FlatFolder[]): number {
  let depth = 0
  let cursor = folder.parentId

  for (let i = 0; cursor && i < 64; i += 1) {
    depth += 1
    cursor = all.find((f) => f.id === cursor)?.parentId ?? null
  }

  return depth
}

export function MoveFileDialog({
  file,
  folders,
  onOpenChange,
}: {
  file: ArchiveFileDTO | null
  folders: FlatFolder[]
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("archive")
  const { pending, run } = useAction()

  function move(folderId: string | null) {
    if (!file) return

    run(() => moveArchiveFiles({ ids: [file.id], folderId: folderId ?? undefined }), {
      success: "archive.moved",
      onSuccess: () => onOpenChange(false),
    })
  }

  return (
    <ResponsiveDialog
      open={file !== null}
      onOpenChange={onOpenChange}
      title={t("moveTo")}
      description={file?.title}
    >
      <ul className="flex flex-col gap-1">
        <li>
          <Button
            variant={file?.folderId === null ? "secondary" : "ghost"}
            className="w-full justify-start"
            disabled={pending}
            onClick={() => move(null)}
          >
            <HomeIcon className="size-4" />
            {t("root")}
          </Button>
        </li>

        {folders.map((folder) => (
          <li key={folder.id}>
            <Button
              variant={file?.folderId === folder.id ? "secondary" : "ghost"}
              className="w-full justify-start"
              style={{ paddingInlineStart: `${12 + depthOf(folder, folders) * 16}px` }}
              disabled={pending}
              onClick={() => move(folder.id)}
            >
              <FolderIcon className="size-4" />
              {folder.name}
            </Button>
          </li>
        ))}
      </ul>
    </ResponsiveDialog>
  )
}
