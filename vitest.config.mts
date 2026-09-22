import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // التواريخ حساسة للمنطقة الزمنية — نثبّتها كما في الإنتاج
    env: { TZ: "Asia/Riyadh" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
})
