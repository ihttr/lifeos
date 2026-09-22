/**
 * يحمّل خطوط المشروع من Google Fonts مرة واحدة إلى public/fonts،
 * ويولّد src/app/fonts.css بقواعد @font-face محلية.
 *
 * الغرض: لا طلبات خارجية وقت التشغيل — أسرع، وأفضل للخصوصية، ويعمل دون إنترنت.
 * أعد تشغيله فقط عند تغيير قائمة الخطوط:  node scripts/fetch-fonts.mjs
 */

import { execFile } from "node:child_process"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

const run = promisify(execFile)

const OUT_DIR = path.join(process.cwd(), "public", "fonts")
const CSS_OUT = path.join(process.cwd(), "src", "app", "fonts.css")

// متصفح حديث حتى تعيد Google صيغة woff2
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

const FAMILIES = [
  {
    cssFamily: "IBM Plex Sans Arabic",
    localName: "IBMPlexSansArabic",
    query: "IBM+Plex+Sans+Arabic:wght@400;500;600;700",
  },
  {
    cssFamily: "Inter",
    localName: "Inter",
    query: "Inter:wght@100..900",
  },
  {
    cssFamily: "JetBrains Mono",
    localName: "JetBrainsMono",
    query: "JetBrains+Mono:wght@400..700",
  },
]

async function curl(url, outFile) {
  const args = ["-sSL", "--max-time", "60", "-A", UA]
  if (outFile) args.push("-o", outFile)
  args.push(url)
  const { stdout } = await run("curl", args, { maxBuffer: 32 * 1024 * 1024 })
  return stdout
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })

  const blocks = []

  for (const family of FAMILIES) {
    const url = `https://fonts.googleapis.com/css2?family=${family.query}&display=swap`
    const css = await curl(url)

    let index = 0
    const faces = css.split("@font-face").slice(1)

    for (const face of faces) {
      const srcMatch = face.match(/src:\s*url\((https:\/\/[^)]+\.woff2)\)/)
      if (!srcMatch) continue

      const weight = face.match(/font-weight:\s*([^;]+);/)?.[1].trim() ?? "400"
      const style = face.match(/font-style:\s*([^;]+);/)?.[1].trim() ?? "normal"
      const range = face.match(/unicode-range:\s*([^;]+);/)?.[1].trim()

      const fileName = `${family.localName}-${index++}.woff2`
      await curl(srcMatch[1], path.join(OUT_DIR, fileName))

      blocks.push(
        [
          "@font-face {",
          `  font-family: "${family.cssFamily}";`,
          `  font-style: ${style};`,
          `  font-weight: ${weight};`,
          "  font-display: swap;",
          `  src: url("/fonts/${fileName}") format("woff2");`,
          range ? `  unicode-range: ${range};` : null,
          "}",
        ]
          .filter(Boolean)
          .join("\n")
      )
    }

    console.log(`✓ ${family.cssFamily}: ${faces.length} وجه خط`)
  }

  const header =
    "/* مُولّد بواسطة scripts/fetch-fonts.mjs — لا تعدّله يدوياً */\n\n"
  await writeFile(CSS_OUT, header + blocks.join("\n\n") + "\n", "utf8")

  const size = (await readFile(CSS_OUT)).length
  console.log(`✓ ${path.relative(process.cwd(), CSS_OUT)} (${size} بايت)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
