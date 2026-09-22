"use client"

import { useTranslations } from "next-intl"
import { useEffect, useState, type FormEvent } from "react"

import { Markdown } from "@/components/shared/markdown"
import { ResponsiveDialog } from "@/components/shared/responsive-dialog"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAction } from "@/hooks/use-action"
import { useFieldErrors } from "@/hooks/use-field-errors"
import { formDataToObject } from "@/lib/form"
import { createNote, updateNote } from "@/server/actions/notes"

import type { NoteDTO, NoteFormOptions } from "@/server/queries/notes"

export function NoteEditorDialog({
  open,
  onOpenChange,
  note,
  options,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  note: NoteDTO | null
  options: NoteFormOptions
}) {
  const t = useTranslations()
  const { pending, run } = useAction()
  const { setErrors, error: fieldError, reset: resetErrors } = useFieldErrors()
  const [content, setContent] = useState(note?.contentMd ?? "")

  const isEdit = note !== null
  const formId = "note-form"

  // إعادة تعبئة المحرّر عند فتح ملاحظة مختلفة
  useEffect(() => {
    if (open) setContent(note?.contentMd ?? "")
  }, [open, note])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetErrors()

    const input = {
      ...formDataToObject(new FormData(event.currentTarget)),
      contentMd: content,
    }

    run(() => (isEdit ? updateNote({ ...input, id: note.id }) : createNote(input)), {
      success: isEdit ? "note.updated" : "note.created",
      silentValidation: true,
      onSuccess: () => onOpenChange(false),
      onError: (_error, fieldErrors) => setErrors(fieldErrors ?? {}),
    })
  }


  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t("common.edit") : t("note.new")}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending
              ? t("common.saving")
              : isEdit
                ? t("common.save")
                : t("common.create")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="pb-2">
        <FieldGroup>
          <Field data-invalid={fieldError("title") ? true : undefined}>
            <FieldLabel htmlFor="note-title">{t("note.title")}</FieldLabel>
            <Input
              id="note-title"
              name="title"
              defaultValue={note?.title ?? ""}
              placeholder={t("note.titlePlaceholder")}
              autoComplete="off"
              autoFocus
              required
              aria-invalid={fieldError("title") ? true : undefined}
            />
            {fieldError("title") ? (
              <FieldError>{fieldError("title")}</FieldError>
            ) : null}
          </Field>

          <Tabs defaultValue="write">
            <TabsList>
              <TabsTrigger value="write">{t("note.write")}</TabsTrigger>
              <TabsTrigger value="preview">{t("note.preview")}</TabsTrigger>
            </TabsList>

            <TabsContent value="write" className="mt-2">
              <Textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={12}
                dir="auto"
                placeholder={t("note.contentPlaceholder")}
                className="font-mono text-[13px] leading-relaxed"
                aria-label={t("note.content")}
              />
              <FieldDescription className="mt-1.5">
                {t("note.markdownHint")}
              </FieldDescription>
            </TabsContent>

            <TabsContent value="preview" className="mt-2">
              <div className="min-h-64 rounded-lg border p-4">
                {content.trim() ? (
                  <Markdown content={content} />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {t("note.emptyPreview")}
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="note-category">
                {t("note.category")}
              </FieldLabel>
              <Input
                id="note-category"
                name="category"
                list="note-categories"
                autoComplete="off"
                defaultValue={note?.category ?? ""}
              />
              <datalist id="note-categories">
                {options.categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </Field>

            <Field>
              <FieldLabel htmlFor="note-tags">{t("task.tags")}</FieldLabel>
              <Input
                id="note-tags"
                name="tags"
                list="note-tag-suggestions"
                autoComplete="off"
                defaultValue={note?.tags.map((tag) => tag.name).join("، ") ?? ""}
              />
              <datalist id="note-tag-suggestions">
                {options.tags.map((tag) => (
                  <option key={tag.id} value={tag.name} />
                ))}
              </datalist>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="note-project">{t("task.project")}</FieldLabel>
              <Select name="projectId" defaultValue={note?.projectId ?? "none"}>
                <SelectTrigger id="note-project" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common.none")}</SelectItem>
                  {options.projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="note-subject">{t("task.subject")}</FieldLabel>
              <Select name="subjectId" defaultValue={note?.subjectId ?? "none"}>
                <SelectTrigger id="note-subject" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common.none")}</SelectItem>
                  {options.subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="note-path">{t("nav.learning")}</FieldLabel>
              <Select
                name="learningPathId"
                defaultValue={note?.learningPathId ?? "none"}
              >
                <SelectTrigger id="note-path" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common.none")}</SelectItem>
                  {options.paths.map((path) => (
                    <SelectItem key={path.id} value={path.id}>
                      {path.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FieldGroup>
      </form>
    </ResponsiveDialog>
  )
}
