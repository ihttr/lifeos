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
  "بوت ", // ما ينشئه اختبار تيليجرام عبر الـ webhook
  "أرشيف ", // ما ينشئه اختبار الأرشيف
]

/** الحركات المالية تستخدم تصنيفاً عشوائياً بهذه البادئة */
const TRANSACTION_PREFIX = "تصنيف"

/**
 * الأرشيف أولاً وبمفرده: حذف السجل لا يحذف الملف من القرص، فنقرأ
 * المسارات ثم نحذفها يدوياً — وإلا تراكمت ملفات يتيمة لا يشير إليها شيء.
 */
const staleFiles = await db.archiveFile.findMany({
  where: {
    isDemo: false,
    OR: PREFIXES.map((p) => ({ title: { startsWith: p } })),
  },
  select: { id: true, pathname: true },
})

if (staleFiles.length > 0) {
  const { rm } = await import("node:fs/promises")
  const { resolve, sep } = await import("node:path")
  const root = resolve(process.cwd(), ".storage")

  for (const file of staleFiles) {
    const full = resolve(root, file.pathname)
    // لا نخرج من جذر التخزين مهما كان المسار المخزّن
    if (!full.startsWith(root + sep)) continue
    await rm(full, { force: true })
    await rm(`${full}.meta`, { force: true })
  }

  await db.archiveFile.deleteMany({
    where: { id: { in: staleFiles.map((f) => f.id) } },
  })
}

const [
  tasks,
  projects,
  notes,
  goals,
  assignments,
  exams,
  subjects,
  transactions,
] = await Promise.all([
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
  // الواجبات والاختبارات قبل المواد: حذف المادة يجرفها بالـ cascade،
  // لكن اختبارات البوت تنشئها تحت مواد تجريبية حقيقية تبقى.
  db.assignment.deleteMany({
    where: {
      isDemo: false,
      OR: PREFIXES.map((p) => ({ title: { startsWith: p } })),
    },
  }),
  db.exam.deleteMany({
    where: {
      isDemo: false,
      OR: PREFIXES.map((p) => ({ title: { startsWith: p } })),
    },
  }),
  db.subject.deleteMany({
    where: { isDemo: false, OR: PREFIXES.map((p) => ({ name: { startsWith: p } })) },
  }),
  db.transaction.deleteMany({
    where: { isDemo: false, category: { startsWith: TRANSACTION_PREFIX } },
  }),
])

console.log(
  `حُذف: ${staleFiles.length} ملف أرشيف، ${tasks.count} مهمة، ${projects.count} مشروع، ${notes.count} ملاحظة، ` +
    `${goals.count} هدف، ${assignments.count} واجب، ${exams.count} اختبار، ` +
    `${subjects.count} مادة، ${transactions.count} حركة`
)


await db.$disconnect()
