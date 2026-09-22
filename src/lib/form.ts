/**
 * FormData → كائن عادي.
 * دالة خالصة بلا اعتماديات — تُستخدم على الخادم والعميل معاً.
 *
 * الحقول المكررة تصبح مصفوفة، والحقول الفارغة تصبح undefined
 * حتى تعمل قيم Zod الافتراضية والحقول الاختيارية كما هو متوقع.
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue

    const clean = value.trim()
    const existing = out[key]

    if (existing === undefined) {
      out[key] = clean === "" ? undefined : clean
    } else if (Array.isArray(existing)) {
      existing.push(clean)
    } else {
      out[key] = [existing, clean]
    }
  }

  return out
}
