import createIntlMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"

import { routing, type Locale } from "@/i18n/routing"
import { SECURE_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/auth-cookies"

const intlProxy = createIntlMiddleware(routing)

/** المسارات المتاحة بدون جلسة (بعد إزالة بادئة اللغة) */
const PUBLIC_PATHS = ["/login"]

function splitLocale(pathname: string): { locale: Locale; rest: string } {
  const segments = pathname.split("/")
  const first = segments[1]

  if (routing.locales.includes(first as Locale)) {
    return {
      locale: first as Locale,
      rest: `/${segments.slice(2).join("/")}`.replace(/\/$/, "") || "/",
    }
  }

  return { locale: routing.defaultLocale, rest: pathname }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { locale, rest } = splitLocale(pathname)

  const isPublic = PUBLIC_PATHS.some(
    (p) => rest === p || rest.startsWith(`${p}/`)
  )

  // فحص مبدئي فقط — التحقق الفعلي في requireUserId() عند كل استعلام
  const hasSession = Boolean(
    request.cookies.get(SESSION_COOKIE) ??
      request.cookies.get(SECURE_SESSION_COOKIE)
  )

  if (!isPublic && !hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/login`
    url.search = ""
    if (rest !== "/") url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (isPublic && hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/dashboard`
    url.search = ""
    return NextResponse.redirect(url)
  }

  return intlProxy(request)
}

export const config = {
  // نستثني الـ API والأصول الثابتة والملفات ذات الامتداد
  matcher: ["/((?!api|_next|_vercel|manifest.webmanifest|.*\\..*).*)"],
}
