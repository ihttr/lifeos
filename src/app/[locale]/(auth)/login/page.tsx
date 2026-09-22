import { getTranslations, setRequestLocale } from "next-intl/server"

import { LocaleSwitcher } from "@/components/layout/locale-switcher"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Logo } from "@/components/shared/logo"

import { LoginForm } from "./login-form"

import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "auth" })
  return { title: t("signIn") }
}

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params
  setRequestLocale(locale)

  const { next } = await searchParams
  const t = await getTranslations()

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="absolute top-4 end-4 flex items-center gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="size-11" />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            {t("auth.loginTitle")}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {t("auth.loginSubtitle")}
          </p>
        </div>

        <LoginForm
          locale={locale}
          next={typeof next === "string" ? next : undefined}
        />
      </div>

      <p className="text-muted-foreground mt-10 text-xs">
        {t("app.name")} — {t("app.tagline")}
      </p>
    </main>
  )
}
