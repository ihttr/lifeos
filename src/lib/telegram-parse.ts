import {
  addDaysISO,
  addMonthsISO,
  endOfMonthISO,
  todayISO,
  type ISODate,
} from "@/lib/dates"

import type { TaskPriority } from "@/schemas/task"

/**
 * يحوّل جملة عربية عادية إلى مدخلات مهمة.
 *
 * حتمي بالكامل — لا نموذج لغوي ولا مفتاح API ولا تكلفة ولا كمون شبكة.
 * السبب أن صياغات المواعيد العربية اليومية محدودة فعلاً («بكرة»، «الخميس»،
 * «بعد أسبوع»)، وتغطيتها بقواعد يعطي نتيجة أدق وأسرع من استدعاء نموذج.
 * وما لا يُفهَم يبقى ضمن العنوان بلا فقدان، فيصحّحه المستخدم في التطبيق.
 *
 * العمل على مستوى الكلمات لا الأحرف: نبني نسخة مطبّعة موازية للكلمات
 * الأصلية، ونطابق عليها، ونعيد بناء العنوان من الكلمات غير المستهلكة.
 * هكذا نحذف التشكيل والتطويل بحرية دون أن نُفسد نص العنوان.
 */

export type ParsedTask = {
  title: string
  dueDate: ISODate | null
  priority: TaskPriority
  /** ما فُهم من الجملة — يُعرض للمستخدم ليتأكد أننا قرأناه صحيحاً */
  matched: string[]
}

// ------------------------------------------------------------------ التطبيع

/** ٠١٢ و ۰۱۲ → 012 */
function latinDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) =>
    String(
      d.charCodeAt(0) >= 0x06f0
        ? d.charCodeAt(0) - 0x06f0
        : d.charCodeAt(0) - 0x0660
    )
  )
}

/**
 * يوحّد ما يختلف فيه الناس عند الكتابة: الهمزات، الياء، التاء المربوطة،
 * التشكيل، والتطويل. للمطابقة فقط — العنوان يُبنى من الأصل.
 */
