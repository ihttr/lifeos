"use server"

import { db } from "@/lib/db"
import { createAction } from "@/lib/safe-action"
import {
  createNoteSchema,
  noteIdSchema,
  noteToggleSchema,
  updateNoteSchema,
} from "@/schemas/note"
import { PATHS, revalidate } from "@/server/revalidate"

import type { NoteFilters } from "@/schemas/note"

function revalidateNotes() {
  revalidate(PATHS.notes, PATHS.dashboard, PATHS.projects, PATHS.university)
}

function tagConnect(tags: string[], userId: string) {
  return tags.map((name) => ({
    where: { userId_name: { userId, name } },
    create: { name, userId },
  }))
}

/** يمنع ربط الملاحظة بسجل يخصّ مستخدماً آخر */
async function assertOwnedRelations(
  input: { projectId: string | null; subjectId: string | null; learningPathId: string | null },
  userId: string
) {
  if (input.projectId) {
    const count = await db.project.count({ where: { id: input.projectId, userId } })
    if (count === 0) throw new Error("project not owned")
  }
  if (input.subjectId) {
    const count = await db.subject.count({ where: { id: input.subjectId, userId } })
    if (count === 0) throw new Error("subject not owned")
  }
  if (input.learningPathId) {
    const count = await db.learningPath.count({
      where: { id: input.learningPathId, userId },
    })
    if (count === 0) throw new Error("path not owned")
  }
}

export const createNote = createAction(
  createNoteSchema,
  async (input, userId) => {
    await assertOwnedRelations(input, userId)

    const note = await db.note.create({
      data: {
        userId,
        title: input.title,
        contentMd: input.contentMd,
        category: input.category,
        projectId: input.projectId,
        subjectId: input.subjectId,
        learningPathId: input.learningPathId,
        tags: { connectOrCreate: tagConnect(input.tags, userId) },
      },
      select: { id: true },
    })

    revalidateNotes()
    return note
  }
)

export const updateNote = createAction(
  updateNoteSchema,
  async (input, userId) => {
    await assertOwnedRelations(input, userId)

    const existing = await db.note.findFirst({
      where: { id: input.id, userId },
      select: { id: true },
    })
    if (!existing) throw new Error("not found")

    await db.note.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        contentMd: input.contentMd,
        category: input.category,
        projectId: input.projectId,
        subjectId: input.subjectId,
        learningPathId: input.learningPathId,
        tags: { set: [], connectOrCreate: tagConnect(input.tags, userId) },
      },
    })

    revalidateNotes()
    return { id: existing.id }
  }
)

export const deleteNote = createAction(noteIdSchema, async ({ id }, userId) => {
  const { count } = await db.note.deleteMany({ where: { id, userId } })
  if (count === 0) throw new Error("not found")

  revalidateNotes()
  return { id }
})

export const toggleNoteFavorite = createAction(
  noteToggleSchema,
  async ({ id, value }, userId) => {
    const { count } = await db.note.updateMany({
      where: { id, userId },
      data: { isFavorite: value },
    })
    if (count === 0) throw new Error("not found")

    revalidateNotes()
    return { id }
  }
)

export const toggleNoteArchive = createAction(
  noteToggleSchema,
  async ({ id, value }, userId) => {
    const { count } = await db.note.updateMany({
      where: { id, userId },
      data: { archivedAt: value ? new Date() : null },
    })
    if (count === 0) throw new Error("not found")

    revalidateNotes()
    return { id }
  }
)

export type { NoteFilters }
