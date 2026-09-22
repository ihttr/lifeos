"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

import type { FieldErrors } from "@/lib/safe-action"

/**
 * أخطاء حقول النموذج القادمة من الخادم.
 *
 * تعيد الرسالة مترجمة، وتتحوّط لأي رسالة ليست مفتاح ترجمة
 * (مثل رسالة افتراضية من Zod) فتعرض الرسالة العامة بدل مفتاح خام.
 */
export function useFieldErrors() {
  const t = useTranslations()
  const [errors, setErrors] = useState<FieldErrors>({})

  function error(name: string): string | undefined {
    const key = errors[name]?.[0]
    if (!key) return undefined
    return key.startsWith("errors.") ? t(key) : t("errors.validation")
  }

  function reset() {
    setErrors({})
  }

  return { errors, setErrors, error, reset }
}