function normalizeWord(word: string): string {
  return latinDigits(word)
    .replace(/[ً-ْٰـ]/g, "") // تشكيل + تطويل
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/[ؤئ]/g, "ء")
    .replace(/ة/g, "ه")
    .replace(/^[(«"']+|[)»"'،,.!؟?:]+$/g, "")
    .toLowerCase()
}

// ------------------------------------------------------------------ القواميس

/** الأحد = 0 موافقاً getUTCDay، وبداية الأسبوع عندنا الأحد */
const WEEKDAYS: Record<string, number> = {
  الاحد: 0,
  الأحد: 0,
  احد: 0,
  الاثنين: 1,
  الاثنيه: 1,
  اثنين: 1,
  الثلاثاء: 2,
  ثلاثاء: 2,
  الاربعاء: 3,
  اربعاء: 3,
  الخميس: 4,
  خميس: 4,
  الجمعه: 5,
  جمعه: 5,
  السبت: 6,
  سبت: 6,
}

const PRIORITIES: Record<string, TaskPriority> = {
  عاجل: "URGENT",
  عاجله: "URGENT",
  مستعجل: "URGENT",
  طارئ: "URGENT",
  ضروري: "URGENT",
  مهم: "HIGH",
  مهمه: "HIGH", // ملاحظة: تُستهلك ككلمة أولى فقط — انظر stripLeadIn
  عالي: "HIGH",
  عاليه: "HIGH",
  بسيط: "LOW",
  منخفض: "LOW",
  منخفضه: "LOW",
  ثانوي: "LOW",
}

/** كلمات ربط تُحذف إن سبقت موعداً مفهوماً، فلا تبقى في العنوان */
const DATE_LEAD = new Set([
  "ينتهي",
  "تنتهي",
  "ينتهى",
  "موعده",
  "موعدها",
  "الموعد",
  "بتاريخ",
  "تاريخ",
  "يوم",
  "في",
  "خلال",
  "تسليم",
  "تسليمه",
  "deadline",
  "due",
])

/** أفعال البداية: «ضيف مهمة ...» → «...» */
const LEAD_IN = [
  ["ضيف", "اضف", "اضافه", "سجل", "add", "new"],
  ["مهمه", "مهمة", "تاسك", "task", "todo"],
]

const NUMBER_WORDS: Record<string, number> = {
  يوم: 1,
  يومين: 2,
  ثلاثه: 3,
  اربعه: 4,
  خمسه: 5,
  سته: 6,
  سبعه: 7,
  اسبوع: 7,
  اسبوعين: 14,
  عشره: 10,
}

// ------------------------------------------------------------------ المحلّل

type Token = { raw: string; norm: string; used: boolean }

/**
 * يحذف فعل الإضافة وكلمة «مهمة» من البداية فقط.
 *
 * التقييد بالبداية مقصود: «مهمة» قد تكون أولوية («مهم») أو جزءاً من
 * العنوان («مراجعة مهمة القراءة»)، فلا نحذفها من وسط الجملة.
 */
function stripLeadIn(tokens: Token[]) {
  let index = 0
  for (const group of LEAD_IN) {
    const token = tokens[index]
    if (token && !token.used && group.includes(token.norm)) {
      token.used = true
      index += 1
    }
  }
}

function nextWeekday(target: number, today: ISODate): ISODate {
  const current = new Date(`${today}T00:00:00.000Z`).getUTCDay()
  // اليوم نفسه مقبول: من يقول «الخميس» يوم الخميس يقصد اليوم عادةً
  const delta = (target - current + 7) % 7
  return addDaysISO(today, delta)
}

/** 5/10 أو 5-10-2026 — اليوم أولاً على العادة العربية */
function explicitDate(norm: string, today: ISODate): ISODate | null {
  const iso = norm.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return norm as ISODate

  const parts = norm.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/)
  if (!parts) return null

  const day = Number(parts[1])
  const month = Number(parts[2])
  if (day < 1 || day > 31 || month < 1 || month > 12) return null

  let year = parts[3] ? Number(parts[3]) : Number(today.slice(0, 4))
  if (year < 100) year += 2000

  const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

  // تاريخ بلا سنة وقد مضى ⇒ المقصود السنة القادمة
  if (!parts[3] && candidate < today) {
    return `${year + 1}-${candidate.slice(5)}` as ISODate
  }

  return candidate as ISODate
}

function findDate(
  tokens: Token[],
  today: ISODate
): { date: ISODate; label: string } | null {
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token.used) continue

    const consume = (count: number, date: ISODate, label: string) => {
      for (let k = i; k < i + count; k += 1) tokens[k].used = true

      // كلمات الربط قبل الموعد تُحذف كلها لا واحدة:
      // «ينتهي بتاريخ 2026-10-05» فيها كلمتان متتاليتان.
      for (let k = i - 1; k >= 0; k -= 1) {
        const before = tokens[k]
        if (before.used || !DATE_LEAD.has(before.norm)) break
        before.used = true
      }

      return { date, label }
    }

    const next = tokens[i + 1]
    const after = tokens[i + 2]

    // «بعد غد» / «بعد بكرة»
    if (token.norm === "بعد" && next && ["غد", "بكره", "بكرا"].includes(next.norm)) {
      return consume(2, addDaysISO(today, 2), "بعد غد")
    }

    // «بعد أسبوع» / «بعد يومين» / «بعد 3 أيام» / «بعد شهر»
    if (token.norm === "بعد" && next) {
      if (["شهر", "شهرين"].includes(next.norm)) {
        const months = next.norm === "شهرين" ? 2 : 1
        return consume(2, addMonthsISO(today, months), `بعد ${next.raw}`)
      }

      const word = NUMBER_WORDS[next.norm]
      if (word !== undefined) {
        return consume(2, addDaysISO(today, word), `بعد ${next.raw}`)
      }

      // «بعد 3 أيام» — رقم ثم وحدة
      const count = Number(next.norm)
      if (Number.isInteger(count) && count > 0 && count <= 365 && after) {
        if (/^(يوم|ايام|يومين)$/.test(after.norm)) {
          return consume(3, addDaysISO(today, count), `بعد ${count} يوم`)
        }
        if (/^(اسبوع|اسابيع|اسبوعين)$/.test(after.norm)) {
          return consume(3, addDaysISO(today, count * 7), `بعد ${count} أسبوع`)
        }
        if (/^(شهر|اشهر|شهور|شهرين)$/.test(after.norm)) {
          return consume(3, addMonthsISO(today, count), `بعد ${count} شهر`)
        }
      }
    }

    // «نهاية الأسبوع» → الخميس، آخر يوم عمل. «نهاية الشهر» → آخر يوم.
    if (["نهايه", "اخر", "آخر"].includes(token.norm) && next) {
      if (["الاسبوع", "اسبوع"].includes(next.norm)) {
        return consume(2, nextWeekday(4, today), "نهاية الأسبوع")
      }
      if (["الشهر", "شهر"].includes(next.norm)) {
        return consume(2, endOfMonthISO(today), "نهاية الشهر")
      }
    }

    if (["اليوم", "اليوم،"].includes(token.norm)) {
      return consume(1, today, "اليوم")
    }

    if (["بكره", "بكرا", "غدا", "غد", "tomorrow"].includes(token.norm)) {
      return consume(1, addDaysISO(today, 1), "غداً")
    }

    const weekday = WEEKDAYS[token.norm]
    if (weekday !== undefined) {
      return consume(1, nextWeekday(weekday, today), token.raw)
    }

    const explicit = explicitDate(token.norm, today)
    if (explicit) return consume(1, explicit, explicit)
  }

  return null
}

function findPriority(
  tokens: Token[]
): { priority: TaskPriority; label: string } | null {
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token.used) continue

    const priority = PRIORITIES[token.norm]
    if (priority === undefined) continue

    // «مهمة» وحدها عنوانٌ محتمل لا أولوية — نطلبها بعد كلمة «أولوية»
    // أو بوصفها آخر كلمة، وإلا تركناها في العنوان.
    const before = tokens[i - 1]
    const isLabelled = before && ["اولويه", "اولوية"].includes(before.norm)
    const isTrailing = tokens.slice(i + 1).every((t) => t.used)

    if (token.norm === "مهمه" && !isLabelled) continue
    if (!isLabelled && !isTrailing) continue

    token.used = true
    if (isLabelled) before.used = true
    return { priority, label: token.raw }
  }

  return null
}

export function parseTaskMessage(
  message: string,
  today: ISODate = todayISO()
): ParsedTask {
  const tokens: Token[] = message
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, norm: normalizeWord(raw), used: false }))

  stripLeadIn(tokens)

  const matched: string[] = []

  const priority = findPriority(tokens)
  if (priority) matched.push(priority.label)

  const date = findDate(tokens, today)
  if (date) matched.push(date.label)

  const title = tokens
    .filter((token) => !token.used)
    .map((token) => token.raw)
    .join(" ")
    .replace(/^[،,\-—:]+|[،,\-—:]+$/g, "")
    .trim()

  return {
    // لو استهلكنا كل شيء فالجملة كلها كانت موعداً — نعيد النص الأصلي
    title: title || message.trim(),
    dueDate: date?.date ?? null,
    priority: priority?.priority ?? "MEDIUM",
    matched,
  }
}
