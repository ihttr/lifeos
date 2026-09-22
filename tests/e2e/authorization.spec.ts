import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { expect, test } from "@playwright/test"

/**
 * أهم اختبار أمني في التطبيق:
 * لا يصل مستخدم لبيانات مستخدم آخر مهما عبث بالمعرّف في الرابط.
 *
 * بيانات المستخدم الثاني تُكتب مباشرة في القاعدة عبر scripts/e2e-fixture.cjs
 * (لا عبر Prisma) حتى يفحص الاختبار الصفوف الحقيقية لا طبقة الـ ORM.
 */

const run = promisify(execFile)

async function fixture<T>(command: "setup" | "verify" | "teardown"): Promise<T> {
  const { stdout } = await run("node", ["scripts/e2e-fixture.cjs", command])
  return JSON.parse(stdout) as T
}

type Ids = { user: string; project: string; task: string; note: string }
type Secrets = { project: string; task: string; note: string }

let ids: Ids
let secrets: Secrets

test.beforeAll(async () => {
  const result = await fixture<{ ids: Ids; secrets: Secrets }>("setup")
  ids = result.ids
  secrets = result.secrets
})

test.afterAll(async () => {
  await fixture("teardown")
})

test.describe("عزل بيانات المستخدمين", () => {
  test("صفحة مشروع مستخدم آخر تعطي 404 ولا تكشف الاسم", async ({ page }) => {
    const response = await page.goto(`/ar/projects/${ids.project}`)

    expect(response?.status()).toBe(404)
    await expect(page.getByText(secrets.project)).toHaveCount(0)
  })

  test("بيانات المستخدم الآخر لا تظهر في أي قائمة", async ({ page }) => {
    for (const path of [
      "/ar/dashboard",
      "/ar/tasks",
      "/ar/tasks?view=board",
      "/ar/projects",
      "/ar/notes",
    ]) {
      await page.goto(path)
      await expect(page.getByText("سرّي")).toHaveCount(0)
      await expect(page.getByText("سرّية")).toHaveCount(0)
    }
  })

  test("البحث لا يسرّب بيانات مستخدم آخر", async ({ page }) => {
    await page.goto(`/ar/tasks?q=${encodeURIComponent("سرّية")}`)
    await expect(page.getByText("لا توجد مهام بعد")).toBeVisible()

    await page.goto(`/ar/notes?q=${encodeURIComponent("سرّية")}`)
    await expect(page.getByText("لا نتائج")).toBeVisible()
  })

  test("سجلات المستخدم الآخر تبقى سليمة بعد محاولات الوصول", async () => {
    const { counts } = await fixture<{ counts: Record<string, number> }>("verify")

    // لو سرّب أي إجراء الصلاحية لكانت هذه السجلات قد تغيّرت أو حُذفت
    expect(counts).toEqual({ Project: 1, Task: 1, Note: 1 })
  })
})
