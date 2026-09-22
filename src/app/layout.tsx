import type { ReactNode } from "react"

/**
 * تخطيط جذري تمريري.
 * وسوم <html> و <body> في src/app/[locale]/layout.tsx
 * لأن اتجاه الصفحة ولغتها يعتمدان على اللغة المختارة.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
