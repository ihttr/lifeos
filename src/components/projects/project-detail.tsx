"use client"

import { cn } from "cn"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  GitBranchIcon,
  GlobeIcon,
  ListChecksIcon,
  PencilIcon,
  PlusIcon,
  RocketIcon,
  Trash2Icon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { ProjectFormDialog } from "@/components/projects/project-form-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { ProgressBar } from "@/components/shared/progress-bar"
import {
  TaskFormDialog,
  type TaskFormOptions,
} from "@/components/tasks/task-form-dialog"
import { TaskList } from "@/components/tasks/task-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAction } from "@/hooks/use-action"
import { Link, useRouter } from "@/i18n/navigation"
import { formatDateShort, isOverdue, relativeDueLabel } from "@/lib/dates"
import {
  addMilestone,
  deleteMilestone,
  deleteProject,
  toggleMilestone,
} from "@/server/actions/projects"
import {
  archiveTasks,
  deleteTask,
  duplicateTask,
  toggleTask,
} from "@/server/actions/tasks"

import type { Locale } from "@/i18n/routing"
import type { ProjectDetail as ProjectDetailData } from "@/server/queries/projects"
import type { TaskDTO } from "@/server/queries/tasks"

const STATUS_CLASS: Record<ProjectDetailData["status"], string> = {
  PLANNING: "",
  IN_PROGRESS: "border-info/40 text-info",
  PAUSED: "border-warning/40 text-warning",
  COMPLETED: "border-success/40 text-success",
  ARCHIVED: "text-muted-foreground",
}

