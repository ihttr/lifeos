import { cn } from "cn"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

/**
 * حالة فارغة — لا شاشات بيضاء في التطبيق.
 * دائماً: أيقونة + سبب الفراغ + إجراء واضح.
 */
export function EmptyState({
  Icon,
  title,
  description,
  action,
  className,
}: {
  Icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center",
        className
      )}
    >
      <span className="bg-muted text-muted-foreground mb-4 flex size-11 items-center justify-center rounded-full">
        <Icon className="size-5" />
      </span>
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground mt-1 max-w-sm text-sm text-balance">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
