"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useTransition } from "react"

import { usePathname, useRouter } from "@/i18n/navigation"

/**
 * عوامل التصفية تعيش في رابط الصفحة، لا في حالة React.
 * فائدتها: الرابط قابل للمشاركة والحفظ، والرجوع للخلف يعمل،
 * والخادم يعيد الجلب بالمعايير الجديدة مباشرة.
 */
export function useFilterParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const set = useCallback(
    (updates: Record<string, string | undefined | null>) => {
      const params = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null || value === "" || value === "all") {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }

      const query = Object.fromEntries(params.entries())

      startTransition(() => {
        router.replace({ pathname, query }, { scroll: false })
      })
    },
    [pathname, router, searchParams]
  )

  const clear = useCallback(
    (keep: string[] = []) => {
      const params = new URLSearchParams()
      for (const key of keep) {
        const value = searchParams.get(key)
        if (value) params.set(key, value)
      }

      startTransition(() => {
        router.replace(
          { pathname, query: Object.fromEntries(params.entries()) },
          { scroll: false }
        )
      })
    },
    [pathname, router, searchParams]
  )

  return { searchParams, set, clear, pending }
}
