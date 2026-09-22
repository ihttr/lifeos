type Locale = "ar" | "en"

/** أرقام لاتينية دائماً — أسهل للمسح البصري في الجداول والرسوم */
function intlLocale(locale: Locale): string {
  return locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB"
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    maximumFractionDigits: 1,
  }).format(value)
}

/** الريال السعودي */
export function formatCurrency(
  value: number,
  locale: Locale,
  { compact = false } = {}
): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: compact ? 0 : 2,
    minimumFractionDigits: compact ? 0 : 2,
    notation: compact ? "compact" : "standard",
  }).format(value)
}

export function formatPercent(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value)
}

/** ثوانٍ → "٢س ١٥د" */
export function formatDuration(seconds: number, locale: Locale): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)

  const h = locale === "ar" ? "س" : "h"
  const m = locale === "ar" ? "د" : "m"

  if (hours === 0) return `${minutes}${m}`
  if (minutes === 0) return `${hours}${h}`
  return `${hours}${h} ${minutes}${m}`
}

/** نسبة مئوية آمنة من القسمة على صفر */
export function ratio(done: number, total: number): number {
  return total > 0 ? done / total : 0
}

export function percentOf(done: number, total: number): number {
  return Math.round(ratio(done, total) * 100)
}
