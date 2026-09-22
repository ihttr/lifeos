import { getTranslations, setRequestLocale } from "next-intl/server"

import { BookmarksView } from "@/components/bookmarks/bookmarks-view"
import { PageContainer } from "@/components/shared/page-header"
import { bookmarkFiltersSchema } from "@/schemas/bookmark"
import { getBookmarkCounts, getBookmarks } from "@/server/queries/bookmarks"

import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return { title: t("bookmarks") }
}

export default async function BookmarksPage({
  params,
  searchParams,
}: PageProps<"/[locale]/bookmarks">) {
  const { locale } = await params
  setRequestLocale(locale)

  const filters = bookmarkFiltersSchema.parse(await searchParams)

  const [bookmarks, counts] = await Promise.all([
    getBookmarks(filters),
    getBookmarkCounts(),
  ])

  return (
    <PageContainer>
      <BookmarksView bookmarks={bookmarks} counts={counts} filters={filters} />
    </PageContainer>
  )
}
