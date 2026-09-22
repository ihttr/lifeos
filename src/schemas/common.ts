import { z } from "zod"

/**
 * رسائل الأخطاء مفاتيح ترجمة — الواجهة تترجمها عبر t().
 * نستخدم `error` (وليس `message`) لأنها في Zod 4 تغطي خطأ النوع
 * وخطأ القيد معاً، فالحقل الناقص تماماً يعطي نفس الرسالة.
 */

export const cuid = z.string({ error: "errors.required" }).min(1, {
  error: "errors.required",
})

export const requiredText = (max = 200) =>
  z
    .string({ error: "errors.required" })
    .trim()
    .min(1, { error: "errors.required" })
    .max(max, { error: "errors.tooLong" })

export const optionalText = (max = 5000) =>
  z
    .string()
    .trim()
    .max(max, { error: "errors.tooLong" })
    .optional()
    .transform((v) => (v ? v : null))

/** "YYYY-MM-DD" */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "errors.validation" })

export const optionalIsoDate = isoDate
  .optional()
  .transform((v) => (v ? v : null))

/** "HH:mm" بتوقيت الرياض */
export const optionalClock = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "errors.validation" })
  .optional()
  .transform((v) => (v ? v : null))

export const optionalId = z
  .string()
  .optional()
  .transform((v) => (v && v !== "none" ? v : null))

/** روابط http/https فقط — يمنع javascript: و data: */
export const httpUrl = z
  .string()
  .trim()
  .max(2000, { error: "errors.tooLong" })
  .refine(
    (value) => {
      try {
        const url = new URL(value)
        return url.protocol === "http:" || url.protocol === "https:"
      } catch {
        return false
      }
    },
    { error: "errors.invalidUrl" }
  )

export const optionalHttpUrl = httpUrl
  .optional()
  .or(z.literal("").transform(() => undefined))
  .transform((v) => (v ? v : null))

/** أسماء الوسوم تصل كنص مفصول بفواصل أو كقيم متعددة من FormData */
export const tagNames = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (!value) return [] as string[]
    // يقبل الفاصلة اللاتينية والعربية معاً
    const raw = Array.isArray(value) ? value : value.split(/[,،]/)
    const cleaned = raw.map((t) => t.trim()).filter(Boolean).slice(0, 20)
    return [...new Set(cleaned)]
  })
