"use client"

import { cn } from "cn"
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ProgressBar } from "@/components/shared/progress-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useAction } from "@/hooks/use-action"
import {
  addLesson,
  addSection,
  deletePath,
  deleteLesson,
  deleteResource,
  deleteSection,
  toggleLesson,
} from "@/server/actions/learning"

import type { PathDTO } from "@/server/queries/learning"

const STATUS_CLASS: Record<PathDTO["status"], string> = {
  ACTIVE: "border-info/40 text-info",
  COMPLETED: "border-success/40 text-success",
  PAUSED: "border-warning/40 text-warning",
}

export function PathCard({
  path,
  defaultOpen,
  onEdit,
  onAddResource,
}: {
  path: PathDTO
  defaultOpen?: boolean
  onEdit: () => void
  onAddResource: () => void
}) {
  const t = useTranslations()
  const { pending, run } = useAction()
  const [open, setOpen] = useState(defaultOpen ?? false)
  const [sectionDraft, setSectionDraft] = useState("")
  const [lessonDrafts, setLessonDrafts] = useState<Record<string, string>>({})

  const accent = path.color ?? "var(--chart-1)"

  function submitSection() {
    const title = sectionDraft.trim()
    if (!title) return
    setSectionDraft("")
    run(() => addSection({ learningPathId: path.id, title }))
  }

  function submitLesson(sectionId: string) {
    const title = (lessonDrafts[sectionId] ?? "").trim()
    if (!title) return
    setLessonDrafts((current) => ({ ...current, [sectionId]: "" }))
    run(() => addLesson({ sectionId, title }))
  }

  return (
    <article className="bg-card rounded-xl border">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2.5">
              <span
                className="mt-1.5 size-2.5 shrink-0 rounded-full"
                style={{ background: accent }}
              />
              <div className="min-w-0">
                <h3 className="truncate font-medium">{path.title}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge
                    variant="outline"
                    className={cn("font-normal", STATUS_CLASS[path.status])}
                  >
                    {t(`goalStatus.${path.status}`)}
                  </Badge>
                  {path.category ? (
                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px]">
                      {path.category}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 -me-1 shrink-0 rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                aria-label={t("common.more")}
              >
                <MoreHorizontalIcon className="size-4" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={onEdit}>
                  <PencilIcon className="size-4" />
                  {t("common.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onAddResource}>
                  <PlusIcon className="size-4" />
                  {t("learning.addResource")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <ConfirmDialog
                  title={t("learning.deleteConfirmTitle")}
                  description={t("learning.deleteConfirmBody")}
                  onConfirm={() =>
                    run(() => deletePath({ id: path.id }), {
                      success: "learning.deleted",
                    })
                  }
                  trigger={
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={(event) => event.preventDefault()}
                    >
                      <Trash2Icon className="size-4" />
                      {t("common.delete")}
                    </DropdownMenuItem>
                  }
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {path.description ? (
            <p className="text-muted-foreground mt-2.5 line-clamp-2 text-sm">
              {path.description}
            </p>
          ) : null}

          <ProgressBar
            value={path.progress}
            label={t("learning.lessonsDone", {
              done: path.doneLessons,
              total: path.totalLessons,
            })}
            color={accent}
            className="mt-4"
          />

          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="mt-3 w-full">
              <ChevronDownIcon
                className={cn("size-4 transition-transform", open && "rotate-180")}
              />
              {open ? t("common.showLess") : t("learning.showSections")}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="space-y-4 border-t p-4">
            {path.sections.map((section) => (
              <section key={section.id}>
                <div className="group/section mb-1.5 flex items-center gap-2">
                  <h4 className="text-sm font-medium">{section.title}</h4>
                  <span className="text-muted-foreground text-xs">
                    {section.doneCount}/{section.lessons.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ms-auto size-7 md:opacity-0 md:group-hover/section:opacity-100"
                    disabled={pending}
                    aria-label={t("common.delete")}
                    onClick={() => run(() => deleteSection({ id: section.id }))}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>

                <ul className="space-y-1">
                  {section.lessons.map((lesson) => (
                    <li key={lesson.id} className="group/lesson flex items-center gap-2">
                      <Checkbox
                        checked={lesson.done}
                        disabled={pending}
                        aria-label={lesson.title}
                        onCheckedChange={(value) =>
                          run(() =>
                            toggleLesson({ id: lesson.id, done: value === true })
                          )
                        }
                      />
                      <span
                        className={cn(
                          "flex-1 text-sm",
                          lesson.done && "text-muted-foreground line-through"
                        )}
                      >
                        {lesson.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 md:opacity-0 md:group-hover/lesson:opacity-100"
                        disabled={pending}
                        aria-label={t("common.delete")}
                        onClick={() => run(() => deleteLesson({ id: lesson.id }))}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>

                <div className="mt-2 flex gap-2">
                  <Input
                    value={lessonDrafts[section.id] ?? ""}
                    onChange={(event) =>
                      setLessonDrafts((current) => ({
                        ...current,
                        [section.id]: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        submitLesson(section.id)
                      }
                    }}
                    placeholder={t("learning.addLesson")}
                    autoComplete="off"
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={pending || !(lessonDrafts[section.id] ?? "").trim()}
                    onClick={() => submitLesson(section.id)}
                    aria-label={t("learning.addLesson")}
                  >
                    <PlusIcon className="size-4" />
                  </Button>
                </div>
              </section>
            ))}

            <div className="flex gap-2 border-t pt-4">
              <Input
                value={sectionDraft}
                onChange={(event) => setSectionDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    submitSection()
                  }
                }}
                placeholder={t("learning.addSection")}
                autoComplete="off"
                className="h-8 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0"
                disabled={pending || sectionDraft.trim() === ""}
                onClick={submitSection}
                aria-label={t("learning.addSection")}
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>

            {path.resources.length > 0 ? (
              <div className="border-t pt-4">
                <p className="mb-2 text-sm font-medium">{t("learning.resources")}</p>
                <ul className="space-y-1">
                  {path.resources.map((resource) => (
                    <li
                      key={resource.id}
                      className="group/res flex items-center gap-2"
                    >
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground text-muted-foreground flex min-w-0 flex-1 items-center gap-1.5 text-sm transition-colors"
                      >
                        <ExternalLinkIcon className="size-3.5 shrink-0" />
                        <span className="truncate">{resource.title}</span>
                        <span className="bg-muted shrink-0 rounded px-1.5 py-0.5 text-[10px]">
                          {t(`learning.type.${resource.type}`)}
                        </span>
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 md:opacity-0 md:group-hover/res:opacity-100"
                        disabled={pending}
                        aria-label={t("common.delete")}
                        onClick={() => run(() => deleteResource({ id: resource.id }))}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </article>
  )
}
