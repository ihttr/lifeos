import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

import { PrismaClient } from "../src/generated/prisma/client"

/**
 * بذرة البيانات.
 *
 *  - تنشئ (أو تحدّث) حساب المستخدم من متغيرات البيئة.
 *  - تزرع بيانات تجريبية موسومة isDemo:true فقط،
 *    ويمكن حذفها كلها من الإعدادات دون المساس ببياناتك الحقيقية.
 *
 * تشغيلها أكثر من مرة آمن: تُحذف البيانات التجريبية القديمة أولاً.
 */

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error("DATABASE_URL غير معرّف")

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

// ---------------------------------------------------------------- helpers

const TZ = "Asia/Riyadh"

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/** تاريخ بدون وقت، بإزاحة أيام عن اليوم */
function day(offset: number): Date {
  const d = new Date(`${todayISO()}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d
}

/** لحظة زمنية بتوقيت الرياض، بإزاحة أيام عن اليوم */
function at(offset: number, time = "23:59"): Date {
  const d = new Date(`${todayISO()}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return new Date(`${d.toISOString().slice(0, 10)}T${time}:00+03:00`)
}

// ---------------------------------------------------------------- user

async function seedUser() {
  const email = (process.env.SEED_USER_EMAIL ?? "").toLowerCase().trim()
  const password = process.env.SEED_USER_PASSWORD ?? ""
  const name = process.env.SEED_USER_NAME ?? null

  if (!email || !password) {
    throw new Error(
      "املأ SEED_USER_EMAIL و SEED_USER_PASSWORD في .env قبل تشغيل db:seed"
    )
  }
  if (password.length < 10) {
    throw new Error("اجعل SEED_USER_PASSWORD 10 أحرف على الأقل")
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  })

  console.log(`✓ المستخدم: ${user.email}`)
  return user.id
}

// ---------------------------------------------------------------- demo

async function clearDemo(userId: string) {
  // الحذف بالترتيب غير مطلوب — العلاقات onDelete: Cascade تتكفل بالأبناء
  await db.$transaction([
    db.task.deleteMany({ where: { userId, isDemo: true } }),
    db.project.deleteMany({ where: { userId, isDemo: true } }),
    db.note.deleteMany({ where: { userId, isDemo: true } }),
    db.goal.deleteMany({ where: { userId, isDemo: true } }),
    db.learningPath.deleteMany({ where: { userId, isDemo: true } }),
    db.semester.deleteMany({ where: { userId, isDemo: true } }),
    db.transaction.deleteMany({ where: { userId, isDemo: true } }),
    db.bookmark.deleteMany({ where: { userId, isDemo: true } }),
  ])
}

async function seedTags(userId: string) {
  const names = [
    ["عاجل", "oklch(0.6 0.2 25)"],
    ["مذاكرة", "oklch(0.6 0.16 265)"],
    ["برمجة", "oklch(0.62 0.15 148)"],
    ["شخصي", "oklch(0.65 0.14 300)"],
  ] as const

  const tags = await Promise.all(
    names.map(([name, color]) =>
      db.tag.upsert({
        where: { userId_name: { userId, name } },
        update: {},
        create: { userId, name, color },
      })
    )
  )

  return Object.fromEntries(tags.map((tag) => [tag.name, tag.id]))
}

async function seedProjects(userId: string) {
  const downloader = await db.project.create({
    data: {
      userId,
      isDemo: true,
      name: "Media Downloader",
      description:
        "أداة سطر أوامر لتحميل الفيديو والصوت مع تحويل الصيغ ومتابعة التقدم.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      startDate: day(-45),
      deadline: day(21),
      technologies: ["Python", "FastAPI", "yt-dlp", "FFmpeg"],
      githubUrl: "https://github.com/",
      color: "oklch(0.6 0.16 265)",
      milestones: {
        create: [
          { title: "تحميل من رابط واحد", done: true, position: 0 },
          { title: "دعم قوائم التشغيل", done: true, position: 1 },
          { title: "تحويل الصيغ عبر FFmpeg", done: true, position: 2 },
          { title: "واجهة ويب بسيطة", done: false, dueDate: day(10), position: 3 },
          { title: "حزم التطبيق للتوزيع", done: false, dueDate: day(20), position: 4 },
        ],
      },
    },
  })

  const portfolio = await db.project.create({
    data: {
      userId,
      isDemo: true,
      name: "الموقع الشخصي",
      description: "موقع يعرض المشاريع والمقالات، مبني على Next.js.",
      status: "PLANNING",
      priority: "MEDIUM",
      startDate: day(-7),
      deadline: day(45),
      technologies: ["Next.js", "TypeScript", "Tailwind CSS"],
      color: "oklch(0.62 0.15 148)",
      milestones: {
        create: [
          { title: "تصميم الصفحة الرئيسية", done: true, position: 0 },
          { title: "صفحة المشاريع", done: false, position: 1 },
          { title: "مدونة بـ MDX", done: false, position: 2 },
        ],
      },
    },
  })

  return { downloader: downloader.id, portfolio: portfolio.id }
}

