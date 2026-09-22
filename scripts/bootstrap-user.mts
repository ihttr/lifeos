/**
 * ينشئ حساب المالك من متغيرات البيئة، أو يحدّث كلمة مروره إن وُجد.
 *
 * يعمل ضمن أمر البناء على Vercel، فلا تحتاج اتصالاً محلياً بقاعدة الإنتاج
 * لإنشاء حسابك: تضع SEED_USER_EMAIL و SEED_USER_PASSWORD في متغيرات المشروع
 * وينشأ الحساب عند أول نشر.
 *
 * آمن التكرار: لا يلمس أي بيانات أخرى، ولا يحذف شيئاً.
 * وبما أنه يحدّث كلمة المرور في كل تشغيل، فهو أيضاً وسيلتك لإعادة تعيينها:
 * غيّر المتغيّر في Vercel وأعد النشر.
 *
 * يتخطّى العملية بهدوء إن لم تُضبط المتغيرات، حتى لا تفشل نشرات المعاينة.
 */

import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

import { PrismaClient } from "../src/generated/prisma/client"

const email = (process.env.SEED_USER_EMAIL ?? "").toLowerCase().trim()
const password = process.env.SEED_USER_PASSWORD ?? ""
const name = process.env.SEED_USER_NAME?.trim() || null

if (!email || !password) {
  console.log(
    "↷ تخطّي إنشاء الحساب: SEED_USER_EMAIL أو SEED_USER_PASSWORD غير مضبوط."
  )
  process.exit(0)
}

if (password.length < 10) {
  console.error("✗ اجعل SEED_USER_PASSWORD عشرة أحرف على الأقل.")
  process.exit(1)
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("✗ DATABASE_URL غير معرّف.")
  process.exit(1)
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString, max: 2 }),
})

try {
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  })

  const passwordHash = await bcrypt.hash(password, 12)

  await db.user.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  })

  console.log(
    existing
      ? `✓ حُدّثت كلمة مرور الحساب: ${email}`
      : `✓ أُنشئ الحساب: ${email}`
  )
} finally {
  await db.$disconnect()
}
