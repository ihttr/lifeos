"use client"

import type { ReactNode } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"

/**
 * نافذة حوار على سطح المكتب، وورقة سفلية على الجوال.
 * الورقة السفلية أقرب للإبهام وأسهل إغلاقاً بالسحب.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-start">
            <DrawerTitle>{title}</DrawerTitle>
            {description ? (
              <DrawerDescription>{description}</DrawerDescription>
            ) : (
              <DrawerDescription className="sr-only">{title}</DrawerDescription>
            )}
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4">{children}</div>

          {footer ? (
            <div className="flex flex-col gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={className ?? "sm:max-w-lg"}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-0.5">{children}</div>

        {footer ? (
          <div className="flex justify-end gap-2 border-t pt-4">{footer}</div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
