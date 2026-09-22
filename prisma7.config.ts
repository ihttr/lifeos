import "dotenv/config"

import { defineConfig } from "prisma/config"

/**
 * يفحص رابط القاعدة قبل تمريره لـ Prisma.
 *
 * بدونه يفشل `prisma migrate deploy` بالخطأ P1013 الذي لا يذكر السبب،
 * وأكثر أسبابه شيوعاً لصق القيمة ومعها علامات تنصيص أو بادئة `psql '`
 * أو تمرير رابط Accelerate بصيغة prisma+postgres:// لمحوّل التعريف.
 *
 * نطبع البادئة والطول فقط — لا نكشف بيانات الاعتماد في سجل البناء.
 */
function databaseUrl(): string {
  const raw = process.env["DATABASE_URL"]

  if (!raw || raw.trim() === "") {
    throw new Error(
      "DATABASE_URL فارغ أو غير معرّف.\n" +
        "محلياً: انسخ .env.example إلى .env واملأ القيمة.\n" +
        "على Vercel: Settings ← Environment Variables، وتأكد أن المتغير مفعّل لبيئة Production."
    )
  }

  const url = raw.trim()

  if (/^postgres(ql)?:\/\//.test(url)) return url

  // كل ما يسبق "://" هو الصيغة وما قبلها من زوائد — لا يحوي بيانات اعتماد أبداً،
  // لأن اسم المستخدم وكلمة المرور يأتيان بعده. فنعرضه كما هو.
  const separator = url.indexOf("://")
  const prefix =
    separator >= 0
      ? `${url.slice(0, separator + 3)}…`
      : `${url.slice(0, 12).replace(/[a-zA-Z0-9_-]{5,}/g, "…")} (لا يحوي "://" إطلاقاً)`

  throw new Error(
    `DATABASE_URL لا يبدأ بـ postgres:// أو postgresql://\n` +
      `يبدأ بـ: ${JSON.stringify(prefix)} (الطول ${url.length} حرفاً)\n\n` +
      "الأسباب الشائعة:\n" +
      '  • علامتا تنصيص منسوختان مع القيمة — احذف " من الطرفين\n' +
      "  • بادئة \"psql '\" من زر النسخ في Neon — انسخ الرابط وحده\n" +
      '  • اسم المتغير ملصوق معه: DATABASE_URL=postgres…\n' +
      "  • رابط Accelerate بصيغة prisma+postgres:// — استخدم رابط TCP المباشر بدله"
  )
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl(),
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
})
