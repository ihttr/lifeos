import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const { count } = await db.task.deleteMany({
  where: { isDemo: false, title: { startsWith: "اختبار " } },
})
console.log(`deleted ${count} test tasks`)
await db.$disconnect()
