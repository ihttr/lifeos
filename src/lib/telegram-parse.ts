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

/** أفعال الإضافة: «ضيف ...» / «أضف ...» */
const ADD_VERBS = ["ضيف", "اضف", "اضافه", "سجل", "add", "new"]

/**
 * كلمة النية تأتي مباشرة بعد فعل الإضافة، وهذا التقييد بالموضع هو ما
 * يفكّ الالتباس: «ضيف مهمة حل واجب الشبكات» مهمةٌ لأن «مهمة» جاءت أولاً،
 * بينما «ضيف واجب الشبكات» واجبٌ جامعي. لو قبلنا الكلمة من وسط الجملة
 * لانقلب كل عنوان فيه كلمة «واجب» إلى واجب جامعي.
 */
const INTENT_WORDS: Record<string, "task" | "assignment" | "exam"> = {
  مهمه: "task",
  تاسك: "task",
  task: "task",
  todo: "task",
  واجب: "assignment",
  الواجب: "assignment",
  تكليف: "assignment",
  اختبار: "exam",
  الاختبار: "exam",
  امتحان: "exam",
  كويز: "exam",
}

/** أفعال الإنجاز — لا تُقبل إلا في أول الجملة */
const DONE_VERBS = new Set([
  "خلصت",
  "خلصته",
  "خلصتها",
  "خلص",
  "انتهيت",
  "سويت",
  "سويته",
  "سويتها",
  "انجزت",
  "أنجزت",
  "done",
])

/** تُحذف بعد فعل الإنجاز: «انتهيت من الواجب» */
const DONE_FILLER = new Set(["من", "ال", "the"])

/** تسبق اسم المادة أحياناً: «واجب المشروع لمادة قواعد البيانات» */
export const SUBJECT_LEAD = new Set([
  "ماده",
  "لماده",
  "بماده",
  "مقرر",
  "لمقرر",
])

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
 * يحذف فعل الإضافة وكلمة النية من البداية، ويعيد النية المكتشفة.
 * الافتراضي مهمة: أغلب ما يُرسل للبوت مهمة، وكلمة النية استثناء.
 *
 * @param taskOnly لا يبتلع إلا كلمات المهام. تستخدمه parseTaskMessage
 *   لأن «اختبار الشبكات الخميس» كعنوان مهمة يجب أن يبقى عنوانه كاملاً —
 *   توجيه النية مسؤولية parseMessage وحدها.
 */
function stripLeadIn(
  tokens: Token[],
  taskOnly = false
): "task" | "assignment" | "exam" {
  let index = 0

  const verb = tokens[index]
  if (verb && !verb.used && ADD_VERBS.includes(verb.norm)) {
    verb.used = true
    index += 1
  }

  const word = tokens[index]
  const intent = word && !word.used ? INTENT_WORDS[word.norm] : undefined

  if (intent && (!taskOnly || intent === "task")) word.used = true

  return intent ?? "task"
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
    if (
      token.norm === "بعد" &&
      next &&
      ["غد", "بكره", "بكرا"].includes(next.norm)
    ) {
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

function tokenize(message: string): Token[] {
  return message
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, norm: normalizeWord(raw), used: false }))
}

function joinUnused(tokens: Token[]): string {
  return tokens
    .filter((token) => !token.used)
    .map((token) => token.raw)
    .join(" ")
    .replace(/^[،,\-—:]+|[،,\-—:]+$/g, "")
    .trim()
}

export function parseTaskMessage(
  message: string,
  today: ISODate = todayISO()
): ParsedTask {
  const tokens = tokenize(message)
  stripLeadIn(tokens, true)

  const matched: string[] = []

  const priority = findPriority(tokens)
  if (priority) matched.push(priority.label)

  const date = findDate(tokens, today)
  if (date) matched.push(date.label)

  const title = joinUnused(tokens)

  return {
    // لو استهلكنا كل شيء فالجملة كلها كانت موعداً — نعيد النص الأصلي
    title: title || message.trim(),
    dueDate: date?.date ?? null,
    priority: priority?.priority ?? "MEDIUM",
    matched,
  }
}

// ------------------------------------------------------------------ النوايا

export type ParsedMessage =
  | ({ kind: "task" } & ParsedTask)
  | {
      kind: "assignment" | "exam"
      /** ما بقي بعد نزع الفعل والنية والموعد — منه تُستخرج المادة ثم العنوان */
      rest: string
      dueDate: ISODate | null
      matched: string[]
    }
  | {
      kind: "done"
      /** ما يبحث عنه المستخدم، أو فارغ إن قال «خلصته» مجرّدة */
      query: string
    }

