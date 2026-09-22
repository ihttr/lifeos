import bcrypt from "bcryptjs"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { redirect } from "next/navigation"
import { cache } from "react"
import { z } from "zod"

import { db } from "@/lib/db"

const credentialsSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(200),
})

/**
 * حد بسيط لمحاولات الدخول.
 * ذاكرة العملية فقط — يبطئ التخمين دون بنية تحتية إضافية.
 */
const attempts = new Map<string, { count: number; firstAt: number }>()
const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 8

function tooManyAttempts(key: string): boolean {
  const now = Date.now()
  const rec = attempts.get(key)

  if (!rec || now - rec.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now })
    return false
  }

  rec.count += 1
  return rec.count > MAX_ATTEMPTS
}

function clearAttempts(key: string) {
  attempts.delete(key)
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30, // 30 يوماً
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const email = parsed.data.email.toLowerCase().trim()
        if (tooManyAttempts(email)) return null

        const user = await db.user.findUnique({ where: { email } })
        if (!user) {
          // نجري المقارنة رغم عدم وجود المستخدم حتى لا يكشف الفارق الزمني وجود الحساب
          await bcrypt.compare(parsed.data.password, "$2a$12$invalidsaltvalueforcomparison000000000000000000000000")
          return null
        }

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        clearAttempts(email)
        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id
      return token
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
})

/** معرّف المستخدم الحالي أو null — مخزّن مؤقتاً لكل طلب */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const session = await auth()
  return session?.user?.id ?? null
})

/**
 * حارس كل استعلام وكل إجراء.
 * يعيد التوجيه لصفحة الدخول إن لم توجد جلسة صالحة.
 */
export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId()
  if (!userId) redirect("/login")
  return userId
}
