/**
 * أسماء كوكي الجلسة فقط — بلا أي اعتماديات.
 * يستوردها proxy.ts حتى لا يُسحب Prisma و bcrypt إلى كل طلب.
 */
export const SESSION_COOKIE = "authjs.session-token"
export const SECURE_SESSION_COOKIE = "__Secure-authjs.session-token"
