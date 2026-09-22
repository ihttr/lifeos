import "server-only"

import { db } from "@/lib/db"
import { addMonthsISO, dateColumnToISO, endOfMonthISO, todayISO } from "@/lib/dates"
import { requireUserId } from "@/server/auth"

import type { Prisma } from "@/generated/prisma/client"
import type { FinanceFilters } from "@/schemas/finance"

/**
 * Prisma يعيد Decimal ككائن. نحوّله لرقم عند حدود الخادم
 * لأن الرسوم والمجاميع في الواجهة تحتاج أرقاماً عادية،
 * والمبالغ هنا أصغر بكثير من حد الدقة الآمن في JavaScript.
 */
function toNumber(value: Prisma.Decimal): number {
  return Number(value)
}

export type TransactionDTO = {
  id: string
  amount: number
  type: "INCOME" | "EXPENSE"
  category: string
  date: string
  description: string | null
}

export type CategoryTotal = { category: string; total: number; share: number }
export type MonthTotals = { month: string; income: number; expense: number }

function monthRange(month: string) {
  const start = new Date(`${month}-01T00:00:00.000Z`)
  const end = new Date(`${endOfMonthISO(`${month}-01`)}T23:59:59.999Z`)
  return { start, end }
}

export async function getTransactions(
  filters: FinanceFilters
): Promise<TransactionDTO[]> {
  const userId = await requireUserId()
  const month = filters.month ?? todayISO().slice(0, 7)
  const { start, end } = monthRange(month)

  const where: Prisma.TransactionWhereInput = {
    userId,
    date: { gte: start, lte: end },
  }
  if (filters.type) where.type = filters.type
  if (filters.category) where.category = filters.category

  const rows = await db.transaction.findMany({
    where,
    select: {
      id: true,
      amount: true,
      type: true,
      category: true,
      date: true,
      description: true,
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500,
  })

  return rows.map((row) => ({
    ...row,
    amount: toNumber(row.amount),
    date: dateColumnToISO(row.date) as string,
  }))
}

/** مجاميع الشهر المعروض — غير متأثرة بتصفية النوع أو التصنيف */
export async function getMonthSummary(month: string) {
  const userId = await requireUserId()
  const { start, end } = monthRange(month)

  const grouped = await db.transaction.groupBy({
    by: ["type"],
    where: { userId, date: { gte: start, lte: end } },
    _sum: { amount: true },
    _count: true,
  })

  const income = grouped.find((g) => g.type === "INCOME")
  const expense = grouped.find((g) => g.type === "EXPENSE")

  const incomeTotal = income?._sum.amount ? toNumber(income._sum.amount) : 0
  const expenseTotal = expense?._sum.amount ? toNumber(expense._sum.amount) : 0

  return {
    income: incomeTotal,
    expense: expenseTotal,
    balance: incomeTotal - expenseTotal,
    count: (income?._count ?? 0) + (expense?._count ?? 0),
  }
}

/** المصروف حسب التصنيف في الشهر المعروض، مرتّباً تنازلياً */
export async function getCategoryBreakdown(
  month: string
): Promise<CategoryTotal[]> {
  const userId = await requireUserId()
  const { start, end } = monthRange(month)

  const grouped = await db.transaction.groupBy({
    by: ["category"],
    where: { userId, type: "EXPENSE", date: { gte: start, lte: end } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 12,
  })

  const totals = grouped.map((row) => ({
    category: row.category,
    total: row._sum.amount ? toNumber(row._sum.amount) : 0,
  }))

  const sum = totals.reduce((acc, row) => acc + row.total, 0)

  return totals.map((row) => ({
    ...row,
    share: sum > 0 ? row.total / sum : 0,
  }))
}

/** ستة أشهر من الدخل والمصروف — لمخطط الاتجاه */
export async function getMonthlyTotals(
  endMonth: string,
  months = 6
): Promise<MonthTotals[]> {
  const userId = await requireUserId()

  const firstMonth = addMonthsISO(`${endMonth}-01`, -(months - 1)).slice(0, 7)
  const start = new Date(`${firstMonth}-01T00:00:00.000Z`)
  const end = new Date(`${endOfMonthISO(`${endMonth}-01`)}T23:59:59.999Z`)

  const rows = await db.transaction.findMany({
    where: { userId, date: { gte: start, lte: end } },
    select: { amount: true, type: true, date: true },
  })

  // نهيّئ كل الأشهر بأصفار حتى لا تختفي الشهور الخالية من المخطط
  const buckets = new Map<string, { income: number; expense: number }>()
  for (let i = 0; i < months; i++) {
    const month = addMonthsISO(`${firstMonth}-01`, i).slice(0, 7)
    buckets.set(month, { income: 0, expense: 0 })
  }

  for (const row of rows) {
    const month = row.date.toISOString().slice(0, 7)
    const bucket = buckets.get(month)
    if (!bucket) continue

    const value = toNumber(row.amount)
    if (row.type === "INCOME") bucket.income += value
    else bucket.expense += value
  }

  return [...buckets.entries()].map(([month, totals]) => ({ month, ...totals }))
}

/** التصنيفات المستخدمة سابقاً — لاقتراحات النموذج وقائمة التصفية */
export async function getFinanceCategories() {
  const userId = await requireUserId()

  const rows = await db.transaction.findMany({
    where: { userId },
    select: { category: true, type: true },
    distinct: ["category", "type"],
    take: 100,
  })

  return {
    income: [...new Set(rows.filter((r) => r.type === "INCOME").map((r) => r.category))].sort(),
    expense: [...new Set(rows.filter((r) => r.type === "EXPENSE").map((r) => r.category))].sort(),
    all: [...new Set(rows.map((r) => r.category))].sort(),
  }
}

export async function getFinanceData(filters: FinanceFilters) {
  const month = filters.month ?? todayISO().slice(0, 7)

  const [transactions, summary, categories, monthly, categoryOptions] =
    await Promise.all([
      getTransactions(filters),
      getMonthSummary(month),
      getCategoryBreakdown(month),
      getMonthlyTotals(month),
      getFinanceCategories(),
    ])

  return { month, transactions, summary, categories, monthly, categoryOptions }
}

export type FinanceData = Awaited<ReturnType<typeof getFinanceData>>
