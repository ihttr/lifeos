import { z } from "zod"

import { cuid, optionalId, optionalText, requiredText } from "@/schemas/common"

export const archiveKind = z.enum(["THEORY", "PRACTICAL", "OTHER"])
export const archiveSource = z.enum(["WEB", "TELEGRAM"])

/**
 * حدّ حجم الملف الواحد.
 *
 * تيليجرام لا يسمح للبوت بتنزيل أكثر من 20 ميبي بايت (20,971,520 بايت
 * بالضبط)، فنوحّد الحد عليه لئلا يقبل الموقع ما يعجز البوت عن مثله —
 * أرشيفٌ نصفه غير قابل للوصول من الجوال أسوأ من حدّ واضح.
 */
export const MAX_FILE_BYTES = 20 * 1024 * 1024

/** ما يرافق الملف عند الرفع — لا يشمل الملف نفسه */
export const archiveMetaSchema = z.object({
  title: requiredText(200),
  description: optionalText(2000),
  kind: archiveKind.default("OTHER"),
  subjectId: optionalId,
  assignmentId: optionalId,
  projectId: optionalId,
})

/** ما يُسجَّل بعد نجاح الرفع للمخزن */
export const archiveCreateSchema = archiveMetaSchema.extend({
  pathname: z.string().min(1).max(500),
  size: z
    .number()
    .int()
    .positive({ error: "archive.emptyFile" })
    .max(MAX_FILE_BYTES, { error: "archive.tooLarge" }),
  contentType: z.string().min(1).max(200),
  source: archiveSource.default("WEB"),
})

export const archiveUpdateSchema = archiveMetaSchema.extend({ id: cuid })
export const archiveIdSchema = z.object({ id: cuid })

// ------------------------------------------------------------------ التصفية

export const archiveFiltersSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  kind: archiveKind.optional().catch(undefined),
  subjectId: z.string().optional().catch(undefined),
  /** الفصل يُصفّى عبر مادة الملف — لا عمود مستقل له */
  semesterId: z.string().optional().catch(undefined),
  projectId: z.string().optional().catch(undefined),
})

export type ArchiveKind = z.output<typeof archiveKind>
export type ArchiveSource = z.output<typeof archiveSource>
export type ArchiveMeta = z.output<typeof archiveMetaSchema>
/**
 * ما يُرسَل للإجراء، لا ما يخرج منه.
 *
 * الفرق ليس شكلياً: optionalText و optionalId يقبلان `undefined` ويحوّلانه
 * إلى `null`. الكتابة مقابل نوع المخرجات تمرّ على TypeScript ثم يرفضها
 * Zod وقت التشغيل — وهو فشل صامت في الواجهة.
 */
export type ArchiveMetaInput = z.input<typeof archiveMetaSchema>
export type ArchiveCreate = z.output<typeof archiveCreateSchema>
export type ArchiveFilters = z.output<typeof archiveFiltersSchema>
