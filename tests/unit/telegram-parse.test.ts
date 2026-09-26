import { describe, expect, it } from "vitest"

import { arabicDays } from "@/lib/format"
import { parseTaskMessage } from "@/lib/telegram-parse"

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
