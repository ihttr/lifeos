import type { MetadataRoute } from "next"

/**
 * بيان PWA — يجعل التطبيق قابلاً للتثبيت على شاشة الجوال.
 *
 * الاتجاه والبداية بالعربية لأنها اللغة الافتراضية؛ من يفضّل الإنجليزية
 * يبدّلها من داخل التطبيق بعد الفتح.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LifeOS — نظامك الشخصي لإدارة اليوم",
    short_name: "LifeOS",
    description:
      "مهام، مشاريع، جامعة، تعلّم، أهداف، ملاحظات، مالية وتركيز في لوحة واحدة.",
    start_url: "/ar/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ar",
    dir: "rtl",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    categories: ["productivity", "education"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "المهام", url: "/ar/tasks" },
      { name: "التركيز", url: "/ar/focus" },
      { name: "التقويم", url: "/ar/calendar" },
    ],
  }
}
