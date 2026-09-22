"use server"

import { db } from "@/lib/db"
import { createAction } from "@/lib/safe-action"
import {
  bookmarkFavoriteSchema,
  bookmarkIdSchema,
  createBookmarkSchema,
  updateBookmarkSchema,
} from "@/schemas/bookmark"
import { PATHS, revalidate } from "@/server/revalidate"

function revalidateBookmarks() {
  revalidate(PATHS.bookmarks, PATHS.dashboard)
}

function tagConnect(tags: string[], userId: string) {
  return tags.map((name) => ({
    where: { userId_name: { userId, name } },
    create: { name, userId },
  }))
}

export const createBookmark = createAction(
  createBookmarkSchema,
  async (input, userId) => {
    const bookmark = await db.bookmark.create({
      data: {
        userId,
        title: input.title,
        url: input.url,
        description: input.description,
        category: input.category,
        tags: { connectOrCreate: tagConnect(input.tags, userId) },
      },
      select: { id: true },
    })

    revalidateBookmarks()
    return bookmark
  }
)

export const updateBookmark = createAction(
  updateBookmarkSchema,
  async (input, userId) => {
    const existing = await db.bookmark.findFirst({
      where: { id: input.id, userId },
      select: { id: true },
    })
    if (!existing) throw new Error("not found")

    await db.bookmark.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        url: input.url,
        description: input.description,
        category: input.category,
        tags: { set: [], connectOrCreate: tagConnect(input.tags, userId) },
      },
    })

    revalidateBookmarks()
    return { id: existing.id }
  }
)

export const toggleBookmarkFavorite = createAction(
  bookmarkFavoriteSchema,
  async ({ id, value }, userId) => {
    const { count } = await db.bookmark.updateMany({
      where: { id, userId },
      data: { isFavorite: value },
    })
    if (count === 0) throw new Error("not found")

    revalidateBookmarks()
    return { id }
  }
)

export const deleteBookmark = createAction(
  bookmarkIdSchema,
  async ({ id }, userId) => {
    const { count } = await db.bookmark.deleteMany({ where: { id, userId } })
    if (count === 0) throw new Error("not found")

    revalidateBookmarks()
    return { id }
  }
)
