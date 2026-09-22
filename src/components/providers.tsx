"use client"

import { ThemeProvider } from "next-themes"
import type { ReactNode } from "react"

import { DirectionProvider } from "@/components/ui/direction"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

export function Providers({
  children,
  dir,
}: {
  children: ReactNode
  dir: "rtl" | "ltr"
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <DirectionProvider dir={dir}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster position={dir === "rtl" ? "bottom-left" : "bottom-right"} />
        </TooltipProvider>
      </DirectionProvider>
    </ThemeProvider>
  )
}
