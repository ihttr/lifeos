import "server-only"

import { db } from "@/lib/db"

/**
 * البحث عمّا يريد المستخدم إنهاءه حين يقول «خلصت ...».
 *
 * يشمل المهام والواجبات معاً لأن المستخدم لا يفكّر بهذا التقسيم وهو
 * يكتب — يقول «خلصت الشبكات» ولا يعنيه في أي جدول هي.
 */

export type Candidate = {
  id: string
  kind: "task" | "assignment"
  title: string
  context: string | null
  createdAt: Date
}

/** أكثر من هذا اختيارٌ مرهق — نطلب صياغة أدق بدلاً منه */
const MAX_CANDIDATES = 6

/**
 * @param query نص البحث، أو فارغ إن قال «خلصته» مجرّدة — وحينها نعيد
 *   الأحدث إنشاءً، وهو المقصود عملياً: المرء يُنهي ما أضافه للتوّ.
 */
export async function findOpenItems(
  userId: string,
  query: string
): Promise<Candidate[]> {
  const trimmed = query.trim()
  const search = trimmed
    ? { contains: trimmed, mode: "insensitive" as const }
    : undefined

  const [tasks, assignments] = await Promise.all([
    db.task.findMany({
      where: {
        userId,
        archivedAt: null,
        status: { not: "DONE" },
        ...(search ? { title: search } : {}),
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        project: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_CANDIDATES,
    }),

    db.assignment.findMany({
      where: {
        userId,
        status: { not: "DONE" },
        // اسم المادة مدخلٌ صالح للبحث: «خلصت واجب الشبكات»
        ...(search
          ? { OR: [{ title: search }, { subject: { name: search } }] }
          : {}),
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        subject: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_CANDIDATES,
    }),
  ])

  const candidates: Candidate[] = [
    ...tasks.map((task) => ({
      id: task.id,
      kind: "task" as const,
      title: task.title,
      context: task.project?.name ?? null,
      createdAt: task.createdAt,
    })),
    ...assignments.map((assignment) => ({
      id: assignment.id,
      kind: "assignment" as const,
      title: assignment.title,
      context: assignment.subject.name,
      createdAt: assignment.createdAt,
    })),
  ]

  // الترتيب بعد الدمج لا قبله: الجدولان مرتّبان كلٌّ على حدة، فلصقهما
  // يضع كل المهام قبل كل الواجبات مهما كانت التواريخ.
  candidates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  // «خلصته» المجرّدة نيّةٌ واضحة لا سؤال: آخر ما أضافه المستخدم.
  // عرض قائمة هنا يحوّل اختصاراً إلى عمل إضافي.
  if (!trimmed) return candidates.slice(0, 1)

  return candidates.slice(0, MAX_CANDIDATES)
}
