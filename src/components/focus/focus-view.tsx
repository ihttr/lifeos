"use client"

import {
  FlameIcon,
  SettingsIcon,
  TimerIcon,
  Trash2Icon,
  TrendingUpIcon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState, type FormEvent } from "react"

import { StatCard } from "@/components/dashboard/stat-card"
import { FocusChart } from "@/components/focus/focus-chart"
import { FocusTimer } from "@/components/focus/focus-timer"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveDialog } from "@/components/shared/responsive-dialog"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAction } from "@/hooks/use-action"
import { formatClock, formatDateShort, toISODateInTZ } from "@/lib/dates"
import { formatDuration } from "@/lib/format"
import { formDataToObject } from "@/lib/form"
import {
  deleteFocusSession,
  updateFocusSettings,
} from "@/server/actions/focus"

import type { Locale } from "@/i18n/routing"
import type { FocusData } from "@/server/queries/focus"

export function FocusView({
  data,
  tasks,
}: {
  data: FocusData
  tasks: { id: string; title: string }[]
}) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const { pending, run } = useAction()

  const [taskId, setTaskId] = useState("none")
  const [settingsOpen, setSettingsOpen] = useState(false)

  const settings = {
    workMin: data.settings.pomodoroWorkMin,
    breakMin: data.settings.pomodoroBreakMin,
    longBreakMin: data.settings.pomodoroLongBreakMin,
    untilLong: data.settings.pomodoroUntilLong,
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = formDataToObject(new FormData(event.currentTarget))

    run(() => updateFocusSettings(input), {
      success: "focus.settingsSaved",
      onSuccess: () => setSettingsOpen(false),
    })
  }

  return (
    <>
      <PageHeader
        title={t("nav.focus")}
        description={t("focus.subtitle")}
        actions={
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon className="size-4" />
            <span className="hidden sm:inline">{t("focus.settings")}</span>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <FocusTimer
          settings={settings}
          tasks={tasks}
          taskId={taskId}
          onTaskChange={setTaskId}
        />

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              Icon={TimerIcon}
              value={formatDuration(data.todaySec, locale)}
              label={t("focus.today")}
              hint={
                data.todaySessions > 0
                  ? t("focus.sessionCount", { count: data.todaySessions })
                  : undefined
              }
            />
            <StatCard
              Icon={TrendingUpIcon}
              value={formatDuration(data.weekSec, locale)}
              label={t("focus.thisWeek")}
            />
            <StatCard
              Icon={TrendingUpIcon}
              value={formatDuration(data.monthSec, locale)}
              label={t("focus.last28")}
            />
            <StatCard
              Icon={FlameIcon}
              value={data.streak}
              label={t("focus.streak")}
              tone={data.streak >= 3 ? "success" : "default"}
              hint={t("focus.streakHint")}
            />
          </div>

          <FocusChart days={data.days} />
        </div>
      </div>

      {/* آخر الجلسات */}
      <section className="pt-6">
        <h2 className="mb-2.5 text-sm font-medium">{t("focus.recent")}</h2>

        {data.recent.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
            {t("focus.noSessions")}
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {data.recent.map((session) => {
              const started = new Date(session.startedAt)

              return (
                <li
                  key={session.id}
                  className="group flex items-center gap-3 px-3 py-2.5"
                >
                  <TimerIcon className="text-muted-foreground size-4 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {session.task?.title ?? t("focus.noTask")}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {formatDateShort(toISODateInTZ(started), locale)} ·{" "}
                      {formatClock(
                        new Intl.DateTimeFormat("en-GB", {
                          timeZone: "Asia/Riyadh",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        }).format(started),
                        locale
                      )}
                    </p>
                  </div>

                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {formatDuration(session.durationSec, locale)}
                  </span>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 md:opacity-0 md:group-hover:opacity-100"
                    disabled={pending}
                    aria-label={t("common.delete")}
                    onClick={() =>
                      run(() => deleteFocusSession({ id: session.id }))
                    }
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ResponsiveDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title={t("focus.settings")}
        description={t("focus.settingsHint")}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSettingsOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="focus-settings" disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </>
        }
      >
        <form id="focus-settings" onSubmit={saveSettings} className="pb-2">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="workMin">{t("focus.workMin")}</FieldLabel>
                <Input
                  id="workMin"
                  name="workMin"
                  type="number"
                  min={1}
                  max={180}
                  dir="ltr"
                  defaultValue={settings.workMin}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="breakMin">{t("focus.breakMin")}</FieldLabel>
                <Input
                  id="breakMin"
                  name="breakMin"
                  type="number"
                  min={1}
                  max={60}
                  dir="ltr"
                  defaultValue={settings.breakMin}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="longBreakMin">
                  {t("focus.longBreakMin")}
                </FieldLabel>
                <Input
                  id="longBreakMin"
                  name="longBreakMin"
                  type="number"
                  min={1}
                  max={120}
                  dir="ltr"
                  defaultValue={settings.longBreakMin}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="untilLong">
                  {t("focus.untilLong")}
                </FieldLabel>
                <Input
                  id="untilLong"
                  name="untilLong"
                  type="number"
                  min={2}
                  max={12}
                  dir="ltr"
                  defaultValue={settings.untilLong}
                  required
                />
              </Field>
            </div>
            <FieldDescription>{t("focus.settingsNote")}</FieldDescription>
          </FieldGroup>
        </form>
      </ResponsiveDialog>
    </>
  )
}
