import { cn } from "cn"
import type { LucideIcon } from "lucide-react"

/**
 * بطاقة رقم واحد: القيمة أولاً لأنها ما يُقرأ،
 * ثم التسمية، ثم سياق اختياري.
 */
export function StatCard({
  Icon,
  value,
  label,
  hint,
  tone = "default",
}: {
  Icon: LucideIcon
  value: string | number
  label: string
  hint?: string
  tone?: "default" | "warning" | "danger" | "success"
}) {
  const toneClass = {
    default: "text-foreground",
    warning: "text-warning",
    danger: "text-destructive",
    success: "text-success",
  }[tone]

  return (
    <div className="bg-card rounded-xl border p-3.5">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>

      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", toneClass)}>
        {value}
      </p>

      {hint ? (
        <p className="text-muted-foreground mt-0.5 truncate text-xs">{hint}</p>
      ) : null}
    </div>
  )
}