async function seedUniversity(userId: string) {
  const previous = await db.semester.create({
    data: {
      userId,
      isDemo: true,
      name: "الفصل الأول ١٤٤٧",
      startDate: day(-200),
      endDate: day(-80),
      isActive: false,
    },
  })

  const semester = await db.semester.create({
    data: {
      userId,
      isDemo: true,
      name: "الفصل الثاني ١٤٤٧",
      startDate: day(-30),
      endDate: day(75),
      isActive: true,
    },
  })

  const subjects = await Promise.all(
    [
      {
        name: "الذكاء الاصطناعي",
        code: "CS461",
        instructor: "د. خالد",
        credits: 3,
        color: "oklch(0.6 0.16 265)",
      },
      {
        name: "قواعد البيانات",
        code: "CS340",
        instructor: "د. سارة",
        credits: 4,
        color: "oklch(0.63 0.13 195)",
      },
      {
        name: "أمن المعلومات",
        code: "CS420",
        instructor: "د. عبدالله",
        credits: 3,
        color: "oklch(0.6 0.2 340)",
      },
      {
        name: "الشبكات",
        code: "CS350",
        instructor: "د. منى",
        credits: 3,
        color: "oklch(0.7 0.16 75)",
      },
    ].map((s) =>
      db.subject.create({
        data: { ...s, userId, semesterId: semester.id, isDemo: true },
      })
    )
  )

  const [ai, dbs, sec, net] = subjects

  await db.assignment.createMany({
    data: [
      {
        userId,
        subjectId: ai.id,
        isDemo: true,
        title: "تقرير خوارزميات البحث",
        description: "مقارنة بين A* و BFS مع أمثلة عملية.",
        dueDate: at(1, "23:59"),
        status: "IN_PROGRESS",
        maxGrade: 10,
      },
      {
        userId,
        subjectId: dbs.id,
        isDemo: true,
        title: "تمرين التطبيع (Normalization)",
        dueDate: at(4, "23:59"),
        status: "TODO",
        maxGrade: 5,
      },
      {
        userId,
        subjectId: sec.id,
        isDemo: true,
        title: "تحليل ثغرة XSS",
        dueDate: at(-3, "23:59"),
        status: "DONE",
        grade: 9.5,
        maxGrade: 10,
      },
      {
        userId,
        subjectId: net.id,
        isDemo: true,
        title: "مشروع تصميم شبكة فرعية",
        dueDate: at(12, "23:59"),
        status: "TODO",
        maxGrade: 15,
      },
    ],
  })

  await db.exam.createMany({
    data: [
      {
        userId,
        subjectId: dbs.id,
        isDemo: true,
        title: "الاختبار النصفي",
        date: at(8, "10:00"),
        location: "قاعة ٣٠٢",
        weight: 30,
      },
      {
        userId,
        subjectId: ai.id,
        isDemo: true,
        title: "اختبار قصير ٢",
        date: at(3, "12:30"),
        location: "معمل ١",
        weight: 10,
      },
    ],
  })

  return { semesterId: semester.id, previousId: previous.id, subjects }
}

