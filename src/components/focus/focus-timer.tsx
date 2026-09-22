"use client"

import { cn } from "cn"
import {
  CoffeeIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SkipForwardIcon,
  SquareIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAction } from "@/hooks/use-action"
import { usePomodoro, type PomodoroSettings } from "@/hooks/use-pomodoro"
import { logFocusSession } from "@/server/actions/focus"

/** نغمة قصيرة عبر Web Audio — لا ملف صوت ولا تحميل */
function chime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctx) return

    const ctx = new Ctx()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9)

    for (const [index, frequency] of [880, 1174].entries()) {
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = frequency
      osc.connect(gain)
      osc.start(ctx.currentTime + index * 0.18)
      osc.stop(ctx.currentTime + 0.9)
    }

    setTimeout(() => void ctx.close(), 1200)
  } catch {
    // الصوت رفاهية — صمته لا يعطّل المؤقت
  }
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function FocusTimer({
  settings,
  tasks,
  taskId,
  onTaskChange,
}: {
  settings: PomodoroSettings
  tasks: { id: string; title: string }[]
  taskId: string
  onTaskChange: (id: string) => void
}) {
  const t = useTranslations()
  const { run } = useAction()

  const handleComplete = useCallback(
    ({ startedAt, durationSec }: { startedAt: string; durationSec: number }) => {
      chime()
      run(
        () =>
          logFocusSession({
            type: "WORK",
            startedAt,
            durationSec,
            taskId: taskId === "none" ? undefined : taskId,
          }),
        { success: "focus.sessionLogged" }
      )
    },
    [run, taskId]
  )

  const timer = usePomodoro({ settings, onComplete: handleComplete })

  // الوقت المتبقي في عنوان التبويب — يُرى دون العودة للصفحة
  useEffect(() => {
    if (!timer.hydrated) return

    const original = document.title
    if (timer.running) {
      document.title = `${clock(timer.remainingSec)} · ${t(`focus.${timer.phase}`)}`
    }
    return () => {
      document.title = original
    }
  }, [timer.running, timer.remainingSec, timer.phase, timer.hydrated, t])

  const isWork = timer.phase === "WORK"
  const accent = isWork ? "var(--chart-1)" : "var(--success)"

  // دائرة التقدم
  const radius = 92
  const circumference = 2 * Math.PI * radius

  return (
    <section className="bg-card flex flex-col items-center rounded-xl border px-6 py-8">
      <div className="flex items-center gap-2">
        {isWork ? null : <CoffeeIcon className="text-success size-4" />}
        <p
          className={cn(
            "text-sm font-medium",
            isWork ? "text-muted-foreground" : "text-success"
          )}
        >
          {t(`focus.${timer.phase}`)}
        </p>
      </div>

      <div className="relative mt-5">
        <svg viewBox="0 0 220 220" className="size-52 -rotate-90 sm:size-60">
          <circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="10"
          />
          <circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke={accent}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={
              circumference - (timer.progress / 100) * circumference
            }
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-5xl font-semibold tabular-nums sm:text-6xl"
            dir="ltr"
            aria-live="off"
          >
            {timer.hydrated ? clock(timer.remainingSec) : "--:--"}
          </span>
          <span className="text-muted-foreground mt-1.5 text-xs">
            {t("focus.cycleProgress", {
              done: timer.completedWork % timer.untilLong,
              total: timer.untilLong,
            })}
          </span>
        </div>
      </div>

      {/* حالة نصية لقارئ الشاشة — تُعلن عند تبدّل الطور فقط */}
      <p className="sr-only" aria-live="polite">
        {timer.running
          ? t("focus.runningAnnounce", { phase: t(`focus.${timer.phase}`) })
          : t("focus.pausedAnnounce")}
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        {timer.running ? (
          <Button size="lg" variant="secondary" onClick={timer.pause}>
            <PauseIcon className="size-4" />
            {t("focus.pause")}
          </Button>
        ) : (
          <Button size="lg" onClick={timer.start} disabled={!timer.hydrated}>
            <PlayIcon className="size-4" />
            {t("focus.start")}
          </Button>
        )}

        <Button
          variant="outline"
          size="icon"
          onClick={timer.stop}
          aria-label={t("focus.stop")}
          title={t("focus.stopHint")}
        >
          <SquareIcon className="size-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={timer.skip}
          aria-label={t("focus.skip")}
        >
          <SkipForwardIcon className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            timer.resetCycle()
            toast.success(t("focus.cycleReset"))
          }}
          aria-label={t("focus.resetCycle")}
        >
          <RotateCcwIcon className="size-4" />
        </Button>
      </div>

      <div className="mt-6 w-full max-w-xs">
        <Select value={taskId} onValueChange={onTaskChange}>
          <SelectTrigger className="w-full" aria-label={t("focus.linkedTask")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("focus.noTask")}</SelectItem>
            {tasks.map((task) => (
              <SelectItem key={task.id} value={task.id}>
                {task.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  )
}
