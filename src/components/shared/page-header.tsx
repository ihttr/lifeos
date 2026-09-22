import { cn } from "cn"
import type { ReactNode } from "react"

/** ترويسة موحّدة لكل صفحة: عنوان، وصف اختياري، وإجراءات على الطرف المقابل */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 pb-5",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

/** حاوية الصفحة — عرض أقصى وحشوة متجاوبة موحّدة */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 py-6 sm:px-6", className)}>
      {children}
    </div>
  )
}
