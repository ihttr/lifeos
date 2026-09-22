import { z } from "zod"

import { cuid, httpUrl, optionalText, requiredText, tagNames } from "@/schemas/common"

/** تصنيفات ثابتة — الروابط تُصفَّح بالتصنيف أكثر مما تُبحث */
export const bookmarkCategory = z.enum([
  "DEVELOPMENT",
  "UNIVERSITY",
  "LEARNING",
  "PROJECTS",
  "TOOLS",
  "PERSONAL",
])

export const bookmarkInputSchema = z.object({
  title: requiredText(200),
  url: httpUrl,
  description: optionalText(500),
  category: bookmarkCategory.default("PERSONAL"),
  tags: tagNames,
})

export const createBookmarkSchema = bookmarkInputSchema
export const updateBookmarkSchema = bookmarkInputSchema.extend({ id: cuid })
export const bookmarkIdSchema = z.object({ id: cuid })

export const bookmarkFavoriteSchema = z.object({
  id: cuid,
  value: z.boolean(),
})

export const bookmarkFiltersSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  category: bookmarkCategory.optional().catch(undefined),
  favorites: z
    .enum(["true", "false"])
    .catch("false")
    .transform((v) => v === "true"),
})

export type BookmarkCategory = z.output<typeof bookmarkCategory>
export type BookmarkFilters = z.output<typeof bookmarkFiltersSchema>
