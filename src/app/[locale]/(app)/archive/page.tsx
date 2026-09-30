import { getTranslations, setRequestLocale } from "next-intl/server"

import { ArchiveView } from "@/components/archive/archive-view"
import { PageContainer } from "@/components/shared/page-header"
import { isBlobConfigured } from "@/lib/storage"
import { archiveFiltersSchema } from "@/schemas/archive"
import {
  getAllFolders,
  getArchiveFiles,
  getArchiveOptions,
  getFolderPath,
  getFolders,
} from "@/server/queries/archive"

import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return { title: t("archive") }
}

export default async function ArchivePage({
  params,
  searchParams,
}: PageProps<"/[locale]/archive">) {
  const { locale } = await params
  setRequestLocale(locale)

  const filters = archiveFiltersSchema.parse(await searchParams)

  const folderId = filters.folder ?? null

  const [files, folders, path, allFolders, options] = await Promise.all([
    getArchiveFiles(filters),
    getFolders(folderId),
    getFolderPath(folderId),
    getAllFolders(),
    getArchiveOptions(),
  ])

  return (
    <PageContainer>
      <ArchiveView
        files={files}
        folders={folders}
        path={path}
        allFolders={allFolders}
        options={options}
        filters={filters}
        // وجود المخزن يقرَّر على الخادم ويُمرَّر كخاصية: العميل لا يقرأ
        // متغيّرات البيئة، والرفع المباشر لا يعمل بلا مخزن مهيّأ.
        directUpload={isBlobConfigured()}
      />
    </PageContainer>
  )
}
