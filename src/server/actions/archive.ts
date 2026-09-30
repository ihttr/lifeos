"use server"

import { createAction } from "@/lib/safe-action"
import {
  archiveCreateSchema,
  archiveIdSchema,
  archiveUpdateSchema,
  folderCreateSchema,
  folderIdSchema,
  folderMoveSchema,
  folderRenameSchema,
  moveFilesSchema,
} from "@/schemas/archive"
import {
  createArchiveEntry,
  createFolder,
  deleteArchiveEntry,
  deleteFolder,
  moveFiles,
  moveFolder,
  renameFolder,
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

// ------------------------------------------------------------------ المجلدات

export const createArchiveFolder = createAction(
  folderCreateSchema,
  (input, userId) => createFolder(userId, input)
)

export const renameArchiveFolder = createAction(
  folderRenameSchema,
  ({ id, name }, userId) => renameFolder(userId, id, name)
)

export const moveArchiveFolder = createAction(
  folderMoveSchema,
  ({ id, parentId }, userId) => moveFolder(userId, id, parentId)
)

/** الحذف يرفع المحتوى للأب — لا يفقد المستخدم ملفاً بترتيب مجلداته */
export const deleteArchiveFolder = createAction(
  folderIdSchema,
  ({ id }, userId) => deleteFolder(userId, id)
)

export const moveArchiveFiles = createAction(
  moveFilesSchema,
  ({ ids, folderId }, userId) => moveFiles(userId, ids, folderId)
)
