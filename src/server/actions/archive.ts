"use server"

import { createAction } from "@/lib/safe-action"
import {
  archiveCreateSchema,
  archiveIdSchema,
  archiveUpdateSchema,
} from "@/schemas/archive"
import {
  createArchiveEntry,
  deleteArchiveEntry,
  updateArchiveEntry,
} from "@/server/core/archive"

/**
 * تسجيل ملف رُفع مباشرة من المتصفح إلى المخزن.
 *
 * الرفع نفسه لا يمرّ من هنا: حدّ جسم الطلب على Vercel 4.5 ميجا، وملف
 * واجب ممسوح ضوئياً يتجاوزه. فالمتصفح يرفع إلى المخزن ثم يستدعي هذا
 * لتسجيل البيانات الوصفية.
 */
export const registerArchiveFile = createAction(
  archiveCreateSchema,
  (input, userId) => createArchiveEntry(userId, input)
)

export const updateArchiveFile = createAction(
  archiveUpdateSchema,
  (input, userId) => updateArchiveEntry(userId, input)
)

export const deleteArchiveFile = createAction(
  archiveIdSchema,
  ({ id }, userId) => deleteArchiveEntry(userId, id)
)
