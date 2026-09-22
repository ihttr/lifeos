"use client"

import { BookOpenIcon, CheckCircle2Icon, LayersIcon, PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, type FormEvent } from "react"

import { StatCard } from "@/components/dashboard/stat-card"
import { PathCard } from "@/components/learning/path-card"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveDialog } from "@/components/shared/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
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
import { useFilterParams } from "@/hooks/use-filter-params"
import { formDataToObject } from "@/lib/form"
import { addResource, createPath, updatePath } from "@/server/actions/learning"

import type { LearningFilters, PathStatus, ResourceType } from "@/schemas/learning"
import type { PathDTO } from "@/server/queries/learning"

const STATUSES: PathStatus[] = ["ACTIVE", "PAUSED", "COMPLETED"]
const TYPES: ResourceType[] = [
  "WEBSITE",
  "YOUTUBE",
  "DOCS",
  "COURSE",
  "GITHUB",
  "OTHER",
]

const COLORS = [
  "oklch(0.6 0.16 265)",
  "oklch(0.63 0.13 195)",
  "oklch(0.62 0.15 148)",
  "oklch(0.7 0.16 75)",
  "oklch(0.6 0.2 340)",
]

export function LearningView({
  paths,
  summary,
  filters,
}: {
  paths: PathDTO[]
  summary: { active: number; completed: number; lessons: number; doneLessons: number }
  filters: LearningFilters
}) {
  const t = useTranslations()
  const { set } = useFilterParams()
  const { pending, run } = useAction()
  const { setErrors, error: fieldError, reset: resetErrors } = useFieldErrors()

  const [pathOpen, setPathOpen] = useState(false)
  const [editing, setEditing] = useState<PathDTO | null>(null)
  const [color, setColor] = useState(COLORS[0])
  const [resourceFor, setResourceFor] = useState<PathDTO | null>(null)

  function openPath(path: PathDTO | null) {
    setEditing(path)
    setColor(path?.color ?? COLORS[0])
    resetErrors()
    setPathOpen(true)
  }

  function submitPath(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetErrors()

    const input = {
      ...formDataToObject(new FormData(event.currentTarget)),
      color,
    }

    run(
      () => (editing ? updatePath({ ...input, id: editing.id }) : createPath(input)),
      {
        success: editing ? "learning.updated" : "learning.created",
        silentValidation: true,
        onSuccess: () => setPathOpen(false),
        onError: (_error, fieldErrors) => setErrors(fieldErrors ?? {}),
      }
    )
  }

  function submitResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetErrors()
    if (!resourceFor) return

    const input = {
      ...formDataToObject(new FormData(event.currentTarget)),
      learningPathId: resourceFor.id,
    }

    run(() => addResource(input), {
      success: "learning.resourceAdded",
      silentValidation: true,
      onSuccess: () => setResourceFor(null),
      onError: (_error, fieldErrors) => setErrors(fieldErrors ?? {}),
    })
  }

  return (
    <>
      <PageHeader
        title={t("nav.learning")}
        description={t("learning.subtitle")}
        actions={
          <Button onClick={() => openPath(null)} className="hidden md:inline-flex">
            <PlusIcon className="size-4" />
            {t("learning.new")}
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-2.5 pb-6">
        <StatCard
          Icon={BookOpenIcon}
          value={summary.active}
          label={t("goalStatus.ACTIVE")}
        />
        <StatCard
          Icon={CheckCircle2Icon}
          value={summary.completed}
          label={t("goalStatus.COMPLETED")}
          tone={summary.completed > 0 ? "success" : "default"}
        />
        <StatCard
          Icon={LayersIcon}
          value={`${summary.doneLessons}/${summary.lessons}`}
          label={t("learning.lessons")}
        />
      </div>

      <div className="pb-5">
        <Select
          value={filters.status ?? "all"}
          onValueChange={(value) => set({ status: value })}
        >
          <SelectTrigger className="w-40" aria-label={t("task.status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("status.allStatuses")}</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`goalStatus.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {paths.length === 0 ? (
        <EmptyState
          Icon={BookOpenIcon}
          title={t("learning.emptyTitle")}
          description={t("learning.emptyBody")}
          action={
            <Button onClick={() => openPath(null)}>
              <PlusIcon className="size-4" />
              {t("learning.new")}
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {paths.map((path) => (
            <PathCard
              key={path.id}
              path={path}
              defaultOpen={filters.open === path.id}
              onEdit={() => openPath(path)}
              onAddResource={() => {
                resetErrors()
                setResourceFor(path)
              }}
            />
          ))}
        </div>
      )}

      <Button
        size="icon"
        onClick={() => openPath(null)}
        aria-label={t("learning.new")}
        className="fixed bottom-24 end-4 z-30 size-12 rounded-full shadow-lg md:hidden"
      >
        <PlusIcon className="size-5" />
      </Button>

      {/* --- نموذج المسار --- */}
      <ResponsiveDialog
        open={pathOpen}
        onOpenChange={setPathOpen}
        title={editing ? t("common.edit") : t("learning.new")}
        description={editing ? undefined : t("learning.hint")}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setPathOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="path-form" disabled={pending}>
              {pending ? t("common.saving") : editing ? t("common.save") : t("common.create")}
            </Button>
          </>
        }
      >
        <form id="path-form" onSubmit={submitPath} noValidate className="pb-2">
          <FieldGroup>
            <Field data-invalid={fieldError("title") ? true : undefined}>
              <FieldLabel htmlFor="path-title">{t("learning.title")}</FieldLabel>
              <Input
                id="path-title"
                name="title"
                defaultValue={editing?.title ?? ""}
                placeholder={t("learning.titlePlaceholder")}
                autoComplete="off"
                autoFocus
                required
                aria-invalid={fieldError("title") ? true : undefined}
              />
              {fieldError("title") ? (
                <FieldError>{fieldError("title")}</FieldError>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="path-description">
                {t("task.description")}
              </FieldLabel>
              <Textarea
                id="path-description"
                name="description"
                rows={2}
                defaultValue={editing?.description ?? ""}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="path-category">{t("note.category")}</FieldLabel>
                <Input
                  id="path-category"
                  name="category"
                  autoComplete="off"
                  defaultValue={editing?.category ?? ""}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="path-status">{t("task.status")}</FieldLabel>
                <Select name="status" defaultValue={editing?.status ?? "ACTIVE"}>
                  <SelectTrigger id="path-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(`goalStatus.${status}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      {/* --- نموذج المصدر --- */}
      <ResponsiveDialog
        open={resourceFor !== null}
        onOpenChange={(value) => !value && setResourceFor(null)}
        title={t("learning.addResource")}
        description={resourceFor?.title}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setResourceFor(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="resource-form" disabled={pending}>
              {pending ? t("common.saving") : t("common.add")}
            </Button>
          </>
        }
      >
        <form id="resource-form" onSubmit={submitResource} noValidate className="pb-2">
          <FieldGroup>
            <Field data-invalid={fieldError("title") ? true : undefined}>
              <FieldLabel htmlFor="resource-title">{t("note.title")}</FieldLabel>
              <Input
                id="resource-title"
                name="title"
                autoComplete="off"
                required
                aria-invalid={fieldError("title") ? true : undefined}
              />
              {fieldError("title") ? (
                <FieldError>{fieldError("title")}</FieldError>
              ) : null}
            </Field>

            <Field data-invalid={fieldError("url") ? true : undefined}>
              <FieldLabel htmlFor="resource-url">{t("learning.url")}</FieldLabel>
              <Input
                id="resource-url"
                name="url"
                type="url"
                dir="ltr"
                inputMode="url"
                placeholder="https://…"
                required
                aria-invalid={fieldError("url") ? true : undefined}
              />
              {fieldError("url") ? <FieldError>{fieldError("url")}</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="resource-type">{t("finance.type")}</FieldLabel>
              <Select name="type" defaultValue="WEBSITE">
                <SelectTrigger id="resource-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`learning.type.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </form>
      </ResponsiveDialog>
    </>
  )
}