async function seedTasks(
  userId: string,
  projects: { downloader: string; portfolio: string },
  subjectId: string,
  tags: Record<string, string>
) {
  const rows: Array<Parameters<typeof db.task.create>[0]["data"]> = [
    {
      userId,
      isDemo: true,
      title: "إنهاء تقرير خوارزميات البحث",
      description: "الجزء المتبقي: أمثلة A* على خريطة شبكية.",
      status: "IN_PROGRESS",
      priority: "URGENT",
      dueDate: day(0),
      dueTime: "20:00",
      subjectId,
      position: 0,
      tags: { connect: [{ id: tags["مذاكرة"] }, { id: tags["عاجل"] }] },
      subtasks: {
        create: [
          { title: "جمع المراجع", done: true, position: 0 },
          { title: "كتابة المقارنة", done: true, position: 1 },
          { title: "إضافة الأمثلة", done: false, position: 2 },
          { title: "مراجعة أخيرة", done: false, position: 3 },
        ],
      },
    },
    {
      userId,
      isDemo: true,
      title: "إصلاح خطأ التحميل عند انقطاع الشبكة",
      description: "إعادة المحاولة تلقائياً ثلاث مرات مع تأخير متزايد.",
      status: "TODO",
      priority: "HIGH",
      dueDate: day(0),
      projectId: projects.downloader,
      position: 1,
      tags: { connect: [{ id: tags["برمجة"] }] },
    },
    {
      userId,
      isDemo: true,
      title: "مراجعة محاضرة الشبكات",
      status: "TODO",
      priority: "MEDIUM",
      dueDate: day(0),
      position: 2,
      tags: { connect: [{ id: tags["مذاكرة"] }] },
    },
    {
      userId,
      isDemo: true,
      title: "تصميم صفحة المشاريع",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      dueDate: day(2),
      projectId: projects.portfolio,
      position: 3,
      tags: { connect: [{ id: tags["برمجة"] }] },
    },
    {
      userId,
      isDemo: true,
      title: "حجز موعد الصيانة الدورية للسيارة",
      status: "TODO",
      priority: "LOW",
      dueDate: day(5),
      position: 4,
      tags: { connect: [{ id: tags["شخصي"] }] },
    },
    {
      userId,
      isDemo: true,
      title: "قراءة ٢٠ صفحة",
      status: "TODO",
      priority: "LOW",
      recurrence: "DAILY",
      dueDate: day(1),
      position: 5,
      tags: { connect: [{ id: tags["شخصي"] }] },
    },
    {
      userId,
      isDemo: true,
      title: "تسليم تمرين التطبيع",
      status: "TODO",
      priority: "HIGH",
      dueDate: day(4),
      subjectId,
      position: 6,
    },
    {
      userId,
      isDemo: true,
      title: "رفع نسخة احتياطية للمشروع",
      status: "DONE",
      priority: "MEDIUM",
      dueDate: day(-1),
      completedAt: at(-1, "18:20"),
      projectId: projects.downloader,
      position: 7,
    },
    {
      userId,
      isDemo: true,
      title: "تحديث السيرة الذاتية",
      status: "DONE",
      priority: "LOW",
      dueDate: day(-2),
      completedAt: at(-2, "14:05"),
      position: 8,
    },
    {
      userId,
      isDemo: true,
      title: "متابعة طلب الدعم الفني",
      status: "TODO",
      priority: "MEDIUM",
      dueDate: day(-2), // متأخرة عمداً
      position: 9,
    },
  ]

  for (const data of rows) await db.task.create({ data })
}

async function seedLearning(userId: string) {
  await db.learningPath.create({
    data: {
      userId,
      isDemo: true,
      title: "الأمن السيبراني",
      description: "مسار متدرّج من أساسيات لينكس حتى اختبار الاختراق.",
      category: "Security",
      color: "oklch(0.6 0.2 340)",
      status: "ACTIVE",
      sections: {
        create: [
          {
            title: "لينكس",
            position: 0,
            lessons: {
              create: [
                { title: "نظام الملفات والأوامر", done: true, position: 0 },
                { title: "الصلاحيات والمستخدمون", done: true, position: 1 },
                { title: "Bash scripting", done: true, position: 2 },
              ],
            },
          },
          {
            title: "الشبكات",
            position: 1,
            lessons: {
              create: [
                { title: "نموذج TCP/IP", done: true, position: 0 },
                { title: "تحليل الحزم بـ Wireshark", done: true, position: 1 },
                { title: "المسح بـ Nmap", done: false, position: 2 },
              ],
            },
          },
          {
            title: "أمن الويب",
            position: 2,
            lessons: {
              create: [
                { title: "OWASP Top 10", done: false, position: 0 },
                { title: "SQL Injection", done: false, position: 1 },
                { title: "XSS و CSRF", done: false, position: 2 },
              ],
            },
          },
        ],
      },
      resources: {
        create: [
          {
            userId,
            title: "TryHackMe",
            url: "https://tryhackme.com",
            type: "COURSE",
          },
          {
            userId,
            title: "OWASP Cheat Sheet Series",
            url: "https://cheatsheetseries.owasp.org",
            type: "DOCS",
          },
        ],
      },
    },
  })

  await db.learningPath.create({
    data: {
      userId,
      isDemo: true,
      title: "TypeScript",
      description: "من الأساسيات إلى الأنواع المتقدمة.",
      category: "Programming",
      color: "oklch(0.6 0.16 265)",
      status: "ACTIVE",
      sections: {
        create: [
          {
            title: "الأساسيات",
            position: 0,
            lessons: {
              create: [
                { title: "الأنواع البدائية", done: true, position: 0 },
                { title: "الواجهات (Interfaces)", done: true, position: 1 },
                { title: "الأنواع المعمّمة (Generics)", done: false, position: 2 },
                { title: "الأنواع المتقدمة", done: false, position: 3 },
              ],
            },
          },
        ],
      },
    },
  })
}

