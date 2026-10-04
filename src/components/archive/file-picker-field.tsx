"use client"

import { FileTextIcon, UploadIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { MAX_FILE_BYTES } from "@/schemas/archive"

/** انظر formatSize في archive-view — العازل يمنع قلب «68 B» في RTL */
function formatSize(bytes: number): string {
  const text =
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

  return `⁨${text}⁩`
}

/**
 * اختيار ملف واحد — يُستعمل حيثما لزم إرفاق ملف خارج صفحة الأرشيف.
 *
 * لا يرفع شيئاً بنفسه: يُبقي الـ File في حالة المستدعي، فيقرّر هو متى
 * يرفع. في نموذج الواجب مثلاً لا يمكن الرفع قبل إنشاء الواجب لأن
 * الملف يُربط بمعرّفه.
 */
export function FilePickerField({
  id,
  label,
  description,
  file,
  onPick,
  disabled,
  existing,
}: {
  id: string
  label: string
  description?: string
  file: File | null
  onPick: (file: File | null) => void
  disabled?: boolean
  /** ملفات مرفقة سابقاً بهذا الدور — تُعرض كروابط */
  existing?: { id: string; title: string }[]
}) {
  const t = useTranslations("archive")
  const tc = useTranslations("common")
  const inputRef = useRef<HTMLInputElement>(null)

  function choose(next: File | null) {
    if (!next) return

    if (next.size > MAX_FILE_BYTES) {
      toast.error(t("tooLarge", { max: formatSize(MAX_FILE_BYTES) }))
      return
    }

    onPick(next)
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>

      {existing?.length ? (
        <ul className="flex flex-col gap-1">
          {existing.map((item) => (
            <li key={item.id}>
              <a
                href={`/api/archive/${item.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm hover:underline"
              >
                <FileTextIcon className="size-3.5 shrink-0" />
                <span className="truncate">{item.title}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {file ? (
        <div className="flex items-center gap-2 rounded-md border p-2.5">
          <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
          <span className="text-muted-foreground text-xs">
            {formatSize(file.size)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={tc("clear")}
            disabled={disabled}
            onClick={() => {
              onPick(null)
              if (inputRef.current) inputRef.current.value = ""
            }}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon className="size-4" />
          {t("pickFile")}
        </Button>
      )}

      {description ? <FieldDescription>{description}</FieldDescription> : null}

      <input
        ref={inputRef}
        id={id}
        type="file"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => choose(event.target.files?.[0] ?? null)}
      />
    </Field>
  )
}
