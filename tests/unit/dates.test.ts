import { afterEach, describe, expect, it, vi } from "vitest"

import {
  addDaysISO,
  addMonthsISO,
  dateColumnToISO,
  daysFromToday,
  endOfMonthISO,
  greetingKey,
  isOverdue,
  isoToDateColumn,
  monthGridISO,
  riyadhDateTimeToUTC,
  startOfWeekISO,
  toISODateInTZ,
  todayISO,
} from "@/lib/dates"

afterEach(() => {
  vi.useRealTimers()
})

/** يثبّت "الآن" على لحظة UTC محددة */
function freeze(iso: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
}

describe("المنطقة الزمنية", () => {
  it("يحسب تاريخ اليوم بتوقيت الرياض لا بتوقيت UTC", () => {
    // 22:30 UTC = 01:30 من اليوم التالي في الرياض (UTC+3)
    freeze("2026-03-10T22:30:00.000Z")
    expect(todayISO()).toBe("2026-03-11")

    // 20:00 UTC = 23:00 من نفس اليوم في الرياض
    freeze("2026-03-10T20:00:00.000Z")
    expect(todayISO()).toBe("2026-03-10")
  })

  it("يحوّل لحظة زمنية إلى تاريخها التقويمي في الرياض", () => {
    expect(toISODateInTZ(new Date("2026-03-10T21:05:00.000Z"))).toBe("2026-03-11")
    expect(toISODateInTZ(new Date("2026-03-10T05:05:00.000Z"))).toBe("2026-03-10")
  })

  it("يدمج تاريخاً ووقتاً بتوقيت الرياض في لحظة UTC صحيحة", () => {
    expect(riyadhDateTimeToUTC("2026-03-10", "10:00").toISOString()).toBe(
      "2026-03-10T07:00:00.000Z"
    )
  })
})

describe("حقول التاريخ في القاعدة", () => {
  it("يذهب ويعود بلا انزياح يوم", () => {
    const iso = "2026-02-28"
    const column = isoToDateColumn(iso)
    expect(column?.toISOString()).toBe("2026-02-28T00:00:00.000Z")
    expect(dateColumnToISO(column)).toBe(iso)
  })

  it("يتعامل مع القيم الفارغة", () => {
    expect(isoToDateColumn(null)).toBeNull()
    expect(dateColumnToISO(null)).toBeNull()
  })
})

describe("حساب الأيام", () => {
  it("يعدّ الأيام بإشارة صحيحة", () => {
    expect(daysFromToday("2026-03-12", "2026-03-10")).toBe(2)
    expect(daysFromToday("2026-03-08", "2026-03-10")).toBe(-2)
    expect(daysFromToday("2026-03-10", "2026-03-10")).toBe(0)
  })

  it("يعتبر ما قبل اليوم متأخراً فقط", () => {
    expect(isOverdue("2026-03-09", "2026-03-10")).toBe(true)
    expect(isOverdue("2026-03-10", "2026-03-10")).toBe(false)
    expect(isOverdue("2026-03-11", "2026-03-10")).toBe(false)
    expect(isOverdue(null, "2026-03-10")).toBe(false)
  })

  it("يضيف الأيام عبر حدود الشهر والسنة", () => {
    expect(addDaysISO("2026-02-27", 2)).toBe("2026-03-01")
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29") // سنة كبيسة
  })

  it("يثبّت نهاية الشهر عند إضافة الشهور", () => {
    expect(addMonthsISO("2026-01-31", 1)).toBe("2026-02-28")
    expect(addMonthsISO("2028-01-31", 1)).toBe("2028-02-29")
    expect(addMonthsISO("2026-03-15", 1)).toBe("2026-04-15")
    expect(addMonthsISO("2026-12-15", 1)).toBe("2027-01-15")
  })
})

describe("الأسبوع والشهر", () => {
  it("يبدأ الأسبوع من الأحد", () => {
    // 2026-03-10 يوافق الثلاثاء
    expect(startOfWeekISO("2026-03-10")).toBe("2026-03-08")
    // الأحد نفسه لا يتغيّر
    expect(startOfWeekISO("2026-03-08")).toBe("2026-03-08")
  })

  it("يحسب آخر يوم في الشهر", () => {
    expect(endOfMonthISO("2026-02-05")).toBe("2026-02-28")
    expect(endOfMonthISO("2028-02-05")).toBe("2028-02-29")
    expect(endOfMonthISO("2026-04-05")).toBe("2026-04-30")
  })

  it("يبني شبكة شهرية كاملة الأسابيع تبدأ بالأحد", () => {
    const grid = monthGridISO("2026-03-01")

    expect(grid.length % 7).toBe(0)
    expect(new Date(`${grid[0]}T00:00:00Z`).getUTCDay()).toBe(0) // أحد
    expect(new Date(`${grid.at(-1)}T00:00:00Z`).getUTCDay()).toBe(6) // سبت
    expect(grid).toContain("2026-03-01")
    expect(grid).toContain("2026-03-31")
  })
})

describe("التحية", () => {
  it("تتبع ساعة الرياض", () => {
    // 06:00 بالرياض = 03:00 UTC
    expect(greetingKey(new Date("2026-03-10T03:00:00.000Z"))).toBe("morning")
    // 14:00 بالرياض = 11:00 UTC
    expect(greetingKey(new Date("2026-03-10T11:00:00.000Z"))).toBe("afternoon")
    // 20:00 بالرياض = 17:00 UTC
    expect(greetingKey(new Date("2026-03-10T17:00:00.000Z"))).toBe("evening")
  })
})
