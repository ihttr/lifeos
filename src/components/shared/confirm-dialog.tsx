"use client"

import { useTranslations } from "next-intl"
import { useState, type ReactNode } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"

/** تأكيد قبل كل إجراء لا يمكن التراجع عنه */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = true,
  onConfirm,
}: {
  trigger: ReactNode
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
}) {
  const t = useTranslations("common")
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className={
              destructive
                ? buttonVariants({ variant: "destructive" })
                : undefined
            }
            onClick={() => {
              setOpen(false)
              onConfirm()
            }}
          >
            {confirmLabel ?? t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
