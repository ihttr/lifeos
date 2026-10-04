import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"

import { buildPathname, canClientUpload } from "@/lib/storage"
import { MAX_FILE_BYTES } from "@/schemas/archive"
import { requireUserId } from "@/server/auth"

/**
 * يوقّع رفعاً مباشراً من المتصفح إلى المخزن.
 *
 * المتصفح لا يلمس خادمنا بالملف إطلاقاً: يطلب رمزاً من هنا، ثم يرفع
 * إلى Blob مباشرة. هذا يتجاوز حدّ 4.5 ميجا على دوال Vercel، ولا تُحتسب
 * عليه رسوم نقل بيانات.
 *
 * التسجيل في قاعدة البيانات يقع بعد ذلك من العميل عبر registerArchiveFile،
 * لا في onUploadCompleted: ذاك خطّاف يناديه Vercel من الخارج ولا يعمل
 * محلياً، فبناء المسار عليه يجعل التطوير مستحيل الاختبار.
 */

export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  if (!canClientUpload()) {
    // سببٌ محدّد لا رسالة عامة: هذا بالضبط ما يفرّق بين متجر مربوط
    // بـ OIDC ومتجرٍ يملك رمزاً ثابتاً.
    console.error(
      "archive: BLOB_READ_WRITE_TOKEN غير معرّف — الرفع المباشر معطّل"
    )
    return Response.json(
      { ok: false, error: "archive.clientTokenMissing" },
      { status: 503 }
    )
  }

  const body = (await request.json()) as HandleUploadBody

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // الجلسة تُفحص هنا: الرمز الممنوح يسمح بالكتابة، فلا يُمنح لغريب
        const userId = await requireUserId()

        return {
          // المسار يُعاد بناؤه على الخادم فلا يتحكّم العميل بموضع الكتابة،
          // ويبدأ بمعرّف المستخدم فيبقى الفصل بينهم ظاهراً في المخزن.
          pathname: buildPathname(userId, pathname),
          addRandomSuffix: false,
          access: "private",
          maximumSizeInBytes: MAX_FILE_BYTES,
        }
      },
      onUploadCompleted: async () => {
        // التسجيل من العميل — انظر شرح أعلى الملف
      },
    })

    return Response.json(json)
  } catch (error) {
    console.error("archive: فشل توقيع الرفع", error)
    return Response.json({ ok: false, error: "errors.generic" }, { status: 400 })
  }
}
