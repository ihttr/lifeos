import { upload } from "@vercel/blob/client"

import { detectFileType } from "@/lib/file-types"
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
  /** detail نصّ الخطأ الأصلي — يُعرض للمستخدم لأنه وحده يفيد التشخيص */
  | { ok: false; error: string; detail?: string }

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

    // نمرّ على الحقول بدل تعدادها يدوياً: كل حقل يُضاف لاحقاً كان
    // سيُنسى هنا ويُفقد بصمت — وهو ما حدث فعلاً مع folderId.
    for (const [key, value] of Object.entries(meta)) {
      if (value !== undefined && value !== null && value !== "") {
        form.set(key, String(value))
      }
    }

    const response = await fetch("/api/archive/upload", {
      method: "POST",
      body: form,
    })

    const json = (await response.json()) as
      | { ok: true; data: { id: string } }
      | { ok: false; error: string }

    return json.ok ? { ok: true, id: json.data.id } : json
  }

  // الرفع المباشر لا يمرّ بالخادم، فنحسم النوع هنا بنفس الدالة
  const { contentType } = detectFileType(file.name, file.type)

  try {
    const blob = await upload(file.name, file, {
      access: "private",
      handleUploadUrl: "/api/archive/blob-upload",
      contentType,
    })

    const result = await registerArchiveFile({
      ...meta,
      source: "WEB",
      pathname: blob.pathname,
      filename: file.name,
      size: file.size,
      contentType,
    })

    return result.ok
      ? { ok: true, id: result.data.id }
      : { ok: false, error: result.error }
  } catch (error) {
    // نص الخطأ من Blob مفيد جداً في التشخيص (متجر عام، رمز منتهٍ، حجم).
    // ابتلاعه يترك المستخدم أمام رسالة عامة لا تدلّ على شيء.
    console.error("archive: فشل الرفع المباشر", error)
    return {
      ok: false,
      error: "archive.uploadFailed",
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
