import {
  BarChart3Icon,
  BookOpenIcon,
  BookmarkIcon,
  CalendarIcon,
  FolderKanbanIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  NotebookPenIcon,
  SettingsIcon,
  TargetIcon,
  TimerIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  labelKey: string
  Icon: LucideIcon
}

export type NavGroup = {
  labelKey: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "nav.groupMain",
    items: [
      { href: "/dashboard", labelKey: "nav.dashboard", Icon: LayoutDashboardIcon },
      { href: "/tasks", labelKey: "nav.tasks", Icon: ListChecksIcon },
      { href: "/projects", labelKey: "nav.projects", Icon: FolderKanbanIcon },
      { href: "/calendar", labelKey: "nav.calendar", Icon: CalendarIcon },
    ],
  },
  {
    labelKey: "nav.groupStudy",
    items: [
      { href: "/university", labelKey: "nav.university", Icon: GraduationCapIcon },
      { href: "/learning", labelKey: "nav.learning", Icon: BookOpenIcon },
      { href: "/notes", labelKey: "nav.notes", Icon: NotebookPenIcon },
    ],
  },
  {
    labelKey: "nav.groupLife",
    items: [
      { href: "/goals", labelKey: "nav.goals", Icon: TargetIcon },
      { href: "/finance", labelKey: "nav.finance", Icon: WalletIcon },
      { href: "/focus", labelKey: "nav.focus", Icon: TimerIcon },
      { href: "/bookmarks", labelKey: "nav.bookmarks", Icon: BookmarkIcon },
    ],
  },
]

export const NAV_FOOTER: NavItem[] = [
  { href: "/stats", labelKey: "nav.stats", Icon: BarChart3Icon },
  { href: "/settings", labelKey: "nav.settings", Icon: SettingsIcon },
]

export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  ...NAV_FOOTER,
]

/** أربعة فقط في شريط الجوال السفلي — الباقي خلف زر "المزيد" */
export const MOBILE_PRIMARY: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", Icon: LayoutDashboardIcon },
  { href: "/tasks", labelKey: "nav.tasks", Icon: ListChecksIcon },
  { href: "/calendar", labelKey: "nav.calendar", Icon: CalendarIcon },
  { href: "/notes", labelKey: "nav.notes", Icon: NotebookPenIcon },
]
