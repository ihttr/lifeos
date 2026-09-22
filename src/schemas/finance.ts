import { z } from "zod"

import { cuid, isoDate, optionalText, requiredText } from "@/schemas/common"

export const transactionType = z.enum(["INCOME", "EXPENSE"])

/**
 * المبلغ يصل كنص من النموذج.
 * نمنع الصفر والسالب: نوع الحركة هو ما يحدد الاتجاه، لا إشارة المبلغ —
 * وإلا صار مصروف بمبلغ سالب دخلاً مموّهاً يفسد كل المجاميع.
 */
const amount = z
  .union([z.string(), z.number()])
  .transform((value) => {
    const parsed = Number(String(value).replace(/[,٬\s]/g, ""))
    return Number.isFinite(parsed) ? parsed : Number.NaN
  })
  .refine((value) => Number.isFinite(value) && value > 0 && value <= 100_000_000, {
    error: "finance.invalidAmount",
  })
  // قرشان بعد الفاصلة يكفيان للريال
  .transform((value) => Math.round(value * 100) / 100)

export const transactionInputSchema = z.object({
  amount,
  type: transactionType,
  category: requiredText(60),
  date: isoDate,
  description: optionalText(500),
})

export const createTransactionSchema = transactionInputSchema
export const updateTransactionSchema = transactionInputSchema.extend({ id: cuid })
export const transactionIdSchema = z.object({ id: cuid })

export const financeFiltersSchema = z.object({
  /** "YYYY-MM" — الشهر المعروض، الافتراضي الشهر الحالي */
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .catch(undefined),
  type: transactionType.optional().catch(undefined),
  category: z.string().trim().max(60).optional().catch(undefined),
})

export type TransactionType = z.output<typeof transactionType>
export type FinanceFilters = z.output<typeof financeFiltersSchema>
