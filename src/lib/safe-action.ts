import { z } from "zod"

import { formDataToObject } from "@/lib/form"
import { requireUserId } from "@/server/auth"

export { formDataToObject }

/**
 * كل كتابة في التطبيق تمر من هنا:
 *   1. تتحقق من الجلسة (requireUserId)
 *   2. تفحص المدخلات بـ Zod
 *   3. تعيد شكل نتيجة موحّد لا يسرّب تفاصيل الأخطاء
 *
 * رسائل الأخطاء مفاتيح ترجمة، والواجهة تترجمها.
 */

export type FieldErrors = Record<string, string[]>

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors }

export const idleResult: ActionResult<never> | null = null

/** أخطاء redirect/notFound في Next تُرمى عمداً ويجب أن تمر */
function isFrameworkError(error: unknown): boolean {
  const digest = (error as { digest?: unknown })?.digest
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
  )
}

function fail(error: unknown): ActionResult<never> {
  if (process.env.NODE_ENV !== "production") console.error(error)
  return { ok: false, error: "errors.generic" }
}

/** إجراء يستقبل كائناً عادياً — للتعديلات السريعة داخل الصفحة */
export function createAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.output<S>, userId: string) => Promise<T>
) {
  return async (input: unknown): Promise<ActionResult<T>> => {
    const userId = await requireUserId()

    const parsed = schema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: "errors.validation",
        fieldErrors: z.flattenError(parsed.error).fieldErrors as FieldErrors,
      }
    }

    try {
      return { ok: true, data: await handler(parsed.data, userId) }
    } catch (error) {
      if (isFrameworkError(error)) throw error
      return fail(error)
    }
  }
}

/** إجراء يستقبل FormData — للنماذج المستخدِمة لـ useActionState */
export function createFormAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.output<S>, userId: string) => Promise<T>
) {
  const action = createAction(schema, handler)

  return async (
    _prev: ActionResult<T> | null,
    formData: FormData
  ): Promise<ActionResult<T>> => action(formDataToObject(formData))
}
