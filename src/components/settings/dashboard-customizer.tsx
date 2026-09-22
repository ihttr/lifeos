"use client"

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "cn"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GripVerticalIcon,
  RotateCcwIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import {
  DEFAULT_WIDGETS,
  WIDGETS,
  WIDGET_IDS,
  type WidgetId,
} from "@/components/dashboard/widgets"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useAction } from "@/hooks/use-action"
import { updateDashboardWidgets } from "@/server/actions/settings"

/**
 * تخصيص لوحة التحكم.
 *
 * الترتيب بالسحب أو بزرَّي أعلى/أسفل. الزرّان ليسا زينة: السحب
 * بلوحة المفاتيح غير موثوق، وعلى الجوال مرهق — والزرّان يعملان
 * في كل الحالات بلا غموض.
 *
 * الإظهار بمفتاح لكل بطاقة، والمخفية تنزل لأسفل القائمة حتى تبقى
 * البطاقات الظاهرة مجتمعة بترتيبها الفعلي على اللوحة.
 */
export function DashboardCustomizer({ initial }: { initial: WidgetId[] }) {
  const t = useTranslations()
  const { pending, run } = useAction()

  const [visible, setVisible] = useState<WidgetId[]>(initial)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setVisible(initial)
    setDirty(false)
  }, [initial])

  const hidden = WIDGET_IDS.filter((id) => !visible.includes(id))
  const rows = [...visible, ...hidden]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const from = visible.indexOf(active.id as WidgetId)
    const to = visible.indexOf(over.id as WidgetId)
    // السحب لا يطال المخفية — إظهارها أولاً ثم ترتيبها
    if (from < 0 || to < 0) return

    setVisible(arrayMove(visible, from, to))
    setDirty(true)
  }

  /** تحريك بطاقة خطوة واحدة — بديل السحب للوحة المفاتيح والجوال */
  function move(id: WidgetId, direction: -1 | 1) {
    const from = visible.indexOf(id)
    const to = from + direction
    if (from < 0 || to < 0 || to >= visible.length) return

    setVisible(arrayMove(visible, from, to))
    setDirty(true)
  }

  function toggle(id: WidgetId, on: boolean) {
    setVisible((current) =>
      on ? [...current, id] : current.filter((value) => value !== id)
    )
    setDirty(true)
  }

  function save() {
    run(() => updateDashboardWidgets({ widgets: visible }), {
      success: "widgets.saved",
      onSuccess: () => setDirty(false),
    })
  }

  function reset() {
    setVisible(DEFAULT_WIDGETS)
    setDirty(true)
  }

  return (
    <section id="dashboard" className="bg-card scroll-mt-20 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">{t("widgets.customize")}</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {t("widgets.customizeHint")}
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={reset} disabled={pending}>
          <RotateCcwIcon className="size-4" />
          {t("widgets.reset")}
        </Button>
      </div>

      <DndContext
        // معرّف ثابت: بدونه يولّد dnd-kit عدّاداً مختلفاً على الخادم
        // والعميل فيفشل الترطيب بتحذير في الطرفية
        id="dashboard-widgets"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visible} strategy={verticalListSortingStrategy}>
          <ul className="mt-4 space-y-1.5">
            {rows.map((id) => (
              <WidgetRow
                key={id}
                id={id}
                visible={visible.includes(id)}
                position={visible.indexOf(id) + 1}
                isFirst={visible.indexOf(id) === 0}
                isLast={visible.indexOf(id) === visible.length - 1}
                onToggle={(on) => toggle(id, on)}
                onMove={(direction) => move(id, direction)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="mt-4 flex items-center gap-2 border-t pt-4">
        <Button onClick={save} disabled={pending || !dirty}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
        {dirty ? (
          <p className="text-muted-foreground text-xs">
            {t("widgets.unsaved")}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function WidgetRow({
  id,
  visible,
  position,
  isFirst,
  isLast,
  onToggle,
  onMove,
}: {
  id: WidgetId
  visible: boolean
  position: number
  isFirst: boolean
  isLast: boolean
  onToggle: (on: boolean) => void
  onMove: (direction: -1 | 1) => void
}) {
  const t = useTranslations()
  const meta = WIDGETS[id]
  const { Icon } = meta

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !visible })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors",
        isDragging && "z-10 shadow-lg",
        !visible && "opacity-60"
      )}
    >
      {visible ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 cursor-grab touch-none rounded p-1 focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
          aria-label={t("widgets.reorder", { name: t(meta.labelKey) })}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4" />
        </button>
      ) : (
        <span className="size-6" aria-hidden />
      )}

      <Icon className="text-muted-foreground size-4 shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {visible ? (
            <span className="text-muted-foreground me-1.5 text-xs tabular-nums">
              {position}
            </span>
          ) : null}
          {t(meta.labelKey)}
        </p>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          {t(meta.descriptionKey)}
        </p>
      </div>

      {visible ? (
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={isFirst}
            onClick={() => onMove(-1)}
            aria-label={t("widgets.moveUp", { name: t(meta.labelKey) })}
          >
            <ChevronUpIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={isLast}
            onClick={() => onMove(1)}
            aria-label={t("widgets.moveDown", { name: t(meta.labelKey) })}
          >
            <ChevronDownIcon className="size-4" />
          </Button>
        </div>
      ) : null}

      <Switch
        checked={visible}
        onCheckedChange={onToggle}
        aria-label={t(meta.labelKey)}
      />
    </li>
  )
}
