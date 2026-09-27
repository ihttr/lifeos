import { describe, expect, it } from "vitest"

import { arabicDays } from "@/lib/format"
import {
  matchSubject,
  parseMessage,
  parseTaskMessage,
} from "@/lib/telegram-parse"

/**
 * 2026-09-27 هو الأحد — بداية الأسبوع عندنا.
 * تثبيت اليوم يجعل حساب أسماء الأيام حتمياً.
 */
const SUNDAY = "2026-09-27"

const parse = (text: string) => parseTaskMessage(text, SUNDAY)

describe("parseTaskMessage — المواعيد النسبية", () => {
  it("«بكرة» و«غداً» تعطيان الغد", () => {
    expect(parse("حل الواجب بكرة").dueDate).toBe("2026-09-28")
    expect(parse("حل الواجب غداً").dueDate).toBe("2026-09-28")
    expect(parse("حل الواجب غدا").dueDate).toBe("2026-09-28")
  })

  it("«اليوم» تعطي اليوم، و«بعد غد» تعطي يومين", () => {
    expect(parse("مراجعة اليوم").dueDate).toBe(SUNDAY)
    expect(parse("مراجعة بعد غد").dueDate).toBe("2026-09-29")
  })

  it("«بعد أسبوع» و«بعد أسبوعين» و«بعد يومين»", () => {
    expect(parse("تسليم بعد اسبوع").dueDate).toBe("2026-10-04")
    expect(parse("تسليم بعد أسبوعين").dueDate).toBe("2026-10-11")
    expect(parse("تسليم بعد يومين").dueDate).toBe("2026-09-29")
  })

  it("«بعد N أيام» بالأرقام العربية والإنجليزية", () => {
    expect(parse("تسليم بعد 3 ايام").dueDate).toBe("2026-09-30")
    expect(parse("تسليم بعد ٣ أيام").dueDate).toBe("2026-09-30")
    expect(parse("تسليم بعد 2 اسابيع").dueDate).toBe("2026-10-11")
  })

  it("«بعد شهر» يقفز شهراً لا ثلاثين يوماً", () => {
    expect(parse("تقرير بعد شهر").dueDate).toBe("2026-10-27")
    expect(parse("تقرير بعد شهرين").dueDate).toBe("2026-11-27")
  })
})

describe("parseTaskMessage — أسماء الأيام", () => {
  it("اليوم القادم بذلك الاسم", () => {
    expect(parse("مذاكرة الخميس").dueDate).toBe("2026-10-01")
    expect(parse("مذاكرة الأربعاء").dueDate).toBe("2026-09-30")
    expect(parse("مذاكرة السبت").dueDate).toBe("2026-10-03")
  })

  it("اسم اليوم الحالي يعني اليوم لا الأسبوع القادم", () => {
    // من يقول «الأحد» يوم الأحد يقصد اليوم عادةً
    expect(parse("مذاكرة الأحد").dueDate).toBe(SUNDAY)
  })

  it("«نهاية الأسبوع» = الخميس، آخر يوم عمل", () => {
    expect(parse("تنظيف نهاية الأسبوع").dueDate).toBe("2026-10-01")
  })

  it("«نهاية الشهر» = آخر يوم في الشهر", () => {
    expect(parse("دفع الفاتورة نهاية الشهر").dueDate).toBe("2026-09-30")
  })
})

describe("parseTaskMessage — التواريخ الصريحة", () => {
  it("صيغة ISO تمرّ كما هي", () => {
    expect(parse("تسليم 2026-10-05").dueDate).toBe("2026-10-05")
  })

  it("اليوم أولاً على العادة العربية", () => {
    expect(parse("تسليم 5/10").dueDate).toBe("2026-10-05")
    expect(parse("تسليم 5-10-2026").dueDate).toBe("2026-10-05")
  })

  it("تاريخ بلا سنة وقد مضى يعني السنة القادمة", () => {
    expect(parse("ميلاد 1/3").dueDate).toBe("2027-03-01")
  })

  it("يرفض ما ليس تاريخاً", () => {
    expect(parse("قراءة 45/99").dueDate).toBeNull()
  })
})

