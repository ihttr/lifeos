"use server"

import { AuthError } from "next-auth"

import { routing, type Locale } from "@/i18n/routing"
import { signIn, signOut } from "@/server/auth"

export type LoginState = { error: string } | null

/** يقبل فقط مساراً داخلياً يبدأ ببادئة لغة معروفة — حماية من open redirect */
function safeRedirect(next: string | null, locale: Locale): string {
  const fallback = `/${locale}/dashboard`
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback

  const first = next.split("/")[1]
  return routing.locales.includes(first as Locale) ? next : fallback
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const rawLocale = String(formData.get("locale") ?? routing.defaultLocale)
  const locale = routing.locales.includes(rawLocale as Locale)
    ? (rawLocale as Locale)
    : routing.defaultLocale

  const redirectTo = safeRedirect(
    formData.get("next") ? String(formData.get("next")) : null,
    locale
  )

  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo,
    })
    return null
  } catch (error) {
    // signIn يرمي NEXT_REDIRECT عند النجاح — يجب أن يمر
    if (error instanceof AuthError) {
      return { error: "auth.invalidCredentials" }
    }
    throw error
  }
}

export async function logoutAction(locale: Locale) {
  await signOut({ redirectTo: `/${locale}/login` })
}
