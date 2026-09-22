/**
 * كل منطق التواريخ في التطبيق يمر من هنا.
 *
 * قاعدتان:
 *  1. لا تستخدم `new Date()` مباشرة في منطق الأعمال — استخدم `todayISO()`.
 *  2. التواريخ بدون وقت (dueDate، deadline) تُعامل كسلاسل "YYYY-MM-DD"،
 *     لأن Prisma يخزّنها كـ @db.Date ويعيدها كمنتصف ليل UTC.
 *
 * السعودية على UTC+3 بلا توقيت صيفي، لذا لا مفاجآت في الحساب.
 */

export const TIME_ZONE = "Asia/Riyadh"

/** الأحد — بداية الأسبوع في السعودية */
export const WEEK_STARTS_ON = 0

export type ISODate = string // "YYYY-MM-DD"

// ------------------------------------------------------------------
// التحويل بين Date و ISODate
// ------------------------------------------------------------------

/** التاريخ الميلادي الحالي في الرياض */
export function todayISO(): ISODate {
  return toISODateInTZ(new Date())
}

/** التاريخ التقويمي لأي لحظة زمنية، محسوباً بتوقيت الرياض */
export function toISODateInTZ(date: Date): ISODate {
  // en-CA يعطي الصيغة YYYY-MM-DD مباشرة
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/** قراءة حقل @db.Date القادم من Prisma (منتصف ليل UTC) */
export function dateColumnToISO(date: Date | null | undefined): ISODate | null {
  if (!date) return null
  return date.toISOString().slice(0, 10)
}

/** تحويل "YYYY-MM-DD" إلى Date صالح للتخزين في حقل @db.Date */
export function isoToDateColumn(iso: ISODate | null | undefined): Date | null {
  if (!iso) return null
  return new Date(`${iso}T00:00:00.000Z`)
}

/**
 * دمج تاريخ ووقت الرياض في لحظة زمنية فعلية (UTC).
 * يُستخدم للواجبات والاختبارات حيث الوقت مهم.
 */
export function riyadhDateTimeToUTC(iso: ISODate, time = "23:59"): Date {
  return new Date(`${iso}T${time}:00+03:00`)
}

// ------------------------------------------------------------------
// حسابات
// ------------------------------------------------------------------

export function addDaysISO(iso: ISODate, days: number): ISODate {
  const d = new Date(`${iso}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function addMonthsISO(iso: ISODate, months: number): ISODate {
  const d = new Date(`${iso}T00:00:00.000Z`)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  // تثبيت نهاية الشهر: 31 يناير + شهر = 28/29 فبراير
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  ).getUTCDate()
  d.setUTCDate(Math.min(day, lastDay))
  return d.toISOString().slice(0, 10)
}

/** عدد الأيام من اليوم حتى التاريخ (سالب = فات) */
export function daysFromToday(iso: ISODate, today = todayISO()): number {
  const a = Date.parse(`${today}T00:00:00.000Z`)
  const b = Date.parse(`${iso}T00:00:00.000Z`)
  return Math.round((b - a) / 86_400_000)
}

export function isOverdue(iso: ISODate | null, today = todayISO()): boolean {
  return iso !== null && iso < today
}

export function isToday(iso: ISODate | null, today = todayISO()): boolean {
  return iso === today
}

/** بداية الأسبوع (الأحد) الذي يقع فيه التاريخ */
export function startOfWeekISO(iso: ISODate): ISODate {
  const d = new Date(`${iso}T00:00:00.000Z`)
  return addDaysISO(iso, -d.getUTCDay())
}

export function startOfMonthISO(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`
}

export function endOfMonthISO(iso: ISODate): ISODate {
  const [y, m] = iso.split("-").map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${iso.slice(0, 7)}-${String(last).padStart(2, "0")}`
}

/** كل أيام الشبكة الشهرية، مبتدئة بالأحد ومنتهية بالسبت */
export function monthGridISO(iso: ISODate): ISODate[] {
  const first = startOfMonthISO(iso)
  const last = endOfMonthISO(iso)
  const start = startOfWeekISO(first)
  const endDow = new Date(`${last}T00:00:00.000Z`).getUTCDay()
  const end = addDaysISO(last, 6 - endDow)

  const days: ISODate[] = []
  for (let cur = start; cur <= end; cur = addDaysISO(cur, 1)) days.push(cur)
  return days
}

/** ساعة اليوم في الرياض (0-23) */
export function riyadhHour(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      hour12: false,
    }).format(date)
  )
}

export type GreetingKey = "morning" | "afternoon" | "evening"

export function greetingKey(date = new Date()): GreetingKey {
  const h = riyadhHour(date)
  if (h < 12) return "morning"
  if (h < 17) return "afternoon"
  return "evening"
}

// ------------------------------------------------------------------
// العرض
// ------------------------------------------------------------------

type Locale = "ar" | "en"

/** نستخدم الأرقام اللاتينية دائماً — أوضح في الجداول والرسوم */
function intlLocale(locale: Locale): string {
  return locale === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB"
}

export function formatDateLong(iso: ISODate, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`))
}

export function formatDateShort(iso: ISODate, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`))
}

export function formatMonthYear(iso: ISODate, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`))
}

/** التاريخ الهجري — عرض ثانوي بجانب الميلادي */
export function formatHijri(iso: ISODate, locale: Locale): string {
  return new Intl.DateTimeFormat(
    locale === "ar" ? "ar-SA-u-nu-latn-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
  ).format(new Date(`${iso}T00:00:00.000Z`))
}

/** وقت لحظة زمنية بتوقيت الرياض */
export function formatTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date)
}

/** "HH:mm" المخزّنة في Task.dueTime */
export function formatClock(time: string, locale: Locale): string {
  const [h, m] = time.split(":").map(Number)
  const d = new Date(Date.UTC(2000, 0, 1, h, m))
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d)
}

/** نص بشري للموعد: اليوم / غداً / متأخر ٣ أيام / ١٢ أكتوبر */
export function relativeDueLabel(
  iso: ISODate,
  locale: Locale,
  today = todayISO()
): string {
  const diff = daysFromToday(iso, today)
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), {
    numeric: "auto",
  })
  if (Math.abs(diff) <= 6) return rtf.format(diff, "day")
  return formatDateShort(iso, locale)
}
