import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageContainer } from "@/components/shared/page-header"
import { SettingsView } from "@/components/settings/settings-view"
import { getCurrentUser } from "@/server/queries/user"

import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return { title: t("settings") }
}

export default async function SettingsPage({
  params,
}: PageProps<"/[locale]/settings">) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await getCurrentUser()

  return (
    <PageContainer>
      <SettingsView user={{ name: user.name, email: user.email }} />
    </PageContainer>
  )
}
