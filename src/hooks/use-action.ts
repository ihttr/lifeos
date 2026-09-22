"use client"

import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { toast } from "sonner"

import type { ActionResult, FieldErrors } from "@/lib/safe-action"

/**
 * تشغيل موحّد لإجراءات الخادم:
 * حالة انتظار + رسالة نجاح + رسالة خطأ مترجمة.
 * يضمن ألا يبقى المستخدم متسائلاً هل نجح ما فعله.
 */
export function useAction() {
  const t = useTranslations()
  const [pending, startTransition] = useTransition()

  function run<T>(
    action: () => Promise<ActionResult<T>>,
    options?: {
      /** مفتاح ترجمة لرسالة النجاح */
      success?: string
      onSuccess?: (data: T) => void
      onError?: (error: string, fieldErrors?: FieldErrors) => void
      /** أخطاء الحقول تُعرض داخل النموذج — لا داعي لتكرارها في toast */
      silentValidation?: boolean
    }
  ) {
    startTransition(async () => {
      try {
        const result = await action()

        if (result.ok) {
          if (options?.success) toast.success(t(options.success))
          options?.onSuccess?.(result.data)
          return
        }

        const isValidation = result.error === "errors.validation"
        if (!isValidation || !options?.silentValidation) {
          toast.error(t(result.error))
        }
        options?.onError?.(result.error, result.fieldErrors)
      } catch {
        // انقطاع شبكة أو خطأ غير متوقع في النقل
        toast.error(t("errors.generic"))
        options?.onError?.("errors.generic")
      }
    })
  }

  return { pending, run }
}