describe("parseTaskMessage — العنوان", () => {
  it("يحذف فعل الإضافة وكلمة «مهمة» من البداية", () => {
    expect(parse("ضيف مهمة حل الواجب بكرة").title).toBe("حل الواجب")
    expect(parse("أضف مهمه مراجعة الفصل").title).toBe("مراجعة الفصل")
  })

  it("يحذف كلمة الربط قبل الموعد", () => {
    expect(parse("حل واجب ينتهي بكرة").title).toBe("حل واجب")
    expect(parse("حل واجب بتاريخ 2026-10-05").title).toBe("حل واجب")
    expect(parse("اختبار يوم الخميس").title).toBe("اختبار")
  })

  it("يبقي «مهمة» في الوسط لأنها قد تكون من العنوان", () => {
    expect(parse("مراجعة مهمة القراءة بكرة").title).toBe("مراجعة مهمة القراءة")
  })

  it("جملة بلا موعد تبقى عنواناً كاملاً", () => {
    const result = parse("اتصل بالدكتور")
    expect(result.title).toBe("اتصل بالدكتور")
    expect(result.dueDate).toBeNull()
    expect(result.priority).toBe("MEDIUM")
  })

  it("لا يعيد عنواناً فارغاً أبداً", () => {
    // الجملة كلها موعد — نعيد النص الأصلي بدل عنوان فارغ يرفضه Zod
    expect(parse("بكرة").title).toBe("بكرة")
  })
})

describe("parseTaskMessage — الأولوية", () => {
  it("«عاجل» في آخر الجملة", () => {
    const result = parse("تسليم التقرير بعد اسبوع عاجل")
    expect(result.priority).toBe("URGENT")
    expect(result.title).toBe("تسليم التقرير")
  })

  it("«أولوية عالية» صريحة", () => {
    const result = parse("مراجعة أولوية عالية")
    expect(result.priority).toBe("HIGH")
    expect(result.title).toBe("مراجعة")
  })

  it("«مهم» وحدها في الوسط تبقى عنواناً", () => {
    // «شي مهم جداً» عنوان لا تصنيف أولوية
    expect(parse("شي مهم جدا").priority).toBe("MEDIUM")
  })

  it("الافتراضي MEDIUM", () => {
    expect(parse("اتصل بالدكتور بكرة").priority).toBe("MEDIUM")
  })
})

describe("parseTaskMessage — يجمع الموعد والأولوية والعنوان", () => {
  it("مثال المستخدم الأصلي", () => {
    const result = parse("ضيف مهمه حل واجب ينتهي بتاريخ 2026-10-05")
    expect(result).toMatchObject({
      title: "حل واجب",
      dueDate: "2026-10-05",
      priority: "MEDIUM",
    })
  })

  it("يعيد ما فهمه ليُعرض للمستخدم", () => {
    expect(parse("تسليم المشروع الخميس عاجل").matched).toEqual([
      "عاجل",
      "الخميس",
    ])
  })
})

describe("arabicDays", () => {
  it("يتبع صيغ العدد العربية", () => {
    expect(arabicDays(1)).toBe("يوم")
    expect(arabicDays(2)).toBe("يومين")
    expect(arabicDays(3)).toBe("3 أيام")
    expect(arabicDays(10)).toBe("10 أيام")
    expect(arabicDays(11)).toBe("11 يوماً")
  })
})

// ------------------------------------------------------------------ النوايا