async function seedNotes(
  userId: string,
  projectId: string,
  tags: Record<string, string>
) {
  await db.note.create({
    data: {
      userId,
      isDemo: true,
      title: "أوامر Git التي أنساها دائماً",
      category: "Development",
      isFavorite: true,
      projectId,
      tags: { connect: [{ id: tags["برمجة"] }] },
      contentMd: `## التراجع

\`\`\`bash
git restore --staged <file>   # إخراج ملف من الـ staging
git reset --soft HEAD~1       # تراجع عن آخر commit مع إبقاء التغييرات
git revert <hash>             # commit عكسي — آمن على الفروع المشتركة
\`\`\`

## الفروع

\`\`\`bash
git switch -c feature/x       # فرع جديد والانتقال إليه
git branch -d feature/x       # حذف فرع مدموج
\`\`\`

> \`reset --hard\` يمسح التغييرات نهائياً. استخدم \`stash\` أولاً.`,
    },
  })

  await db.note.create({
    data: {
      userId,
      isDemo: true,
      title: "ملخص محاضرة: خوارزمية A*",
      category: "University",
      tags: { connect: [{ id: tags["مذاكرة"] }] },
      contentMd: `A* تجمع بين تكلفة الطريق الفعلية والتقدير الحدسي:

\`\`\`
f(n) = g(n) + h(n)
\`\`\`

- **g(n)** — التكلفة من البداية حتى العقدة.
- **h(n)** — تقدير التكلفة المتبقية للهدف.

الشرط الأساسي: أن تكون **h** مقبولة (admissible)، أي لا تبالغ في التقدير أبداً — وإلا فقدنا ضمان الحل الأمثل.

### مقارنة سريعة

| الخوارزمية | مثلى؟ | الذاكرة |
| --- | --- | --- |
| BFS | نعم (أوزان متساوية) | عالية |
| Dijkstra | نعم | عالية |
| A* | نعم (بـ h مقبولة) | أقل غالباً |`,
    },
  })

  await db.note.create({
    data: {
      userId,
      isDemo: true,
      title: "أفكار لمشاريع قادمة",
      category: "Ideas",
      contentMd: `- لوحة تحكم لمتابعة استهلاك الإنترنت في المنزل
- بوت يلخّص مقالات RSS يومياً
- إضافة متصفح لحفظ المقتطفات البرمجية`,
    },
  })
}

async function seedGoals(userId: string) {
  await db.goal.create({
    data: {
      userId,
      isDemo: true,
      title: "إتقان TypeScript",
      description: "الوصول لمستوى يمكّنني من بناء مشاريع كبيرة بثقة.",
      category: "Learning",
      deadline: day(60),
      status: "ACTIVE",
      milestones: {
        create: [
          { title: "الأساسيات", done: true, position: 0 },
          { title: "الأنواع", done: true, position: 1 },
          { title: "الواجهات", done: true, position: 2 },
          { title: "Generics", done: false, position: 3 },
          { title: "الأنواع المتقدمة", done: false, position: 4 },
        ],
      },
    },
  })

  await db.goal.create({
    data: {
      userId,
      isDemo: true,
      title: "معدل ٤.٥ هذا الفصل",
      category: "University",
      deadline: day(75),
      status: "ACTIVE",
      milestones: {
        create: [
          { title: "تسليم كل الواجبات في وقتها", done: false, position: 0 },
          { title: "مراجعة أسبوعية لكل مادة", done: false, position: 1 },
        ],
      },
    },
  })

  await db.goal.create({
    data: {
      userId,
      isDemo: true,
      title: "الرياضة ٣ مرات أسبوعياً",
      category: "Health",
      deadline: day(90),
      status: "ACTIVE",
      milestones: {
        create: [
          { title: "الشهر الأول", done: true, position: 0 },
          { title: "الشهر الثاني", done: false, position: 1 },
          { title: "الشهر الثالث", done: false, position: 2 },
        ],
      },
    },
  })
}