/**
 * يحدّد ماذا يريد المستخدم من الرسالة.
 *
 * الترتيب مقصود: الإنجاز أولاً لأن «خلصت الواجب» لو مرّت على مسار
 * الإضافة لأنشأت واجباً جديداً بدل أن تُنهي القائم — وهو خطأ صامت
 * ومزعج، عكس فشل الفهم الذي يظهر فوراً.
 */
export function parseMessage(
  message: string,
  today: ISODate = todayISO()
): ParsedMessage {
  const tokens = tokenize(message)
  const first = tokens[0]

  if (first && DONE_VERBS.has(first.norm)) {
    first.used = true
    // «انتهيت من الواجب» — حشوٌ بعد الفعل لا معنى له في البحث
    for (let i = 1; i < tokens.length; i += 1) {
      if (!DONE_FILLER.has(tokens[i].norm)) break
      tokens[i].used = true
    }
    return { kind: "done", query: joinUnused(tokens) }
  }

  const intent = stripLeadIn(tokens)

  if (intent === "task") {
    return { kind: "task", ...parseTaskMessage(message, today) }
  }

  const matched: string[] = []
  const date = findDate(tokens, today)
  if (date) matched.push(date.label)

  return {
    kind: intent,
    rest: joinUnused(tokens),
    dueDate: date?.date ?? null,
    matched,
  }
}

// ------------------------------------------------------------------ المواد

export type SubjectLike = { id: string; name: string; code: string | null }

export type SubjectMatch = {
  subject: SubjectLike
  /** ما تبقّى بعد نزع اسم المادة — عنوان الواجب إن وُجد */
  rest: string
}

/** الكلمات القصيرة («في»، «ال») تطابق كل شيء فلا تصلح دليلاً */
const MIN_MATCH_LENGTH = 3

/**
 * ينزع أداة التعريف للمقارنة.
 *
 * ضروري لا تحسين: المادة مسجّلة «شبكات الحاسب» والمستخدم يكتب
 * «الشبكات» — وبلا هذا تفشل أكثر المطابقات شيوعاً. نشترط بقاء ثلاثة
 * أحرف حتى لا تتحول «الان» إلى «ان».
 */
function stem(word: string): string {
  if (word.startsWith("ال") && word.length - 2 >= MIN_MATCH_LENGTH) {
    return word.slice(2)
  }
  return word
}

/**
 * يطابق اسم مادة داخل الجملة، ويعيد ما تبقّى منها.
 *
 * المطابقة بالكلمات لا بالنص الكامل، فـ«الشبكات» تطابق «شبكات الحاسب»
 * و«علوم بيانات» تطابق «علوم البيانات» — الناس لا يكتبون أسماء المواد
 * كما سُجّلت بالضبط. والأكثر تطابقاً يفوز حتى لا تختطف مادةٌ عامة
 * الاسمَ من مادة أدق.
 */
export function matchSubject(
  text: string,
  subjects: SubjectLike[]
): SubjectMatch | null {
  const tokens = tokenize(text)

  let best: { subject: SubjectLike; hits: number[]; ratio: number } | null =
    null

  for (const subject of subjects) {
    const words = new Set(
      tokenize(subject.name)
        .map((t) => t.norm)
        .filter((w) => w.length >= MIN_MATCH_LENGTH)
        .map(stem)
    )
    const code = subject.code ? normalizeWord(subject.code) : null

    const hits: number[] = []
    tokens.forEach((token, index) => {
      if (words.has(stem(token.norm)) || (code && token.norm === code))
        hits.push(index)
    })

    if (!hits.length) continue

    const ratio = hits.length / Math.max(words.size, 1)
    if (
      !best ||
      hits.length > best.hits.length ||
      (hits.length === best.hits.length && ratio > best.ratio)
    ) {
      best = { subject, hits, ratio }
    }
  }

  if (!best) return null

  for (const index of best.hits) tokens[index].used = true

  // كلمة «لمادة» قبل الاسم لا معنى لها في العنوان
  const before = tokens[Math.min(...best.hits) - 1]
  if (before && !before.used && SUBJECT_LEAD.has(before.norm))
    before.used = true

  return { subject: best.subject, rest: joinUnused(tokens) }
}
