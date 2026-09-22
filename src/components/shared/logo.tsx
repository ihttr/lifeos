import { cn } from "cn"

/**
 * شعار LifeOS — شبكة من أربع وحدات تمثل أقسام اليوم،
 * إحداها مضاءة: ما الذي تعمل عليه الآن.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-foreground text-background inline-flex size-9 items-center justify-center rounded-[0.6rem]",
        className
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[58%]">
        <rect x="3" y="3" width="8" height="8" rx="2.5" fill="currentColor" opacity="0.45" />
        <rect x="13" y="3" width="8" height="8" rx="2.5" fill="currentColor" opacity="0.45" />
        <rect x="3" y="13" width="8" height="8" rx="2.5" fill="currentColor" opacity="0.45" />
        <rect x="13" y="13" width="8" height="8" rx="2.5" fill="currentColor" />
      </svg>
    </span>
  )
}
