import { getTranslations, setRequestLocale } from "next-intl/server"

import { PageContainer } from "@/components/shared/page-header"
import { UniversityView } from "@/components/university/university-view"
import { universityFiltersSchema } from "@/schemas/university"
import {
  getAssignments,
  getExams,
  getSemesters,
  getSubjects,
  getUniversitySummary,
  resolveSemesterId,
} from "@/server/queries/university"

import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return { title: t("university") }
}

export default async function UniversityPage({
  params,
  searchParams,
}: PageProps<"/[locale]/university">) {
  const { locale } = await params
  setRequestLocale(locale)

  const filters = universityFiltersSchema.parse(await searchParams)

  const semesters = await getSemesters()
  const semesterId = resolveSemesterId(semesters, filters.semester)

  // لا فصول بعد — الواجهة تعرض حالة البداية
  if (!semesterId) {
    return (
      <PageContainer>
        <UniversityView
          semesters={[]}
          activeSemesterId={null}
          subjects={[]}
          assignments={[]}
          exams={[]}
          summary={{
            subjects: 0,
            pending: 0,
            overdue: 0,
            upcomingExams: 0,
            credits: 0,
          }}
          filters={filters}
        />
      </PageContainer>
    )
  }

  const [subjects, assignments, exams, summary] = await Promise.all([
    getSubjects(semesterId),
    getAssignments(semesterId, {
      subject: filters.subject,
      status: filters.status,
    }),
    getExams(semesterId, { subject: filters.subject }),
    getUniversitySummary(semesterId),
  ])

  return (
    <PageContainer>
      <UniversityView
        semesters={semesters}
        activeSemesterId={semesterId}
        subjects={subjects}
        assignments={assignments}
        exams={exams}
        summary={summary}
        filters={filters}
      />
    </PageContainer>
  )
}