async function seedFinance(userId: string) {
  const rows: {
    amount: number
    type: "INCOME" | "EXPENSE"
    category: string
    offset: number
    description?: string
  }[] = []

  // ثلاثة أشهر من الحركة حتى تظهر الرسوم بشكل مفيد
  for (let month = 0; month < 3; month++) {
    const base = -month * 30

    rows.push({
      amount: 3000,
      type: "INCOME",
      category: "مكافأة جامعية",
      offset: base - 25,
    })

    rows.push(
      { amount: 420, type: "EXPENSE", category: "طعام", offset: base - 22 },
      { amount: 180, type: "EXPENSE", category: "مواصلات", offset: base - 19 },
      { amount: 95, type: "EXPENSE", category: "اشتراكات", offset: base - 17, description: "استضافة ونطاق" },
      { amount: 260, type: "EXPENSE", category: "كتب ودورات", offset: base - 12 },
      { amount: 310, type: "EXPENSE", category: "طعام", offset: base - 8 },
      { amount: 150, type: "EXPENSE", category: "ترفيه", offset: base - 5 }
    )
  }

  rows.push({
    amount: 1200,
    type: "INCOME",
    category: "عمل حر",
    offset: -10,
    description: "موقع تعريفي لعميل",
  })

  await db.transaction.createMany({
    data: rows.map((r) => ({
      userId,
      isDemo: true,
      amount: r.amount,
      type: r.type,
      category: r.category,
      date: day(r.offset),
      description: r.description ?? null,
    })),
  })
}

async function seedFocus(userId: string) {
  const sessions: { startedAt: Date; endedAt: Date; durationSec: number }[] = []

  // أسبوعان من جلسات التركيز
  for (let d = 13; d >= 0; d--) {
    const count = [0, 2, 3, 1, 4, 2, 3][d % 7]
    for (let i = 0; i < count; i++) {
      const hour = String(16 + i).padStart(2, "0")
      const startedAt = at(-d, `${hour}:00`)
      const endedAt = new Date(startedAt.getTime() + 25 * 60_000)
      sessions.push({ startedAt, endedAt, durationSec: 25 * 60 })
    }
  }

  await db.focusSession.createMany({
    data: sessions.map((s) => ({ userId, type: "WORK" as const, ...s })),
  })
}

async function seedBookmarks(userId: string) {
  await db.bookmark.createMany({
    data: [
      {
        userId,
        isDemo: true,
        title: "MDN Web Docs",
        url: "https://developer.mozilla.org",
        description: "المرجع الأول للويب.",
        category: "DEVELOPMENT",
        isFavorite: true,
      },
      {
        userId,
        isDemo: true,
        title: "Next.js Docs",
        url: "https://nextjs.org/docs",
        category: "DEVELOPMENT",
        isFavorite: true,
      },
      {
        userId,
        isDemo: true,
        title: "Prisma Docs",
        url: "https://www.prisma.io/docs",
        category: "DEVELOPMENT",
      },
      {
        userId,
        isDemo: true,
        title: "نظام البلاك بورد",
        url: "https://lms.example.edu",
        category: "UNIVERSITY",
      },
      {
        userId,
        isDemo: true,
        title: "TryHackMe",
        url: "https://tryhackme.com",
        category: "LEARNING",
      },
      {
        userId,
        isDemo: true,
        title: "Excalidraw",
        url: "https://excalidraw.com",
        description: "رسم المخططات بسرعة.",
        category: "TOOLS",
      },
      {
        userId,
        isDemo: true,
        title: "Regex101",
        url: "https://regex101.com",
        category: "TOOLS",
      },
    ],
  })
}

// ---------------------------------------------------------------- main

async function main() {
  const userId = await seedUser()

  await clearDemo(userId)

  const tags = await seedTags(userId)
  const projects = await seedProjects(userId)
  const { subjects } = await seedUniversity(userId)

  await seedTasks(userId, projects, subjects[0].id, tags)
  await seedLearning(userId)
  await seedNotes(userId, projects.downloader, tags)
  await seedGoals(userId)
  await seedFinance(userId)
  await seedFocus(userId)
  await seedBookmarks(userId)

  console.log("✓ البيانات التجريبية جاهزة (isDemo: true)")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
