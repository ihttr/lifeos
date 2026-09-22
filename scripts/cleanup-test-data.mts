/**
 * يحذف ما خلّفته اختبارات المتصفح، خاصةً بعد تشغيل فاشل
 * لا يصل لخطوة الحذف في نهاية الاختبار.
 * بياناتك الحقيقية والتجريبية (isDemo) لا تُمس.
 *
 *   npm run db:clean-tests
 */

import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 2 }),
})

const PREFIXES = [
  "اختبار ",
  "مشروع اختبار ",
  "ملاحظة اختبار ",
  "هدف اختبار ",
  "مادة اختبار ",
  "واجب اختبار ",
]

/** الحركات المالية تستخدم تصنيفاً عشوائياً بهذه البادئة */
const TRANSACTION_PREFIX = "تصنيف"

const [tasks, projects, notes, goals, subjects, transactions] = await Promise.all([
  db.task.deleteMany({
    where: { isDemo: false, OR: PREFIXES.map((p) => ({ title: { startsWith: p } })) },
  }),
  db.project.deleteMany({
    where: { isDemo: false, OR: PREFIXES.map((p) => ({ name: { startsWith: p } })) },
  }),
  db.note.deleteMany({
    where: { isDemo: false, OR: PREFIXES.map((p) => ({ title: { startsWith: p } })) },
  }),
  db.goal.deleteMany({
    where: { isDemo: false, OR: PREFIXES.map((p) => ({ title: { startsWith: p } })) },
  }),
  db.subject.deleteMany({
    where: { isDemo: false, OR: PREFIXES.map((p) => ({ name: { startsWith: p } })) },
  }),
  db.transaction.deleteMany({
    where: { isDemo: false, category: { startsWith: TRANSACTION_PREFIX } },
  }),
])

console.log(
  `حُذف: ${tasks.count} مهمة، ${projects.count} مشروع، ${notes.count} ملاحظة، ` +
    `${goals.count} هدف، ${subjects.count} مادة، ${transactions.count} حركة`
)

await db.$disconnect()
