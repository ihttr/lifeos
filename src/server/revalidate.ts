import { revalidatePath } from "next/cache"

/**
 * صفحات التطبيق ديناميكية (محمية بجلسة)، فدور revalidatePath هنا
 * هو إخبار موجّه العميل بإعادة جلب المسارات المتأثرة بعد التعديل.
 *
 * المسارات تُكتب بصيغة المقطع الديناميكي ليشمل كل اللغات.
 */

export function revalidate(...paths: string[]) {
  for (const path of paths) revalidatePath(`/[locale]${path}`, "page")
}

export const PATHS = {
  dashboard: "/dashboard",
  tasks: "/tasks",
  projects: "/projects",
  university: "/university",
  learning: "/learning",
  notes: "/notes",
  goals: "/goals",
  finance: "/finance",
  focus: "/focus",
  bookmarks: "/bookmarks",
  calendar: "/calendar",
  stats: "/stats",
  settings: "/settings",
} as const

/** تغيّر المهام ينعكس على لوحة التحكم والتقويم والمشاريع */
export function revalidateTasks() {
  revalidate(
    PATHS.tasks,
    PATHS.dashboard,
    PATHS.calendar,
    PATHS.projects,
    PATHS.stats
  )
}
