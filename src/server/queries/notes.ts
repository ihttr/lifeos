import "server-only"

import { db } from "@/lib/db"
import { requireUserId } from "@/server/auth"

import type { Prisma } from "@/generated/prisma/client"
import type { NoteFilters } from "@/schemas/note"

const noteSelect = {
  id: true,
  title: true,
  contentMd: true,
  category: true,
  isFavorite: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  projectId: true,
  subjectId: true,
  learningPathId: true,
  project: { select: { id: true, name: true, color: true } },
  subject: { select: { id: true, name: true, color: true } },
  tags: { select: { id: true, name: true, color: true } },
} satisfies Prisma.NoteSelect

type RawNote = Prisma.NoteGetPayload<{ select: typeof noteSelect }>

export type NoteDTO = Omit<
  RawNote,
  "createdAt" | "updatedAt" | "archivedAt"
> & {
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

function toDTO(note: RawNote): NoteDTO {
  return {
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    archivedAt: note.archivedAt?.toISOString() ?? null,
  }
}

export async function getNotes(filters: NoteFilters): Promise<NoteDTO[]> {
  const userId = await requireUserId()

  const where: Prisma.NoteWhereInput = {
    userId,
    archivedAt: filters.archived ? { not: null } : null,
  }

  if (filters.favorites) where.isFavorite = true
  if (filters.category) where.category = filters.category
  if (filters.tag) where.tags = { some: { name: filters.tag } }

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { contentMd: { contains: filters.q, mode: "insensitive" } },
    ]
  }

  const notes = await db.note.findMany({
    where,
    orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
    select: noteSelect,
    take: 300,
  })

  return notes.map(toDTO)
}

export async function getNote(id: string): Promise<NoteDTO | null> {
  const userId = await requireUserId()

  const note = await db.note.findFirst({
    where: { id, userId },
    select: noteSelect,
  })

  return note ? toDTO(note) : null
}

/** التصنيفات والوسوم والارتباطات المتاحة لنموذج الملاحظة */
export async function getNoteFormOptions() {
  const userId = await requireUserId()

  const [categories, tags, projects, subjects, paths] = await Promise.all([
    db.note.findMany({
      where: { userId, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      take: 50,
    }),
    db.tag.findMany({
      where: { userId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    db.project.findMany({
      where: { userId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    db.subject.findMany({
      where: { userId, semester: { isActive: true } },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    db.learningPath.findMany({
      where: { userId },
      select: { id: true, title: true, color: true },
      orderBy: { title: "asc" },
    }),
  ])

  return {
    categories: categories
      .map((row) => row.category)
      .filter((value): value is string => Boolean(value))
      .sort(),
    tags,
    projects,
    subjects,
    paths: paths.map((p) => ({ id: p.id, name: p.title, color: p.color })),
  }
}

export type NoteFormOptions = Awaited<ReturnType<typeof getNoteFormOptions>>
