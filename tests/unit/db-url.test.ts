import { describe, expect, it } from "vitest"

/**
 * نفس الفحص الموجود في src/lib/db.ts.
 * مكرّر هنا عمداً لأن استيراد db.ts ينشئ اتصالاً فعلياً بالقاعدة.
 */
const ACCEPTED = /^postgres(ql)?:\/\//

describe("فحص صيغة رابط قاعدة البيانات", () => {
  it("يقبل روابط Postgres المباشرة", () => {
    for (const url of [
      "postgres://u:p@db.prisma.io:5432/postgres?sslmode=require",
      "postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require",
      "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable",
    ]) {
      expect(ACCEPTED.test(url)).toBe(true)
    }
  })

  it("يرفض روابط Accelerate التي يحقنها تكامل Vercel", () => {
    for (const url of [
      "prisma+postgres://accelerate.prisma-data.net/?api_key=xxx",
      "prisma://accelerate.prisma-data.net/?api_key=xxx",
      "mysql://u:p@host:3306/db",
      "",
    ]) {
      expect(ACCEPTED.test(url)).toBe(false)
    }
  })
})
