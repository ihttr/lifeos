/**
 * أنواع الملفات — تعرّفٌ بالامتداد لا بما يقوله المتصفح.
 *
 * السبب أن المتصفحات لا تعرف امتدادات البرمجة: ملف `.py` يصل بنوع فارغ،
 * فيُخزَّن `application/octet-stream` ويُنزَّل قسراً بدل أن يُعرض. ونحن
 * نعرف الامتداد فنُصلح ما لا يعرفه.
 */

export type FileCategory =
  | "code"
  | "document"
  | "spreadsheet"
  | "image"
  | "archive"
  | "data"
  | "other"

type Spec = { type: string; category: FileCategory }

/**
 * النصّي كلّه `text/plain` بترميز UTF-8: المتصفح يعرضه في تبويب بدل
 * تنزيله، وهو المطلوب من أرشيفٍ غرضه المراجعة السريعة.
 */
const CODE = (): Spec => ({ type: "text/plain; charset=utf-8", category: "code" })

const TYPES: Record<string, Spec> = {
  // برمجة
  py: CODE(),
  ipynb: { type: "application/json", category: "code" },
  js: CODE(),
  mjs: CODE(),
  ts: CODE(),
  tsx: CODE(),
  jsx: CODE(),
  java: CODE(),
  c: CODE(),
  h: CODE(),
  cpp: CODE(),
  cc: CODE(),
  hpp: CODE(),
  cs: CODE(),
  go: CODE(),
  rs: CODE(),
  rb: CODE(),
  php: CODE(),
  swift: CODE(),
  kt: CODE(),
  r: CODE(),
  m: CODE(),
  sql: CODE(),
  sh: CODE(),
  bash: CODE(),
  ps1: CODE(),
  html: { type: "text/plain; charset=utf-8", category: "code" }, // نصاً لا صفحةً — انظر أدناه
  css: CODE(),
  scss: CODE(),
  vue: CODE(),
  dart: CODE(),
  lua: CODE(),
  pl: CODE(),
  asm: CODE(),
  v: CODE(),
  vhd: CODE(),

  // بيانات ونصوص
  txt: { type: "text/plain; charset=utf-8", category: "document" },
  md: { type: "text/plain; charset=utf-8", category: "document" },
  csv: { type: "text/plain; charset=utf-8", category: "data" },
  json: { type: "application/json", category: "data" },
  xml: { type: "text/plain; charset=utf-8", category: "data" },
  yaml: { type: "text/plain; charset=utf-8", category: "data" },
  yml: { type: "text/plain; charset=utf-8", category: "data" },

  // مستندات
  pdf: { type: "application/pdf", category: "document" },
  doc: { type: "application/msword", category: "document" },
  docx: {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    category: "document",
  },
  ppt: { type: "application/vnd.ms-powerpoint", category: "document" },
  pptx: {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    category: "document",
  },
  xls: { type: "application/vnd.ms-excel", category: "spreadsheet" },
  xlsx: {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    category: "spreadsheet",
  },

  // صور
  png: { type: "image/png", category: "image" },
  jpg: { type: "image/jpeg", category: "image" },
  jpeg: { type: "image/jpeg", category: "image" },
  gif: { type: "image/gif", category: "image" },
  webp: { type: "image/webp", category: "image" },
  svg: { type: "text/plain; charset=utf-8", category: "image" }, // نصاً — انظر أدناه
  heic: { type: "image/heic", category: "image" },

  // حزم
  zip: { type: "application/zip", category: "archive" },
  rar: { type: "application/vnd.rar", category: "archive" },
  "7z": { type: "application/x-7z-compressed", category: "archive" },
  tar: { type: "application/x-tar", category: "archive" },
  gz: { type: "application/gzip", category: "archive" },
}

/**
 * HTML و SVG يُقدَّمان نصّاً عمداً، لا بنوعهما الحقيقي.
 *
 * كلاهما ينفّذ سكربتاً عند العرض، وملفٌ يرفعه المستخدم ثم يُقدَّم من
 * نطاقنا يعني تنفيذ كوده داخل أصل الموقع — وهو ثغرة XSS مخزّنة تصل
 * إلى كوكي الجلسة. عرضهما نصّاً يُبقيهما قابلين للمراجعة بلا خطر.
 */
export function detectFileType(
  filename: string,
  browserType?: string
): { contentType: string; category: FileCategory } {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  const known = TYPES[ext]

  if (known) return { contentType: known.type, category: known.category }

  // المتصفح أدرى بما يعرفه، لكن لا نثق به في html/svg
  if (browserType && browserType !== "application/octet-stream") {
    if (/html|svg|xml/i.test(browserType)) {
      return { contentType: "text/plain; charset=utf-8", category: "other" }
    }
    return { contentType: browserType, category: categoryOf(browserType) }
  }

  return { contentType: "application/octet-stream", category: "other" }
}

function categoryOf(contentType: string): FileCategory {
  if (contentType.startsWith("image/")) return "image"
  if (contentType.startsWith("text/")) return "document"
  if (contentType.includes("pdf") || contentType.includes("word")) {
    return "document"
  }
  if (contentType.includes("sheet") || contentType.includes("excel")) {
    return "spreadsheet"
  }
  if (/zip|rar|tar|compressed/.test(contentType)) return "archive"
  return "other"
}

/** التصنيف من نوع مخزَّن — للعرض في القوائم */
export function categoryFromType(
  contentType: string,
  filename?: string
): FileCategory {
  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? ""
    if (TYPES[ext]) return TYPES[ext].category
  }
  return categoryOf(contentType)
}
