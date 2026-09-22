import { getTranslations, setRequestLocale } from "next-intl/server"

import { NotesView } from "@/components/notes/notes-view"
import { PageContainer } from "@/components/shared/page-header"
import { noteFiltersSchema } from "@/schemas/note"
import { getNoteFormOptions, getNotes } from "@/server/queries/notes"

import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return { title: t("notes") }
}

export default async function NotesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/notes">) {
  const { locale } = await params
  setRequestLocale(locale)

  const filters = noteFiltersSchema.parse(await searchParams)

  const [notes, options] = await Promise.all([
    getNotes(filters),
    getNoteFormOptions(),
  ])

  return (
    <PageContainer>
      <NotesView notes={notes} filters={filters} options={options} />
    </PageContainer>
  )
}