export function ProjectDetail({
  project,
  tasks,
  taskOptions,
}: {
  project: ProjectDetailData
  tasks: TaskDTO[]
  taskOptions: TaskFormOptions
}) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const router = useRouter()
  const { pending, run } = useAction()

  const [editOpen, setEditOpen] = useState(false)
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskDTO | null>(null)
  const [milestoneDraft, setMilestoneDraft] = useState("")

  const links = [
    { url: project.githubUrl, label: "GitHub", Icon: GitBranchIcon },
    { url: project.websiteUrl, label: t("project.website"), Icon: GlobeIcon },
    { url: project.deployUrl, label: t("project.deploy"), Icon: RocketIcon },
  ].filter((link) => link.url)

  const doneMilestones = project.milestones.filter((m) => m.done).length

  const taskHandlers = {
    onToggleDone: (task: TaskDTO, done: boolean) =>
      run(() => toggleTask({ id: task.id, done }), {
        success: done ? "task.completed" : "task.reopened",
      }),
    onEdit: (task: TaskDTO) => {
      setEditingTask(task)
      setTaskFormOpen(true)
    },
    onDuplicate: (task: TaskDTO) => run(() => duplicateTask({ id: task.id })),
    onArchive: (task: TaskDTO) => run(() => archiveTasks({ ids: [task.id] })),
    onDelete: (task: TaskDTO) =>
      run(() => deleteTask({ id: task.id }), { success: "task.deleted" }),
  }

  function submitMilestone() {
    const title = milestoneDraft.trim()
    if (!title) return
    setMilestoneDraft("")
    run(() => addMilestone({ projectId: project.id, title }))
  }

  return (
    <>
      <Link
        href="/projects"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowRightIcon className="size-4 rtl:block ltr:hidden" />
        <ArrowLeftIcon className="size-4 rtl:hidden" />
        {t("nav.projects")}
      </Link>

      <header className="pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ background: project.color ?? "var(--muted-foreground)" }}
            />
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {project.name}
            </h1>
            <Badge
              variant="outline"
              className={cn("font-normal", STATUS_CLASS[project.status])}
            >
              {t(`projectStatus.${project.status}`)}
            </Badge>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <PencilIcon className="size-4" />
              <span className="hidden sm:inline">{t("common.edit")}</span>
            </Button>

            <ConfirmDialog
              title={t("project.deleteConfirmTitle")}
              description={t("project.deleteConfirmBody")}
              onConfirm={() =>
                run(() => deleteProject({ id: project.id }), {
                  success: "project.deleted",
                  onSuccess: () => router.push("/projects"),
                })
              }
              trigger={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("common.delete")}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              }
            />
          </div>
        </div>

        {project.description ? (
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm">
            {project.description}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <ProgressBar
            value={project.progress}
            label={t("common.progress")}
            color={project.color}
            className="max-w-md"
          />

          <dl className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {project.startDate ? (
              <div>
                <dt className="inline">{t("project.startDate")}: </dt>
                <dd className="inline">
                  {formatDateShort(project.startDate, locale)}
                </dd>
              </div>
            ) : null}
            {project.deadline ? (
              <div
                className={cn(
                  isOverdue(project.deadline) &&
                    project.status !== "COMPLETED" &&
                    "text-destructive font-medium"
                )}
              >
                <dt className="inline">{t("project.deadline")}: </dt>
                <dd className="inline">
                  {relativeDueLabel(project.deadline, locale)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="inline">{t("task.priority")}: </dt>
              <dd className="inline">{t(`priority.${project.priority}`)}</dd>
            </div>
          </dl>
        </div>

        {project.technologies.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {project.technologies.map((tech) => (
              <span
                key={tech}
                className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs"
              >
                {tech}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <Tabs defaultValue="tasks">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="tasks">
            {t("nav.tasks")}
            <span className="text-muted-foreground ms-1.5 text-xs">
              {project.doneTaskCount}/{project.taskCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="milestones">
            {t("project.milestones")}
            <span className="text-muted-foreground ms-1.5 text-xs">
              {doneMilestones}/{project.milestones.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="notes">{t("nav.notes")}</TabsTrigger>
          <TabsTrigger value="links">{t("project.links")}</TabsTrigger>
        </TabsList>

        {/* --- المهام --- */}
        <TabsContent value="tasks" className="mt-4 space-y-4">
          <Button
            variant="outline"
            onClick={() => {
              setEditingTask(null)
              setTaskFormOpen(true)
            }}
          >
            <PlusIcon className="size-4" />
            {t("task.new")}
          </Button>

          {tasks.length === 0 ? (
            <EmptyState
              Icon={ListChecksIcon}
              title={t("empty.tasksTitle")}
              description={t("empty.tasksBody")}
            />
          ) : (
            <TaskList
              tasks={tasks}
              handlers={taskHandlers}
              disabled={pending}
            />
          )}
        </TabsContent>

        {/* --- المراحل --- */}
        <TabsContent value="milestones" className="mt-4">
          <div className="rounded-xl border">
            <ul className="divide-y">
              {project.milestones.map((milestone) => (
                <li
                  key={milestone.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <Checkbox
                    checked={milestone.done}
                    disabled={pending}
                    aria-label={milestone.title}
                    onCheckedChange={(value) =>
                      run(() =>
                        toggleMilestone({
                          id: milestone.id,
                          done: value === true,
                        })
                      )
                    }
                  />
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      milestone.done && "text-muted-foreground line-through"
                    )}
                  >
                    {milestone.title}
                  </span>
                  {milestone.dueDate ? (
                    <span className="text-muted-foreground text-xs">
                      {formatDateShort(milestone.dueDate, locale)}
                    </span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={pending}
                    aria-label={t("common.delete")}
                    onClick={() =>
                      run(() => deleteMilestone({ id: milestone.id }))
                    }
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>

            <div className="flex gap-2 border-t p-3">
              <Input
                value={milestoneDraft}
                onChange={(event) => setMilestoneDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    submitMilestone()
                  }
                }}
                placeholder={t("project.addMilestone")}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={submitMilestone}
                disabled={pending || milestoneDraft.trim() === ""}
                aria-label={t("project.addMilestone")}
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* --- الملاحظات --- */}
        <TabsContent value="notes" className="mt-4 space-y-3">
          {project.notes ? (
            <div className="rounded-xl border p-4">
              <p className="text-sm whitespace-pre-wrap">{project.notes}</p>
            </div>
          ) : null}

          {project.projectNotes.length > 0 ? (
            <ul className="divide-y rounded-xl border">
              {project.projectNotes.map((note) => (
                <li key={note.id}>
                  <Link
                    href={`/notes?open=${note.id}`}
                    className="hover:bg-accent/40 flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors"
                  >
                    <span className="truncate">{note.title}</span>
                    <ExternalLinkIcon className="text-muted-foreground size-3.5 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : project.notes ? null : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {t("empty.notesTitle")}
            </p>
          )}
        </TabsContent>

        {/* --- الروابط --- */}
        <TabsContent value="links" className="mt-4">
          {links.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {t("project.noLinks")}
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {links.map(({ url, label, Icon }) => (
                <li key={label}>
                  <a
                    href={url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-accent/40 flex items-center gap-3 px-3 py-3 text-sm transition-colors"
                  >
                    <Icon className="text-muted-foreground size-4 shrink-0" />
                    <span className="shrink-0 font-medium">{label}</span>
                    <span
                      className="text-muted-foreground truncate text-xs"
                      dir="ltr"
                    >
                      {url}
                    </span>
                    <ExternalLinkIcon className="text-muted-foreground ms-auto size-3.5 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
      />

      <TaskFormDialog
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        task={editingTask}
        options={taskOptions}
        defaults={{ projectId: project.id }}
      />
    </>
  )
}
