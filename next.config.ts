import createNextIntlPlugin from "next-intl/plugin"

import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Prisma 7 يولّد عميلاً بصيغة TS داخل src/generated — لا حاجة لإعدادات إضافية.
  typedRoutes: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]
  },
}

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

export default withNextIntl(nextConfig)
