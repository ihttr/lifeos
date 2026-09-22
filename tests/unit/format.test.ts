import { describe, expect, it } from "vitest"

import { formatCurrency, formatDuration, percentOf, ratio } from "@/lib/format"

describe("النسب", () => {
  it("لا ينهار عند القسمة على صفر", () => {
    expect(ratio(0, 0)).toBe(0)
    expect(percentOf(0, 0)).toBe(0)
  })

  it("يحسب النسبة ويقرّبها", () => {
    expect(percentOf(1, 2)).toBe(50)
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(2, 3)).toBe(67)
    expect(percentOf(7, 7)).toBe(100)
  })
})

describe("العملة", () => {
  it("يعرض الريال السعودي بأرقام لاتينية في اللغتين", () => {
    for (const locale of ["ar", "en"] as const) {
      const output = formatCurrency(1234.5, locale)
      expect(output).toMatch(/1[,٬]?234\.50/)
      // لا أرقام هندية
      expect(output).not.toMatch(/[٠-٩]/)
    }
  })
})

describe("المدة", () => {
  it("يصوغ الساعات والدقائق", () => {
    expect(formatDuration(0, "en")).toBe("0m")
    expect(formatDuration(25 * 60, "en")).toBe("25m")
    expect(formatDuration(3600, "en")).toBe("1h")
    expect(formatDuration(3600 + 15 * 60, "en")).toBe("1h 15m")
    expect(formatDuration(3600 + 15 * 60, "ar")).toBe("1س 15د")
  })
})
