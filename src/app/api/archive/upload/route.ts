import { formDataToObject } from "@/lib/form"
import { archiveMetaSchema, MAX_FILE_BYTES } from "@/schemas/archive"
import { requireUserId } from "@/server/auth"
import { uploadArchiveFile } from "@/server/core/archive"

/**
 * رفع عبر الخادم — للتطوير المحلي وللملفات الصغيرة.
 *
 * في الإنتاج على Vercel جسم الطلب محدود بـ 4.5 ميجا، وملف واجب ممسوح
 * ضوئياً يتجاوزه غالباً. لذلك يرفع المتصفح مباشرةً إلى المخزن عبر
 * /api/archive/blob-upload حين يكون المخزن مهيّأً، ويبقى هذا المسار
 * للتطوير المحلي (حيث لا مخزن) وكبديل للملفات الصغيرة.
 */

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const userId = await requireUserId()

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ ok: false, error: "errors.generic" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return Response.json(
      { ok: false, error: "archive.emptyFile" },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_BYTES) {
    return Response.json(
      { ok: false, error: "archive.tooLarge" },
      { status: 413 }
    )
  }

  // الملف ليس حقلاً وصفياً
  const { file: _file, ...raw } = formDataToObject(form)

  // نفحص هنا لنعيد 400 واضحاً، ونمرّر الشكل الخام لأن الـ core يطبّعه
  // بنفس المخطط — فحصٌ مرتان أهون من شكلين للبيانات.
  const meta = archiveMetaSchema.safeParse(raw)

  if (!meta.success) {
    return Response.json(
      { ok: false, error: "errors.validation" },
      { status: 400 }
    )
  }

  try {
    const created = await uploadArchiveFile(userId, {
      filename: file.name,
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || "application/octet-stream",
      source: "WEB",
      meta: raw as Parameters<typeof uploadArchiveFile>[1]["meta"],
    })

    return Response.json({ ok: true, data: created })
  } catch (error) {
    console.error("archive: فشل الرفع", error)
    return Response.json({ ok: false, error: "errors.generic" }, { status: 500 })
  }
}
