import { upload } from "@vercel/blob/client"

import { MAX_FILE_BYTES } from "@/schemas/archive"
import { registerArchiveFile } from "@/server/actions/archive"

import type { ArchiveMetaInput } from "@/schemas/archive"

/**
 * رفع ملف من المتصفح — مساران خلف دالة واحدة.
 *
 * حين يكون مخزن Blob مهيّأً يرفع المتصفح إليه مباشرة، فيتجاوز حدّ
 * 4.5 ميجا على دوال Vercel الذي يسقط عنده أي واجب ممسوح ضوئياً.
 * وبدون مخزن (التطوير المحلي) يمرّ عبر خادمنا إلى القرص.
 *
 * التسجيل في قاعدة البيانات خطوة تالية مستقلة في المسار المباشر. لو
 * انقطع الاتصال بينهما بقي ملفٌ في المخزن بلا سجل — لا يراه أحد ولا
 * يضرّ، وهو أهون من العكس: سجلٌّ يشير إلى ملف غير موجود.
 */

export type UploadResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export async function uploadArchiveFile(
  file: File,
  meta: ArchiveMetaInput,
  { directUpload }: { directUpload: boolean }
): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, error: "archive.emptyFile" }
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "archive.tooLarge" }

  if (!directUpload) {
    const form = new FormData()
    form.set("file", file)
    form.set("title", meta.title)
    if (meta.description) form.set("description", meta.description)
    if (meta.kind) form.set("kind", meta.kind)
    if (meta.subjectId) form.set("subjectId", meta.subjectId)
    if (meta.assignmentId) form.set("assignmentId", meta.assignmentId)
    if (meta.projectId) form.set("projectId", meta.projectId)

    const response = await fetch("/api/archive/upload", {
      method: "POST",
      body: form,
    })

    const json = (await response.json()) as
      | { ok: true; data: { id: string } }
      | { ok: false; error: string }

    return json.ok ? { ok: true, id: json.data.id } : json
  }

  try {
    const blob = await upload(file.name, file, {
      access: "private",
      handleUploadUrl: "/api/archive/blob-upload",
      contentType: file.type || "application/octet-stream",
    })

    const result = await registerArchiveFile({
      ...meta,
      source: "WEB",
      pathname: blob.pathname,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    })

    return result.ok
      ? { ok: true, id: result.data.id }
      : { ok: false, error: result.error }
  } catch (error) {
    console.error("archive: فشل الرفع المباشر", error)
    return { ok: false, error: "errors.generic" }
  }
}
