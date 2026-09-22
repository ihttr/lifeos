"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

import type { FieldErrors } from "@/lib/safe-action"

/**
 * أخطاء حقول النموذج القادمة من الخادم.
 *
 * المخططات تُرجع مفاتيح ترجمة، لكن Zod قد يُرجع رسالته الافتراضية
 * إن فاتنا ضبط رسالة. نسأل عن وجود المفتاح بـ t.has بدل تخمين بادئته،
 * حتى تُترجم مفاتيح أي قسم (finance.invalidAmount مثلاً) لا errors.* وحدها،
 * ويسقط ما ليس مفتاحاً إلى الرسالة العامة بدل عرض نص خام.
 */
export function useFieldErrors() {
  const t = useTranslations()
  const [errors, setErrors] = useState<FieldErrors>({})

  function error(name: string): string | undefined {
    const key = errors[name]?.[0]
    if (!key) return undefined

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- المفتاح ديناميكي
    return t.has(key as any) ? t(key as any) : t("errors.validation")
  }

  function reset() {
    setErrors({})
  }

  return { errors, setErrors, error, reset }
}
