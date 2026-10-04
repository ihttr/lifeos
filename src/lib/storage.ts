import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import { dirname, join, resolve, sep } from "node:path"

/**
 * تخزين الملفات بسائقَين خلف واجهة واحدة.
 *
 * السبب عملي: Vercel Blob لا يعمل محلياً بلا متجر ورمز وصول، ولا يصحّ
 * أن يتوقّف بناء الأرشيف واختباره على إعداد خارجي. السائق المحلي يكتب
 * في مجلد مُتجاهَل من git، والإنتاج يستخدم Blob — ونفس الكود فوقهما.
 *
 * الاختيار تلقائي: وجود إعداد Blob يعني الإنتاج.
 */

export type StoredFile = {
  pathname: string
  size: number
  contentType: string
}

export type ReadResult = {
  stream: ReadableStream
  contentType: string
  size: number
  etag: string
}

const LOCAL_ROOT = resolve(process.cwd(), ".storage")

/** هل المخزن متاح للقراءة والكتابة من الخادم؟ OIDC يكفي لهذا. */
export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)
}

/**
 * هل يستطيع المتصفح الرفع مباشرة إلى المخزن؟
 *
 * قدرةٌ أضيق من مجرد وجود المخزن: توقيع رمزٍ للمتصفح يتطلّب
 * BLOB_READ_WRITE_TOKEN بعينه. ربط المتجر بـ OIDC يعطي BLOB_STORE_ID
 * و VERCEL_OIDC_TOKEN فقط — يكفيان للخادم ولا يكفيان لتوقيع رمز عميل،
 * فيفشل الرفع بـ «Failed to retrieve the client token».
 *
 * خلطهما في فحص واحد كان يجعل الواجهة تختار مساراً لا يعمل.
 */
export function canClientUpload(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

/**
 * مسار فريد داخل المخزن.
 *
 * يبدأ بمعرّف المستخدم فيصير الفصل بين المستخدمين ظاهراً في المسار نفسه،
 * ويحمل لاحقة عشوائية فلا يدهس ملفان اسمهما `hw1.pdf` أحدهما الآخر.
 */
export function buildPathname(userId: string, filename: string): string {
  const safe = filename
    .normalize("NFC")
    // كل ما قد يُفسَّر كمسار أو يكسر نظام ملفات
    .replace(/[/\\?%*:|"<>\u0000-\u001f]/g, "-")
    .replace(/^\.+/, "")
    .slice(-120)
    .trim()

  const suffix = randomBytes(6).toString("hex")
  return `${userId}/${suffix}-${safe || "file"}`
}

/** يمنع الخروج من جذر التخزين عبر `..` في المسار */
function localPathFor(pathname: string): string {
  const full = resolve(LOCAL_ROOT, pathname)
  if (full !== LOCAL_ROOT && !full.startsWith(LOCAL_ROOT + sep)) {
    throw new Error("invalid pathname")
  }
  return full
}

// ------------------------------------------------------------------ محلي

async function putLocal(
  pathname: string,
  body: Buffer,
  contentType: string
): Promise<StoredFile> {
  const full = localPathFor(pathname)
  await mkdir(dirname(full), { recursive: true })
  await writeFile(full, body)
  await writeFile(`${full}.meta`, JSON.stringify({ contentType }))

  return { pathname, size: body.byteLength, contentType }
}

async function getLocal(pathname: string): Promise<ReadResult | null> {
  const full = localPathFor(pathname)

  let body: Buffer
  try {
    body = await readFile(full)
  } catch {
    return null
  }

  let contentType = "application/octet-stream"
  try {
    const meta = JSON.parse(await readFile(`${full}.meta`, "utf8"))
    if (typeof meta.contentType === "string") contentType = meta.contentType
  } catch {
    // الملف موجود وبياناته الوصفية مفقودة — نكمل بالنوع الافتراضي
  }

  return {
    stream: new Blob([new Uint8Array(body)]).stream(),
    contentType,
    size: body.byteLength,
    etag: `"${createHash("sha1").update(new Uint8Array(body)).digest("hex")}"`,
  }
}

async function deleteLocal(pathname: string): Promise<void> {
  const full = localPathFor(pathname)
  await unlink(full).catch(() => {})
  await unlink(`${full}.meta`).catch(() => {})
}

// ------------------------------------------------------------------ Blob

/**
 * يُستورد عند الحاجة فقط: الحزمة غير مثبّتة بالضرورة في بيئة التطوير،
 * والاستيراد الساكن يُفشل البناء حينها.
 */
async function blobSdk() {
  return import("@vercel/blob")
}

async function putBlob(
  pathname: string,
  body: Buffer,
  contentType: string
): Promise<StoredFile> {
  const { put } = await blobSdk()

  // addRandomSuffix: false لأن buildPathname يضمن التفرّد أصلاً،
  // وبقاء المسار كما كتبناه شرطٌ لقراءته لاحقاً من قاعدة البيانات.
  const blob = await put(pathname, body, {
    access: "private",
    addRandomSuffix: false,
    contentType,
  })

  return { pathname: blob.pathname, size: body.byteLength, contentType }
}

async function getBlob(pathname: string): Promise<ReadResult | null> {
  const { get } = await blobSdk()
  const result = await get(pathname, { access: "private" })

  if (!result || result.statusCode !== 200 || !result.stream) return null

  return {
    stream: result.stream,
    contentType: result.blob.contentType ?? "application/octet-stream",
    size: Number(result.blob.size ?? 0),
    etag: result.blob.etag ?? "",
  }
}

async function deleteBlob(pathname: string): Promise<void> {
  const { del } = await blobSdk()
  await del(pathname)
}

// ------------------------------------------------------------------ الواجهة

export function storageDriverName(): "blob" | "local" {
  return isBlobConfigured() ? "blob" : "local"
}

export function putFile(
  pathname: string,
  body: Buffer,
  contentType: string
): Promise<StoredFile> {
  return isBlobConfigured()
    ? putBlob(pathname, body, contentType)
    : putLocal(pathname, body, contentType)
}

export function getFile(pathname: string): Promise<ReadResult | null> {
  return isBlobConfigured() ? getBlob(pathname) : getLocal(pathname)
}

/**
 * الحذف لا يرمي: سجل قاعدة البيانات هو مصدر الحقيقة، وفشل حذف ملف
 * من المخزن يجب ألا يمنع المستخدم من إزالة السجل. الأسوأ ملفٌ يتيم.
 */
export async function deleteFile(pathname: string): Promise<void> {
  try {
    if (isBlobConfigured()) await deleteBlob(pathname)
    else await deleteLocal(pathname)
  } catch (error) {
    console.error("storage: تعذّر حذف الملف", pathname, error)
  }
}

export const LOCAL_STORAGE_ROOT = LOCAL_ROOT
export { join as joinPath }
