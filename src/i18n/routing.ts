import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
})

export type Locale = (typeof routing.locales)[number]

export const LOCALE_DIR: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
}

export const LOCALE_LABEL: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
}
