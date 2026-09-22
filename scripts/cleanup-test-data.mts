/**
 * يحذف المهام والمشاريع والملاحظات التي خلّفتها اختبارات المتصفح.
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

const PREFIXES = ["اختبار ", "مشروع اختبار ", "ملاحظة اختبار "]

const [tasks, projects, notes] = await Promise.all([
  db.task.deleteMany({
    where: { isDemo: false, OR: PREFIXES.map((p) => ({ title: { startsWith: p } })) },
  }),
  db.project.deleteMany({
    where: { isDemo: false, OR: PREFIXES.map((p) => ({ name: { startsWith: p } })) },
  }),
  db.note.deleteMany({
    where: { isDemo: false, OR: PREFIXES.map((p) => ({ title: { startsWith: p } })) },
  }),
])

console.log(
  `حُذف: ${tasks.count} مهمة، ${projects.count} مشروع، ${notes.count} ملاحظة`
)

await db.$disconnect()
