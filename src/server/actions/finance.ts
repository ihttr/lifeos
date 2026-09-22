"use server"

import { db } from "@/lib/db"
import { isoToDateColumn } from "@/lib/dates"
import { createAction } from "@/lib/safe-action"
import {
  createTransactionSchema,
  transactionIdSchema,
  updateTransactionSchema,
} from "@/schemas/finance"
import { PATHS, revalidate } from "@/server/revalidate"

function revalidateFinance() {
  revalidate(PATHS.finance, PATHS.dashboard, PATHS.stats)
}

export const createTransaction = createAction(
  createTransactionSchema,
  async (input, userId) => {
    const transaction = await db.transaction.create({
      data: {
        userId,
        amount: input.amount,
        type: input.type,
        category: input.category,
        date: isoToDateColumn(input.date) as Date,
        description: input.description,
      },
      select: { id: true },
    })

    revalidateFinance()
    return transaction
  }
)

export const updateTransaction = createAction(
  updateTransactionSchema,
  async (input, userId) => {
    const { count } = await db.transaction.updateMany({
      where: { id: input.id, userId },
      data: {
        amount: input.amount,
        type: input.type,
        category: input.category,
        date: isoToDateColumn(input.date) as Date,
        description: input.description,
      },
    })
    if (count === 0) throw new Error("not found")

    revalidateFinance()
    return { id: input.id }
  }
)

export const deleteTransaction = createAction(
  transactionIdSchema,
  async ({ id }, userId) => {
    const { count } = await db.transaction.deleteMany({ where: { id, userId } })
    if (count === 0) throw new Error("not found")

    revalidateFinance()
    return { id }
  }
)
