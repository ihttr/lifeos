"use client"

import { FileTextIcon, UploadIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"

import { ResponsiveDialog } from "@/components/shared/responsive-dialog"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "@/i18n/navigation"
import { useAction } from "@/hooks/use-action"
import { useFieldErrors } from "@/hooks/use-field-errors"
import { uploadArchiveFile } from "@/lib/upload-client"
import { MAX_FILE_BYTES } from "@/schemas/archive"
import { updateArchiveFile } from "@/server/actions/archive"

import type { ArchiveOptions } from "@/components/archive/archive-view"
import type { ArchiveKind, ArchiveMetaInput } from "@/schemas/archive"
import type { ArchiveFileDTO } from "@/server/queries/archive"

const KINDS: ArchiveKind[] = ["THEORY", "PRACTICAL", "OTHER"]

/** انظر formatSize في archive-view — العازل يمنع قلب «68 B» */
function formatSize(bytes: number): string {
  const text =
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

  return `⁨${text}⁩`
}

/**
 * رفع ملف جديد، أو تحرير بيانات ملف قائم.
 *
 * الملف نفسه لا يُستبدل عند التحرير: استبداله يعني رفعاً جديداً وحذف
 * القديم، وهو عملٌ مختلف. التحرير هنا للعنوان والوصف والربط فقط.
 */
export function ArchiveUploadDialog({
  open,
  onOpenChange,
  file,
  options,
  directUpload,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: ArchiveFileDTO | null
  options: ArchiveOptions
  directUpload: boolean
}) {
  const t = useTranslations("archive")
  const tc = useTranslations("common")
  const router = useRouter()
  const { pending, run } = useAction()
  const { error, setErrors, reset: resetErrors } = useFieldErrors()

  const inputRef = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [kind, setKind] = useState<ArchiveKind>("OTHER")
  const [subjectId, setSubjectId] = useState("none")
  const [projectId, setProjectId] = useState("none")

  const editing = file !== null

  // إعادة ضبط الحقول مع كل فتح — وإلا تسرّبت قيم الملف السابق
  useEffect(() => {
    if (!open) return
    resetErrors()
    setPicked(null)
    setUploading(false)
    setKind(file?.kind ?? "OTHER")
    setSubjectId(file?.subject?.id ?? "none")
    setProjectId(file?.project?.id ?? "none")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- عند الفتح فقط
  }, [open, file])

  function choose(next: File | null) {
    if (!next) return

    if (next.size > MAX_FILE_BYTES) {
      toast.error(t("tooLarge", { max: formatSize(MAX_FILE_BYTES) }))
      return
    }

    setPicked(next)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetErrors()

    const form = new FormData(event.currentTarget)
    const meta = {
      title: String(form.get("title") ?? "").trim(),
      // نرسل undefined لا null: المخطط يقبل الأول ويرفض الثاني.
      // و«none» يحوّلها optionalId إلى null بنفسه، فلا نترجمها هنا.
      description: String(form.get("description") ?? "").trim() || undefined,
      kind,
      subjectId,
      projectId,
      assignmentId: file?.assignment?.id,
    } satisfies ArchiveMetaInput

    if (!meta.title) {
      setErrors({ title: ["errors.required"] })
      return
    }

    if (editing) {
      run(() => updateArchiveFile({ ...meta, id: file.id }), {
        success: "archive.updated",
        silentValidation: true,
        onSuccess: () => onOpenChange(false),
        onError: (_error, fieldErrors) => fieldErrors && setErrors(fieldErrors),
      })
      return
    }

    if (!picked) {
      toast.error(t("pickFile"))
      return
    }

    // الرفع خارج useAction: قد يستغرق دقائق ولا يصحّ أن يحجز transition
    setUploading(true)
    const result = await uploadArchiveFile(picked, meta, { directUpload })
    setUploading(false)

    if (result.ok) {
      toast.success(t("uploaded"))
      onOpenChange(false)
      // الرفع يمرّ بمسار API لا بـ server action، فلا يصل العميلَ ردٌّ
      // يحدّث الشجرة تلقائياً. بدون هذا يبقى الملف غائباً حتى إعادة تحميل.
      router.refresh()
      return
    }

    toast.error(
      result.error.startsWith("archive.") ? t(result.error.slice(8)) : tc("error")
    )
  }

  const busy = pending || uploading

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t("editTitle") : t("uploadTitle")}
      description={editing ? undefined : t("uploadDescription")}
      footer={
        <Button type="submit" form="archive-form" disabled={busy}>
          {uploading ? t("uploading") : editing ? tc("save") : t("upload")}
        </Button>
      }
    >
      <form id="archive-form" onSubmit={handleSubmit}>
        <FieldGroup>
          {editing ? null : (
            <Field>
              <FieldLabel htmlFor="archive-file">{t("file")}</FieldLabel>

              {picked ? (
                <div className="flex items-center gap-2 rounded-md border p-3">
                  <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {picked.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatSize(picked.size)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={tc("clear")}
                    onClick={() => {
                      setPicked(null)
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
                  className="h-20 border-dashed"
                  onClick={() => inputRef.current?.click()}
                >
                  <UploadIcon className="size-4" />
                  {t("pickFile")}
                </Button>
              )}

              <input
                ref={inputRef}
                id="archive-file"
                type="file"
                className="sr-only"
                onChange={(event) => {
                  const next = event.target.files?.[0] ?? null
                  choose(next)
                  // العنوان يُملأ من اسم الملف بلا الامتداد — يوفّر خطوة
                  if (next && !inputRef.current?.dataset.titled) {
                    const form = event.target.form
                    const title = form?.elements.namedItem("title")
                    if (title instanceof HTMLInputElement && !title.value) {
                      title.value = next.name.replace(/\.[^.]+$/, "")
                    }
                  }
                }}
              />
            </Field>
          )}

          <Field data-invalid={Boolean(error("title"))}>
            <FieldLabel htmlFor="archive-title">{t("fileTitle")}</FieldLabel>
            <Input
              id="archive-title"
              name="title"
              defaultValue={file?.title ?? ""}
              maxLength={200}
              required
            />
            <FieldError errors={[{ message: error("title") }]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="archive-description">
              {t("fileDescription")}
            </FieldLabel>
            <Textarea
              id="archive-description"
              name="description"
              defaultValue={file?.description ?? ""}
              maxLength={2000}
              rows={3}
              placeholder={t("descriptionPlaceholder")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="archive-kind">{t("kind")}</FieldLabel>
            <Select
              value={kind}
              onValueChange={(value) => setKind(value as ArchiveKind)}
            >
              <SelectTrigger id="archive-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {t(`kinds.${item}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="archive-subject">{t("subject")}</FieldLabel>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger id="archive-subject">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("noSubject")}</SelectItem>
                {options.subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {options.projects.length > 0 ? (
            <Field>
              <FieldLabel htmlFor="archive-project">{t("project")}</FieldLabel>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="archive-project">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("noProject")}</SelectItem>
                  {options.projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </FieldGroup>
      </form>
    </ResponsiveDialog>
  )
}
