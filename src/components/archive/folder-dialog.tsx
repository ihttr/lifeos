"use client"

import { useTranslations } from "next-intl"
import { useEffect, useState, type FormEvent } from "react"

import { ResponsiveDialog } from "@/components/shared/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAction } from "@/hooks/use-action"
import {
  createArchiveFolder,
  renameArchiveFolder,
} from "@/server/actions/archive"

import type { FolderDTO } from "@/server/queries/archive"

/** إنشاء مجلد أو إعادة تسميته — الحقل واحد فلا داعي لحوارين */
export function FolderDialog({
  open,
  onOpenChange,
  folder,
  parentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder: FolderDTO | null
  /** المجلد الحالي — الجديد يُنشأ بداخله */
  parentId: string | null
}) {
  const t = useTranslations("archive")
  const tc = useTranslations("common")
  const { pending, run } = useAction()
  const [name, setName] = useState("")

  useEffect(() => {
    if (open) setName(folder?.name ?? "")
  }, [open, folder])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) return

    const action = folder
      ? () => renameArchiveFolder({ id: folder.id, name: trimmed })
      : () => createArchiveFolder({ name: trimmed, parentId: parentId ?? undefined })

    run(action, {
      success: folder ? "archive.folderRenamed" : "archive.folderCreated",
      onSuccess: () => onOpenChange(false),
    })
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={folder ? t("renameFolder") : t("newFolder")}
      footer={
        <Button type="submit" form="folder-form" disabled={pending}>
          {folder ? tc("save") : tc("create")}
        </Button>
      }
    >
      <form id="folder-form" onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="folder-name">{t("folderName")}</FieldLabel>
            <Input
              id="folder-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              placeholder={t("folderPlaceholder")}
              autoFocus
              required
            />
          </Field>
        </FieldGroup>
      </form>
    </ResponsiveDialog>
  )
}
