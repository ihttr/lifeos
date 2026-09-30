import { getFile } from "@/lib/storage"
import { requireUserId } from "@/server/auth"
import { getArchiveFileForDownload } from "@/server/queries/archive"

/**
 * تنزيل ملف من الأرشيف.
 *
 * الملفات مخزّنة بوصول خاص ولا رابط عاماً لها، فهذا المسار هو المنفذ
 * الوحيد إليها. التحقق من الجلسة يقع هنا مباشرة بجوار القراءة — لا في
 * proxy.ts — لأن خطأً في طبقة وسيطة يكشف ملفات الناس، وحراسةُ الشيء
 * عند مصدره أصعب في الإفساد.
 *
 * والاستعلام مقيّد بـ userId، فمعرّف ملف مخمّن لمستخدم آخر يعطي 404.
 */

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: RouteContext<"/api/archive/[id]">
) {
  const userId = await requireUserId()
  const { id } = await context.params

  const record = await getArchiveFileForDownload(id, userId)
  if (!record) return new Response("not found", { status: 404 })

  const file = await getFile(record.pathname)
  if (!file) {
    // السجل موجود والملف مفقود: خلل في المخزن لا طلب خاطئ
    console.error("archive: ملف مفقود من المخزن", record.pathname)
    return new Response("file missing", { status: 410 })
  }

  // المتصفح يعيد التحقق في كل مرة، فيبقى فحص الجلسة عاملاً،
  // مع السماح بـ 304 حتى لا يُعاد تنزيل الملف كاملاً بلا داع.
  if (file.etag && request.headers.get("if-none-match") === file.etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: file.etag, "Cache-Control": "private, no-cache" },
    })
  }

  // الاسم الأصلي بامتداده: حفظُ ملفٍ بلا امتداد يجعله غير قابل للفتح
  const filename = encodeURIComponent(record.filename || record.title)

  return new Response(file.stream, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      // inline ليُعرض الـ PDF في المتصفح بدل تنزيله قسراً
      "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-cache",
      ...(file.etag ? { ETag: file.etag } : {}),
    },
  })
}
