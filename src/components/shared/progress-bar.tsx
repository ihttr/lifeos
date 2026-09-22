import { cn } from "cn"

/**
 * شريط تقدم بسيط. النسبة مكتوبة نصاً دائماً بجانبه
 * حتى لا تعتمد القراءة على اللون أو الطول وحدهما.
 */
export function ProgressBar({
  value,
  label,
  color,
  size = "default",
  className,
}: {
  /** 0 إلى 100 */
  value: number
  label?: string
  color?: string | null
  size?: "sm" | "default"
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>{label}</span>
          <span className="font-medium">{clamped}%</span>
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={cn(
          "bg-muted w-full overflow-hidden rounded-full",
          size === "sm" ? "h-1" : "h-1.5"
        )}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${clamped}%`,
            background: color ?? "var(--foreground)",
          }}
        />
      </div>
    </div>
  )
}
