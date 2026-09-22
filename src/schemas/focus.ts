import { z } from "zod"

import { cuid } from "@/schemas/common"

export const focusType = z.enum(["WORK", "BREAK"])

/**
 * الجلسة تُسجَّل بعد انتهائها لا قبلها.
 * المؤقت يعمل في المتصفح مثبَّتاً على لحظة البداية، فلا يحتاج الخادم
 * أن يعرف بوجوده — وهذا يجعله ينجو من إعادة تحميل الصفحة وإغلاق التبويب.
 */
export const logSessionSchema = z.object({
  type: focusType,
  /** لحظة البداية بصيغة ISO */
  startedAt: z.iso.datetime({ error: "errors.validation" }),
  /** الثواني الفعلية التي عملها المستخدم */
  durationSec: z
    .number()
    .int({ error: "errors.validation" })
    .min(1, { error: "errors.validation" })
    .max(6 * 60 * 60, { error: "errors.validation" }),
  taskId: z
    .string()
    .optional()
    .transform((v) => (v && v !== "none" ? v : null)),
})

export const sessionIdSchema = z.object({ id: cuid })

export const focusSettingsSchema = z.object({
  workMin: z.coerce.number().int().min(1).max(180),
  breakMin: z.coerce.number().int().min(1).max(60),
  longBreakMin: z.coerce.number().int().min(1).max(120),
  untilLong: z.coerce.number().int().min(2).max(12),
})

export type FocusType = z.output<typeof focusType>
export type FocusSettings = z.output<typeof focusSettingsSchema>
