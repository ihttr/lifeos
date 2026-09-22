import { getTranslations, setRequestLocale } from "next-intl/server"

import { FocusView } from "@/components/focus/focus-view"
import { PageContainer } from "@/components/shared/page-header"
import { getFocusData, getFocusTaskOptions } from "@/server/queries/focus"

import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return { title: t("focus") }
}

export default async function FocusPage({
  params,
}: PageProps<"/[locale]/focus">) {
  const { locale } = await params
  setRequestLocale(locale)

  const [data, tasks] = await Promise.all([
    getFocusData(),
    getFocusTaskOptions(),
  ])

  return (
    <PageContainer>
      <FocusView data={data} tasks={tasks} />
    </PageContainer>
  )
}
