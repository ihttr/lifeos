"use client"

import { useTranslations } from "next-intl"
import { useState, type FormEvent } from "react"

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
import { Textarea } from "@/components/ui/textarea"
import { useAction } from "@/hooks/use-action"
import { useFieldErrors } from "@/hooks/use-field-errors"
import { formDataToObject } from "@/lib/form"
import { createProject, updateProject } from "@/server/actions/projects"

import type { ProjectStatus } from "@/schemas/project"
import type { ProjectDetail } from "@/server/queries/projects"
import type { ProjectListItem } from "@/server/queries/projects"

const STATUSES: ProjectStatus[] = [
  "PLANNING",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
]

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const

/** ألوان جاهزة تكفي للتمييز البصري بين المشاريع */
const COLORS = [
  "oklch(0.6 0.16 265)",
  "oklch(0.63 0.13 195)",
  "oklch(0.62 0.15 148)",
  "oklch(0.7 0.16 75)",
  "oklch(0.6 0.2 340)",
  "oklch(0.6 0.2 25)",
]

type EditableProject = ProjectListItem | ProjectDetail

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: EditableProject | null
}) {
  const t = useTranslations()
  const { pending, run } = useAction()
  const { setErrors, error: fieldError, reset: resetErrors } = useFieldErrors()
  const [color, setColor] = useState(project?.color ?? COLORS[0])

  const isEdit = project !== null
  const formId = "project-form"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetErrors()

    const input = { ...formDataToObject(new FormData(event.currentTarget)), color }

    run(
      () =>
        isEdit
          ? updateProject({ ...input, id: project.id })
          : createProject(input),
      {
        success: isEdit ? "project.updated" : "project.created",
        silentValidation: true,
        onSuccess: () => onOpenChange(false),
        onError: (_error, fieldErrors) => setErrors(fieldErrors ?? {}),
      }
    )
  }


  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t("common.edit") : t("project.new")}
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
          <Field data-invalid={fieldError("name") ? true : undefined}>
            <FieldLabel htmlFor="name">{t("project.name")}</FieldLabel>
            <Input
              id="name"
              name="name"
              defaultValue={project?.name ?? ""}
              autoComplete="off"
              autoFocus
              required
              aria-invalid={fieldError("name") ? true : undefined}
            />
            {fieldError("name") ? (
              <FieldError>{fieldError("name")}</FieldError>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="description">
              {t("project.description")}
            </FieldLabel>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={project?.description ?? ""}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="status">{t("project.status")}</FieldLabel>
              <Select name="status" defaultValue={project?.status ?? "PLANNING"}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`projectStatus.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="priority">{t("task.priority")}</FieldLabel>
              <Select
                name="priority"
                defaultValue={project?.priority ?? "MEDIUM"}
              >
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`priority.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="startDate">
                {t("project.startDate")}
              </FieldLabel>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                dir="ltr"
                defaultValue={project?.startDate ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="deadline">{t("project.deadline")}</FieldLabel>
              <Input
                id="deadline"
                name="deadline"
                type="date"
                dir="ltr"
                defaultValue={project?.deadline ?? ""}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="technologies">
              {t("project.technologies")}
            </FieldLabel>
            <Input
              id="technologies"
              name="technologies"
              dir="auto"
              autoComplete="off"
              defaultValue={project?.technologies.join("، ") ?? ""}
            />
            <FieldDescription>{t("project.technologiesHint")}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="githubUrl">GitHub</FieldLabel>
            <Input
              id="githubUrl"
              name="githubUrl"
              type="url"
              dir="ltr"
              inputMode="url"
              placeholder="https://github.com/…"
              defaultValue={project?.githubUrl ?? ""}
              aria-invalid={fieldError("githubUrl") ? true : undefined}
            />
            {fieldError("githubUrl") ? (
              <FieldError>{fieldError("githubUrl")}</FieldError>
            ) : null}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="websiteUrl">
                {t("project.website")}
              </FieldLabel>
              <Input
                id="websiteUrl"
                name="websiteUrl"
                type="url"
                dir="ltr"
                inputMode="url"
                defaultValue={project?.websiteUrl ?? ""}
                aria-invalid={fieldError("websiteUrl") ? true : undefined}
              />
              {fieldError("websiteUrl") ? (
                <FieldError>{fieldError("websiteUrl")}</FieldError>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="deployUrl">{t("project.deploy")}</FieldLabel>
              <Input
                id="deployUrl"
                name="deployUrl"
                type="url"
                dir="ltr"
                inputMode="url"
                defaultValue={project?.deployUrl ?? ""}
                aria-invalid={fieldError("deployUrl") ? true : undefined}
              />
              {fieldError("deployUrl") ? (
                <FieldError>{fieldError("deployUrl")}</FieldError>
              ) : null}
            </Field>
          </div>

          <Field>
            <FieldLabel>{t("project.color")}</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setColor(value)}
                  aria-label={value}
                  aria-pressed={color === value}
                  className="ring-offset-background focus-visible:ring-ring size-7 rounded-full transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none aria-pressed:scale-110 aria-pressed:ring-2 aria-pressed:ring-offset-2"
                  style={{ background: value }}
                />
              ))}
            </div>
          </Field>
        </FieldGroup>
      </form>
    </ResponsiveDialog>
  )
}
