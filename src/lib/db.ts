import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "@/generated/prisma/client"

/**
 * عميل Prisma وحيد لكل عملية.
 * في التطوير يُعاد استخدامه عبر globalThis حتى لا يفتح Hot Reload اتصالات جديدة كل مرة.
 */

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    "DATABASE_URL غير معرّف. انسخ .env.example إلى .env واملأ القيمة."
  )
}

/**
 * محوّلات التعريف تتوقّع رابط Postgres مباشراً، وتفشل برسالة غامضة
 * مع روابط Accelerate/Prisma Postgres ذات الصيغة prisma+postgres://
 * التي يحقنها تكامل Vercel. نكشف الخطأ هنا برسالة واضحة.
 */
if (!/^postgres(ql)?:\/\//.test(connectionString)) {
  const scheme = connectionString.split("://")[0]
  throw new Error(
    `DATABASE_URL يبدأ بـ "${scheme}://" وهي صيغة لا يفهمها @prisma/adapter-pg.\n` +
      "استخدم رابط TCP المباشر بصيغة postgres:// أو postgresql://\n" +
      "— من Neon: خيار Pooled connection\n" +
      "— من Prisma Postgres: Connection details في console.prisma.io (لا رابط Accelerate)"
  )
}

/**
 * حجم تجمّع الاتصالات.
 *
 * مع Prisma 7 ومحوّلات التعريف، معامل connection_limit في الرابط يُتجاهل —
 * الحد الفعلي هو حد تجمّع pg، فنضبطه هنا صراحةً.
 *
 * خمسة تكفي لمستخدم واحد، وتترك مجالاً لأدوات أخرى (الاختبارات، Prisma Studio)
 * وتحترم سقف اتصالات Neon في الخطة المجانية.
 */
const POOL_MAX = Number(process.env.DATABASE_POOL_MAX ?? 5)

function createClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: POOL_MAX }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}
