import "server-only"

import { db } from "@/lib/db"
import { requireUserId } from "@/server/auth"

import type { ArchiveFilters, ArchiveKind } from "@/schemas/archive"

/**
 * قراءة الأرشيف.
 *
 * البحث النصّي هو المدخل الأهم لا الفلاتر: بعد سنتين لا يتذكّر المرء
 * «الواجب الثالث» بل «ذاك الواجب عن الـ joins»، فالبحث يشمل العنوان
 * والوصف واسم المادة معاً.
 */

export type ArchiveFileDTO = {
  id: string
  title: string
  description: string | null
  kind: ArchiveKind
  size: number
  contentType: string
  createdAt: Date
  subject: { id: string; name: string; color: string | null } | null
  assignment: { id: string; title: string } | null
  project: { id: string; name: string } | null
}

const SELECT = {
  id: true,
  title: true,
  description: true,
  kind: true,
  size: true,
  contentType: true,
  createdAt: true,
  subject: { select: { id: true, name: true, color: true } },
  assignment: { select: { id: true, title: true } },
  project: { select: { id: true, name: true } },
} as const

export async function getArchiveFiles(
  filters: ArchiveFilters
): Promise<ArchiveFileDTO[]> {
  const userId = await requireUserId()
  const q = filters.q?.trim()

  return db.archiveFile.findMany({
    where: {
      userId,
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      // الفصل مشتقّ: كل ملف مرتبط بمادة تنتمي لهذا الفصل
      ...(filters.semesterId
        ? { subject: { semesterId: filters.semesterId } }
        : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { subject: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: SELECT,
    orderBy: { createdAt: "desc" },
    take: 200,
  })
}

/** ملفات واجب واحد — لعرضها داخل بطاقة الواجب */
export async function getAssignmentFiles(
  assignmentId: string
): Promise<ArchiveFileDTO[]> {
  const userId = await requireUserId()

  return db.archiveFile.findMany({
    where: { userId, assignmentId },
    select: SELECT,
    orderBy: { createdAt: "desc" },
  })
}

/** خيارات الفلاتر — المواد والفصول والمشاريع التي لها ملفات فعلاً */
export async function getArchiveOptions() {
  const userId = await requireUserId()

  const [semesters, subjects, projects, counts] = await Promise.all([
    db.semester.findMany({
      where: { userId },
      select: { id: true, name: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { startDate: { sort: "desc", nulls: "last" } }],
    }),
    db.subject.findMany({
      where: { userId },
      select: { id: true, name: true, semesterId: true },
      orderBy: { name: "asc" },
    }),
    db.project.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.archiveFile.groupBy({
      by: ["kind"],
      where: { userId },
      _count: { _all: true },
      _sum: { size: true },
    }),
  ])

  const total = counts.reduce((sum, row) => sum + row._count._all, 0)
  const bytes = counts.reduce((sum, row) => sum + (row._sum.size ?? 0), 0)

  return { semesters, subjects, projects, total, bytes }
}

/** السجل مع مساره — للتنزيل. مقيّد بالمستخدم فلا يُقرأ ملف غيره. */
export async function getArchiveFileForDownload(id: string, userId: string) {
  return db.archiveFile.findFirst({
    where: { id, userId },
    select: { id: true, title: true, pathname: true, contentType: true },
  })
}
