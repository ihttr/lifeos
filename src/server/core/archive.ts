import "server-only"

import { db } from "@/lib/db"
import { buildPathname, deleteFile, putFile } from "@/lib/storage"
import { archiveMetaSchema, MAX_FILE_BYTES } from "@/schemas/archive"
import { PATHS, revalidate } from "@/server/revalidate"

import type {
  ArchiveCreate,
  ArchiveMeta,
  ArchiveMetaInput,
  ArchiveSource,
} from "@/schemas/archive"

/**
 * كتابة الأرشيف بمستخدم صريح — يشاركها الموقع والبوت، كنظيرتيها في
 * core/tasks.ts و core/university.ts.
 */

export function revalidateArchive() {
  revalidate(PATHS.archive, PATHS.university, PATHS.dashboard)
}

/**
 * يتحقق أن المادة/الواجب/المشروع المربوط يخصّ المستخدم نفسه.
 * بدونه يمكن ربط ملف بسجل مستخدم آخر عبر تعديل الطلب.
 */
async function assertOwnedLinks(input: ArchiveMeta, userId: string) {
  if (input.subjectId) {
    const count = await db.subject.count({
      where: { id: input.subjectId, userId },
    })
    if (count === 0) throw new Error("subject not owned")
  }

  if (input.assignmentId) {
    const count = await db.assignment.count({
      where: { id: input.assignmentId, userId },
    })
    if (count === 0) throw new Error("assignment not owned")
  }

  if (input.projectId) {
    const count = await db.project.count({
      where: { id: input.projectId, userId },
    })
    if (count === 0) throw new Error("project not owned")
  }
}

/** يسجّل ملفاً رُفع للمخزن مسبقاً */
export async function createArchiveEntry(
  userId: string,
  input: ArchiveCreate
) {
  await assertOwnedLinks(input, userId)

  const file = await db.archiveFile.create({
    data: {
      userId,
      title: input.title,
      description: input.description,
      kind: input.kind,
      source: input.source,
      pathname: input.pathname,
      size: input.size,
      contentType: input.contentType,
      subjectId: input.subjectId,
      assignmentId: input.assignmentId,
      projectId: input.projectId,
    },
    select: { id: true, title: true },
  })

  revalidateArchive()
  return file
}

/**
 * يرفع الملف ويسجّله في عملية واحدة — للبوت وللملفات الصغيرة من الموقع.
 *
 * الملفات الكبيرة من المتصفح لا تمرّ من هنا: حدّ جسم الطلب على Vercel
 * 4.5 ميجا، فترفع مباشرة إلى المخزن ثم تنادي createArchiveEntry.
 */
export async function uploadArchiveFile(
  userId: string,
  {
    filename,
    body,
    contentType,
    source,
    meta,
  }: {
    filename: string
    body: Buffer
    contentType: string
    source: ArchiveSource
    /** شكل المدخلات — يُطبَّع بالمخطط هنا، فلا يبنيه كل مستدعٍ كاملاً */
    meta: ArchiveMetaInput
  }
) {
  if (body.byteLength === 0) throw new Error("empty file")
  if (body.byteLength > MAX_FILE_BYTES) throw new Error("file too large")

  const parsed = archiveMetaSchema.parse(meta)
  await assertOwnedLinks(parsed, userId)

  const pathname = buildPathname(userId, filename)
  const stored = await putFile(pathname, body, contentType)

  try {
    return await createArchiveEntry(userId, {
      ...parsed,
      source,
      pathname: stored.pathname,
      size: stored.size,
      contentType: stored.contentType,
    })
  } catch (error) {
    // فشل التسجيل بعد نجاح الرفع يترك ملفاً يتيماً لا يراه أحد — ننظّفه
    await deleteFile(stored.pathname)
    throw error
  }
}

/**
 * يربط ملفاً بمادة — لزرّ «اربطه بمادة؟» في البوت.
 *
 * مقيّد بالمستخدم في الطرفين: الملف والمادة معاً، فلا يربط أحدٌ ملفه
 * بمادة غيره ولا العكس.
 */
export async function linkArchiveSubject(
  userId: string,
  fileId: string,
  subjectId: string
): Promise<{ title: string; subject: string }> {
  const subject = await db.subject.findFirst({
    where: { id: subjectId, userId },
    select: { id: true, name: true },
  })
  if (!subject) throw new Error("subject not owned")

  const file = await db.archiveFile.findFirst({
    where: { id: fileId, userId },
    select: { id: true, title: true },
  })
  if (!file) throw new Error("not found")

  await db.archiveFile.update({
    where: { id: file.id },
    data: { subjectId: subject.id },
  })

  revalidateArchive()
  return { title: file.title, subject: subject.name }
}

export async function updateArchiveEntry(
  userId: string,
  input: ArchiveMeta & { id: string }
) {
  await assertOwnedLinks(input, userId)

  const { count } = await db.archiveFile.updateMany({
    where: { id: input.id, userId },
    data: {
      title: input.title,
      description: input.description,
      kind: input.kind,
      subjectId: input.subjectId ?? null,
      assignmentId: input.assignmentId ?? null,
      projectId: input.projectId ?? null,
    },
  })
  if (count === 0) throw new Error("not found")

  revalidateArchive()
  return { id: input.id }
}

/** يحذف السجل ثم الملف — بهذا الترتيب */
export async function deleteArchiveEntry(userId: string, id: string) {
  const file = await db.archiveFile.findFirst({
    where: { id, userId },
    select: { id: true, pathname: true },
  })
  if (!file) throw new Error("not found")

  // السجل أولاً: لو سقط الحذف بعده بقي ملفٌ يتيم لا يضرّ، أما العكس
  // فيترك سجلاً يشير إلى ملف غير موجود ويفشل عند كل فتح.
  await db.archiveFile.delete({ where: { id: file.id } })
  await deleteFile(file.pathname)

  revalidateArchive()
  return { id: file.id }
}
