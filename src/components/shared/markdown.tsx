"use client"

import { cn } from "cn"
import ReactMarkdown from "react-markdown"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"

/**
 * عرض Markdown.
 * rehype-sanitize إلزامي: المحتوى مكتوب من المستخدم ويُعرض كـ HTML،
 * وبدونه يصبح أي <script> في ملاحظة ثغرة XSS.
 */
export function Markdown({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