describe("parseMessage — توجيه النية", () => {
  const at = (text: string) => parseMessage(text, SUNDAY)

  it("الافتراضي مهمة", () => {
    expect(at("حل الواجب بكرة").kind).toBe("task")
    expect(at("ضيف مهمة مراجعة").kind).toBe("task")
  })

  it("«واجب» في البداية تعني واجباً جامعياً", () => {
    const result = at("ضيف واجب علوم البيانات ينتهي السبت")
    expect(result).toMatchObject({ kind: "assignment", dueDate: "2026-10-03" })
  })

  it("«اختبار» في البداية تعني اختباراً", () => {
    expect(at("ضيف اختبار الشبكات الثلاثاء")).toMatchObject({
      kind: "exam",
      dueDate: "2026-09-29",
    })
  })

  it("«مهمة» صريحة تتقدّم على «واجب» في الوسط", () => {
    // الالتباس الحقيقي: «حل واجب» عنوان مهمة لا واجب جامعي
    const result = at("ضيف مهمة حل واجب الشبكات بكرة")
    expect(result.kind).toBe("task")
    expect(result).toMatchObject({ title: "حل واجب الشبكات" })
  })

  it("«واجب» في وسط الجملة بلا فعل إضافة تبقى مهمة", () => {
    expect(at("راجع واجب الشبكات بكرة").kind).toBe("task")
  })
})

describe("parseMessage — الإنجاز", () => {
  const at = (text: string) => parseMessage(text, SUNDAY)

  it("يلتقط أفعال الإنجاز مع نص البحث", () => {
    expect(at("خلصت واجب الشبكات")).toEqual({
      kind: "done",
      query: "واجب الشبكات",
    })
    expect(at("انتهيت من التقرير")).toEqual({ kind: "done", query: "التقرير" })
    expect(at("سويت المراجعة")).toEqual({ kind: "done", query: "المراجعة" })
  })

  it("«خلصته» المجرّدة تعطي بحثاً فارغاً", () => {
    expect(at("خلصته")).toEqual({ kind: "done", query: "" })
  })

  it("فعل الإنجاز في الوسط لا يُفعّل الإنجاز", () => {
    // «مهمة خلصت منها» عنوانٌ لا أمر إنجاز
    expect(at("راجع ما خلصت منه").kind).toBe("task")
  })
})

// ------------------------------------------------------------------ المواد

describe("matchSubject", () => {
  const subjects = [
    { id: "s1", name: "علوم البيانات", code: "CS340" },
    { id: "s2", name: "شبكات الحاسب", code: null },
    { id: "s3", name: "قواعد البيانات", code: "CS210" },
  ]

  const match = (text: string) => matchSubject(text, subjects)

  it("يطابق الاسم كاملاً", () => {
    expect(match("علوم البيانات")?.subject.id).toBe("s1")
  })

  it("يطابق باسم جزئي — الناس لا يكتبون الاسم كاملاً", () => {
    expect(match("الشبكات")?.subject.id).toBe("s2")
    expect(match("شبكات")?.subject.id).toBe("s2")
  })

  it("الأكثر تطابقاً يفوز على العام", () => {
    // «البيانات» وحدها تطابق مادتين، لكن «قواعد» تحسمها
    expect(match("قواعد البيانات")?.subject.id).toBe("s3")
    expect(match("علوم البيانات")?.subject.id).toBe("s1")
  })

  it("يطابق برمز المادة", () => {
    expect(match("cs340")?.subject.id).toBe("s1")
  })

  it("يعيد ما تبقّى عنواناً", () => {
    expect(match("المشروع النهائي شبكات")).toMatchObject({
      rest: "المشروع النهائي",
    })
  })

  it("يحذف «لمادة» قبل الاسم", () => {
    expect(match("المشروع لمادة شبكات")?.rest).toBe("المشروع")
  })

  it("بلا اسم مادة يعيد null بدل تخمين", () => {
    expect(match("شيء غير مرتبط")).toBeNull()
  })

  it("لا يطابق بكلمة قصيرة", () => {
    // «في» و«ال» تظهر في كل مكان فلا تصلح دليلاً
    expect(matchSubject("في", subjects)).toBeNull()
  })
})
