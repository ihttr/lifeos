"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type Phase = "WORK" | "BREAK" | "LONG_BREAK"

export type PomodoroSettings = {
  workMin: number
  breakMin: number
  longBreakMin: number
  untilLong: number
}

type PersistedState = {
  phase: Phase
  /** لحظة بدء الجري الحالية بالمللي ثانية — null إن كان موقوفاً */
  runningSince: number | null
  /** ما انقضى قبل آخر إيقاف */
  elapsedBeforeMs: number
  /** بداية جلسة العمل الحالية، لتسجيلها عند الانتهاء */
  sessionStartedAt: string | null
  /** عدد جلسات العمل المكتملة في هذه الدورة */
  completedWork: number
}

const STORAGE_KEY = "lifeos:pomodoro"

const INITIAL: PersistedState = {
  phase: "WORK",
  runningSince: null,
  elapsedBeforeMs: 0,
  sessionStartedAt: null,
  completedWork: 0,
}

function read(): PersistedState {
  if (typeof window === "undefined") return INITIAL
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return INITIAL
    return { ...INITIAL, ...(JSON.parse(raw) as PersistedState) }
  } catch {
    // وضع التصفح الخاص أو تخزين محظور — نعمل بلا استمرارية
    return INITIAL
  }
}

function write(state: PersistedState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // لا شيء — فقدان الاستمرارية لا يمنع المؤقت من العمل
  }
}

function phaseSeconds(phase: Phase, settings: PomodoroSettings): number {
  if (phase === "WORK") return settings.workMin * 60
  if (phase === "BREAK") return settings.breakMin * 60
  return settings.longBreakMin * 60
}

/**
 * مؤقت بومودورو مثبَّت على الزمن الحقيقي لا على عدّاد تنازلي.
 *
 * الحالة تُحفظ في localStorage مع لحظة البداية، فإعادة تحميل الصفحة
 * أو إغلاق التبويب والعودة لا يفقدان التقدم — نحسب المنقضي من الفارق الزمني.
 * ولهذا أيضاً لا يتأثر بتقييد المتصفح لمؤقتات التبويبات الخلفية.
 */
export function usePomodoro({
  settings,
  onComplete,
}: {
  settings: PomodoroSettings
  /** تُستدعى عند اكتمال جلسة عمل فقط — الاستراحات لا تُسجَّل */
  onComplete: (session: { startedAt: string; durationSec: number }) => void
}) {
  const [state, setState] = useState<PersistedState>(INITIAL)
  const [now, setNow] = useState(() => Date.now())
  const [hydrated, setHydrated] = useState(false)
  const completingRef = useRef(false)

  // القراءة من التخزين بعد الترطيب فقط — الخادم لا يعرف حالة المتصفح
  useEffect(() => {
    setState(read())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) write(state)
  }, [state, hydrated])

  // نبضة كل ثانية أثناء الجري فقط
  useEffect(() => {
    if (state.runningSince === null) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [state.runningSince])

  const totalSec = phaseSeconds(state.phase, settings)

  const elapsedMs =
    state.elapsedBeforeMs +
    (state.runningSince !== null ? Math.max(0, now - state.runningSince) : 0)

  const elapsedSec = Math.floor(elapsedMs / 1000)
  const remainingSec = Math.max(0, totalSec - elapsedSec)
  const running = state.runningSince !== null

  const advance = useCallback(() => {
    setState((current) => {
      const workDone =
        current.phase === "WORK" ? current.completedWork + 1 : current.completedWork

      const nextPhase: Phase =
        current.phase !== "WORK"
          ? "WORK"
          : workDone % settings.untilLong === 0
            ? "LONG_BREAK"
            : "BREAK"

      return {
        phase: nextPhase,
        runningSince: null,
        elapsedBeforeMs: 0,
        sessionStartedAt: null,
        completedWork: workDone,
      }
    })
  }, [settings.untilLong])

  // اكتمال الطور
  useEffect(() => {
    if (!running || remainingSec > 0 || completingRef.current) return

    completingRef.current = true

    if (state.phase === "WORK" && state.sessionStartedAt) {
      onComplete({
        startedAt: state.sessionStartedAt,
        durationSec: totalSec,
      })
    }

    advance()
    // نسمح باكتمال جديد بعد أن تستقر الحالة
    setTimeout(() => {
      completingRef.current = false
    }, 0)
  }, [
    running,
    remainingSec,
    state.phase,
    state.sessionStartedAt,
    totalSec,
    onComplete,
    advance,
  ])

  const start = useCallback(() => {
    setState((current) => ({
      ...current,
      runningSince: Date.now(),
      sessionStartedAt:
        current.sessionStartedAt ??
        new Date(Date.now() - current.elapsedBeforeMs).toISOString(),
    }))
    setNow(Date.now())
  }, [])

  const pause = useCallback(() => {
    setState((current) => {
      if (current.runningSince === null) return current
      return {
        ...current,
        elapsedBeforeMs:
          current.elapsedBeforeMs + (Date.now() - current.runningSince),
        runningSince: null,
      }
    })
  }, [])

  /** إيقاف مع تسجيل ما أُنجز — لا نضيّع دقائق عمل حقيقية */
  const stop = useCallback(() => {
    setState((current) => {
      const done =
        current.elapsedBeforeMs +
        (current.runningSince !== null ? Date.now() - current.runningSince : 0)
      const seconds = Math.floor(done / 1000)

      if (current.phase === "WORK" && current.sessionStartedAt && seconds >= 60) {
        onComplete({
          startedAt: current.sessionStartedAt,
          durationSec: seconds,
        })
      }

      return { ...INITIAL, phase: "WORK", completedWork: current.completedWork }
    })
  }, [onComplete])

  const skip = useCallback(() => advance(), [advance])

  const resetCycle = useCallback(() => setState(INITIAL), [])

  return {
    phase: state.phase,
    running,
    hydrated,
    remainingSec,
    totalSec,
    progress: totalSec > 0 ? Math.min(100, (elapsedSec / totalSec) * 100) : 0,
    completedWork: state.completedWork,
    untilLong: settings.untilLong,
    start,
    pause,
    stop,
    skip,
    resetCycle,
  }
}
