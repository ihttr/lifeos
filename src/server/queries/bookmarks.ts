import "server-only"

import { db } from "@/lib/db"
import { requireUserId } from "@/server/auth"

import type { Prisma } from "@/generated/prisma/client"
import type { BookmarkCategory, BookmarkFilters } from "@/schemas/bookmark"

export type BookmarkDTO = {
  id: string
  title: string
  url: string
  description: string | null
  category: string
  isFavorite: boolean
  tags: { id: string; name: string; color: string | null }[]
}

export async function getBookmarks(
  filters: BookmarkFilters
): Promise<BookmarkDTO[]> {
  const userId = await requireUserId()

  const where: Prisma.BookmarkWhereInput = { userId }
  if (filters.category) where.category = filters.category
  if (filters.favorites) where.isFavorite = true
  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
      { url: { contains: filters.q, mode: "insensitive" } },
    ]
  }

  return db.bookmark.findMany({
    where,
    select: {
      id: true,
      title: true,
      url: true,
      description: true,
      category: true,
      isFavorite: true,
      tags: { select: { id: true, name: true, color: true } },
    },
    orderBy: [{ isFavorite: "desc" }, { title: "asc" }],
    take: 500,
  })
}

/** عدد الروابط في كل تصنيف — لشارات شريط التصفية */
export async function getBookmarkCounts() {
  const userId = await requireUserId()

  const grouped = await db.bookmark.groupBy({
    by: ["category"],
    where: { userId },
    _count: true,
  })

  const counts = Object.fromEntries(
    grouped.map((row) => [row.category, row._count])
  ) as Record<BookmarkCategory, number | undefined>

  const total = grouped.reduce((sum, row) => sum + row._count, 0)
  const favorites = await db.bookmark.count({
    where: { userId, isFavorite: true },
  })

  return { counts, total, favorites }
}
