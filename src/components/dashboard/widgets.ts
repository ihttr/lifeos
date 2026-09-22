import {
  BookOpenCheckIcon,
  CalendarClockIcon,
  FolderKanbanIcon,
  LayoutGridIcon,
  ListChecksIcon,
  NotebookPenIcon,
  TargetIcon,
  TimerIcon,
  WalletIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react"

/**
 * سجلّ بطاقات لوحة التحكم.
 *
 * مصدر واحد للحقيقة: الإعدادات تقرأ منه لبناء قائمة التخصيص،
 * واللوحة تقرأ منه لتعرف ماذا ترسم، والخادم يقرأ منه ليعرف
 * أي استعلام يلزم — فلا نجلب بيانات بطاقة مخفية.
 */

export const WIDGET_IDS = [
  "stats",
  "todayTasks",
  "upcoming",
  "projects",
  "goals",
  "university",
  "focus",
  "finance",
  "notes",
  "quickActions",
] as const

export type WidgetId = (typeof WIDGET_IDS)[number]

export type WidgetMeta = {
  id: WidgetId
  labelKey: string
  descriptionKey: string
  Icon: LucideIcon
  /** البطاقات العريضة تأخذ عمودين على الشاشات الكبيرة */
  wide: boolean
}

export const WIDGETS: Record<WidgetId, WidgetMeta> = {
  stats: {
    id: "stats",
    labelKey: "widgets.stats",
    descriptionKey: "widgets.statsDesc",
    Icon: LayoutGridIcon,
    wide: true,
  },
  todayTasks: {
    id: "todayTasks",
    labelKey: "widgets.todayTasks",
    descriptionKey: "widgets.todayTasksDesc",
    Icon: ListChecksIcon,
    wide: true,
  },
  upcoming: {
    id: "upcoming",
    labelKey: "widgets.upcoming",
    descriptionKey: "widgets.upcomingDesc",
    Icon: CalendarClockIcon,
    wide: false,
  },
  projects: {
    id: "projects",
    labelKey: "widgets.projects",
    descriptionKey: "widgets.projectsDesc",
    Icon: FolderKanbanIcon,
    wide: false,
  },
  goals: {
    id: "goals",
    labelKey: "widgets.goals",
    descriptionKey: "widgets.goalsDesc",
    Icon: TargetIcon,
    wide: false,
  },
  university: {
    id: "university",
    labelKey: "widgets.university",
    descriptionKey: "widgets.universityDesc",
    Icon: BookOpenCheckIcon,
    wide: false,
  },
  focus: {
    id: "focus",
    labelKey: "widgets.focus",
    descriptionKey: "widgets.focusDesc",
    Icon: TimerIcon,
    wide: false,
  },
  finance: {
    id: "finance",
    labelKey: "widgets.finance",
    descriptionKey: "widgets.financeDesc",
    Icon: WalletIcon,
    wide: false,
  },
  notes: {
    id: "notes",
    labelKey: "widgets.notes",
    descriptionKey: "widgets.notesDesc",
    Icon: NotebookPenIcon,
    wide: false,
  },
  quickActions: {
    id: "quickActions",
    labelKey: "widgets.quickActions",
    descriptionKey: "widgets.quickActionsDesc",
    Icon: ZapIcon,
    wide: true,
  },
}

/** الترتيب الافتراضي لمن لم يخصّص شيئاً */
export const DEFAULT_WIDGETS: WidgetId[] = [
  "stats",
  "todayTasks",
  "upcoming",
  "projects",
  "goals",
  "quickActions",
]

function isWidgetId(value: string): value is WidgetId {
  return (WIDGET_IDS as readonly string[]).includes(value)
}

/**
 * يحوّل ما هو مخزّن إلى قائمة صالحة.
 * يتجاهل المعرّفات التي لم تعد موجودة (من إصدار أقدم) ويزيل التكرار،
 * والفراغ يعني الافتراضي لا "لوحة خالية".
 */
export function resolveWidgets(stored: string[]): WidgetId[] {
  if (stored.length === 0) return DEFAULT_WIDGETS

  const valid = stored.filter(isWidgetId)
  return valid.length > 0 ? [...new Set(valid)] : DEFAULT_WIDGETS
}
