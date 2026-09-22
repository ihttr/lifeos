import { describe, expect, it } from "vitest"
import { z } from "zod"

import { httpUrl, requiredText, tagNames } from "@/schemas/common"
import { taskFiltersSchema, taskInputSchema } from "@/schemas/task"

describe("التحقق من النصوص", () => {
  const schema = z.object({ title: requiredText(10) })

  it("يرفض الحقل الناقص والفارغ والمسافات وحدها برسالة واحدة", () => {
    for (const input of [{}, { title: "" }, { title: "   " }]) {
      const result = schema.safeParse(input)
      expect(result.success).toBe(false)
      expect(z.flattenError(result.error!).fieldErrors.title).toEqual([
        "errors.required",
      ])
    }
  })

  it("يقصّ المسافات ويرفض الطويل", () => {
    expect(schema.parse({ title: "  مهمة  " })).toEqual({ title: "مهمة" })
    expect(schema.safeParse({ title: "x".repeat(11) }).success).toBe(false)
  })
})

describe("التحقق من الروابط", () => {
  it("يقبل http و https فقط", () => {
    expect(httpUrl.safeParse("https://example.com").success).toBe(true)
    expect(httpUrl.safeParse("http://example.com").success).toBe(true)
  })

  it("يرفض البروتوكولات الخطرة — هذا ما يمنع XSS عبر الروابط", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "not-a-url",
    ]) {
      expect(httpUrl.safeParse(bad).success).toBe(false)
    }
  })
})

describe("الوسوم", () => {
  const schema = z.object({ tags: tagNames })

  it("يفصل بالفاصلة العربية واللاتينية معاً", () => {
    expect(schema.parse({ tags: "برمجة، مذاكرة,عاجل" }).tags).toEqual([
      "برمجة",
      "مذاكرة",
      "عاجل",
    ])
  })

  it("يحذف الفراغات والتكرار", () => {
    expect(schema.parse({ tags: " أ , , أ ,ب " }).tags).toEqual(["أ", "ب"])
    expect(schema.parse({}).tags).toEqual([])
  })

  it("يقبل مصفوفة من FormData متعدد القيم", () => {
    expect(schema.parse({ tags: ["أ", "ب"] }).tags).toEqual(["أ", "ب"])
  })
})

describe("مدخلات المهمة", () => {
  it("يطبّق القيم الافتراضية ويحوّل الفراغ إلى null", () => {
    const parsed = taskInputSchema.parse({ title: "مهمة" })

    expect(parsed.status).toBe("TODO")
    expect(parsed.priority).toBe("MEDIUM")
    expect(parsed.recurrence).toBe("NONE")
    expect(parsed.dueDate).toBeNull()
    expect(parsed.projectId).toBeNull()
  })

  it("يحوّل قيمة 'none' في القوائم إلى null", () => {
    const parsed = taskInputSchema.parse({ title: "مهمة", projectId: "none" })
    expect(parsed.projectId).toBeNull()
  })

  it("يرفض تاريخاً أو وقتاً بصيغة خاطئة", () => {
    expect(
      taskInputSchema.safeParse({ title: "مهمة", dueDate: "10/03/2026" }).success
    ).toBe(false)
    expect(
      taskInputSchema.safeParse({ title: "مهمة", dueTime: "25:00" }).success
    ).toBe(false)
    expect(
      taskInputSchema.safeParse({ title: "مهمة", dueTime: "09:30" }).success
    ).toBe(true)
  })
})

describe("معايير التصفية من الرابط", () => {
  it("يتجاهل القيم غير الصالحة بدل أن ينهار", () => {
    const filters = taskFiltersSchema.parse({
      view: "غير-موجود",
      status: "NOPE",
      sort: "???",
      archived: "maybe",
    })

    expect(filters.view).toBe("list")
    expect(filters.status).toBeUndefined()
    expect(filters.sort).toBe("manual")
    expect(filters.archived).toBe(false)
  })

  it("يقرأ القيم الصالحة", () => {
    const filters = taskFiltersSchema.parse({
      view: "board",
      status: "DONE",
      archived: "true",
      month: "2026-03",
    })

    expect(filters.view).toBe("board")
    expect(filters.status).toBe("DONE")
    expect(filters.archived).toBe(true)
    expect(filters.month).toBe("2026-03")
  })
})
