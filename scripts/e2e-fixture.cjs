/**
 * بيانات ثابتة لاختبار عزل المستخدمين.
 *
 * يُشغَّل كعملية Node مستقلة لأن عامل Playwright يكسر اتصال pg
 * (ECONNRESET عند المصافحة)، بينما يعمل الاتصال من Node عادي بلا مشاكل.
 *
 *   node scripts/e2e-fixture.cjs setup|teardown|verify
 *
 * يطبع JSON على stdout ليقرأه الاختبار.
 */

require("dotenv/config")

const { Client } = require("pg")

const OTHER_EMAIL = "other-user@e2e.local"
const IDS = {
  user: "e2e-other-user-0000000000",
  project: "e2e-other-project-000000000",
  task: "e2e-other-task-000000000000",
  note: "e2e-other-note-000000000000",
}

const SECRETS = {
  project: "مشروع سرّي لمستخدم آخر",
  task: "مهمة سرّية لمستخدم آخر",
  note: "ملاحظة سرّية لمستخدم آخر",
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// خادم `prisma dev` يسمح بعشرة اتصالات ويحرّر فتحاته ببطء بعد انتهائها،
// فقد يُرفض أول اتصال بعد نشاط التطبيق مباشرة. ننتظر حتى ~٢٠ ثانية.
async function connect(attempts = 8) {
  const url = new URL(process.env.DATABASE_URL)
  const sslmode = url.searchParams.get("sslmode")
  url.search = ""

  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const client = new Client({
      connectionString: url.toString(),
      ssl:
        sslmode === "disable" || sslmode === null
          ? false
          : { rejectUnauthorized: false },
    })

    try {
      await client.connect()
      return client
    } catch (error) {
      // خادم Prisma المحلي يرفض الاتصال أحياناً عند امتلاء تجمّعه؛
      // ننتظر قليلاً ونعيد المحاولة بدل إفشال الاختبار.
      lastError = error
      await client.end().catch(() => {})
      if (attempt < attempts) await sleep(attempt * 700)
    }
  }

  throw lastError
}

async function teardown(db) {
  // Cascade ينظّف المشاريع والمهام والملاحظات التابعة
  await db.query('DELETE FROM "User" WHERE email = $1', [OTHER_EMAIL])
}

async function setup(db) {
  await teardown(db)

  await db.query(
    'INSERT INTO "User" (id, email, "passwordHash", "updatedAt") VALUES ($1, $2, $3, now())',
    // تجزئة غير صالحة عمداً: هذا الحساب لا يصلح لتسجيل الدخول
    [IDS.user, OTHER_EMAIL, "not-a-usable-hash"]
  )
  await db.query(
    'INSERT INTO "Project" (id, "userId", name, "updatedAt") VALUES ($1, $2, $3, now())',
    [IDS.project, IDS.user, SECRETS.project]
  )
  await db.query(
    'INSERT INTO "Task" (id, "userId", title, "updatedAt") VALUES ($1, $2, $3, now())',
    [IDS.task, IDS.user, SECRETS.task]
  )
  await db.query(
    'INSERT INTO "Note" (id, "userId", title, "contentMd", "updatedAt") VALUES ($1, $2, $3, $4, now())',
    [IDS.note, IDS.user, SECRETS.note, "سرّ"]
  )

  return { ids: IDS, secrets: SECRETS }
}

async function verify(db) {
  const tables = [
    ["Project", IDS.project],
    ["Task", IDS.task],
    ["Note", IDS.note],
  ]

  const counts = {}
  for (const [table, id] of tables) {
    const result = await db.query(
      `SELECT count(*)::int AS n FROM "${table}" WHERE id = $1`,
      [id]
    )
    counts[table] = result.rows[0].n
  }
  return { counts }
}

async function main() {
  const command = process.argv[2]
  const db = await connect()

  try {
    if (command === "setup") process.stdout.write(JSON.stringify(await setup(db)))
    else if (command === "verify") process.stdout.write(JSON.stringify(await verify(db)))
    else if (command === "teardown") {
      await teardown(db)
      process.stdout.write(JSON.stringify({ ok: true }))
    } else throw new Error(`أمر غير معروف: ${command}`)
  } finally {
    await db.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
