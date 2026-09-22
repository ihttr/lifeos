"use client"

import {
  DownloadIcon,
  LanguagesIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useEffect, useState, type FormEvent } from "react"

import { DashboardCustomizer } from "@/components/settings/dashboard-customizer"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAction } from "@/hooks/use-action"

import type { WidgetId } from "@/components/dashboard/widgets"
import { usePathname, useRouter } from "@/i18n/navigation"
import { LOCALE_LABEL, routing, type Locale } from "@/i18n/routing"
import { formDataToObject } from "@/lib/form"
import {
  countDemoData,
  deleteDemoData,
  exportData,
  updateProfile,
} from "@/server/actions/settings"

export function SettingsView({
  user,
  widgets,
}: {
  user: { name: string | null; email: string }
  widgets: WidgetId[]
}) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const { pending, run } = useAction()

  const [demoCount, setDemoCount] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // عدد البيانات التجريبية — لا نعرض زر الحذف إن لم يبق منها شيء
  useEffect(() => {
    countDemoData({}).then((result) => {
      if (result.ok) setDemoCount(result.data)
    })
  }, [])

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = formDataToObject(new FormData(event.currentTarget))
    run(() => updateProfile(input), { success: "settings.profileSaved" })
  }

  /** التنزيل يتم في المتصفح — الملف لا يمر بخادم ولا يُخزَّن في أي مكان */
  function downloadExport() {
    run(() => exportData({}), {
      onSuccess: (payload) => {
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `lifeos-${new Date().toISOString().slice(0, 10)}.json`
        link.click()
        URL.revokeObjectURL(url)
      },
    })
  }

  return (
    <>
      <PageHeader title={t("nav.settings")} />

      <div className="max-w-2xl space-y-4">
        {/* --- الحساب --- */}
        <section className="bg-card rounded-xl border p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <UserIcon className="size-4" />
            {t("settings.account")}
          </h2>

          <form onSubmit={saveProfile} className="mt-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="settings-name">
                  {t("settings.name")}
                </FieldLabel>
                <Input
                  id="settings-name"
                  name="name"
                  defaultValue={user.name ?? ""}
                  autoComplete="name"
                />
                <FieldDescription>{t("settings.nameHint")}</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="settings-email">
                  {t("auth.email")}
                </FieldLabel>
                <Input
                  id="settings-email"
                  value={user.email}
                  dir="ltr"
                  readOnly
                  disabled
                />
                <FieldDescription>{t("settings.emailHint")}</FieldDescription>
              </Field>

              <div>
                <Button type="submit" disabled={pending}>
                  {pending ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </section>

        {/* --- المظهر واللغة --- */}
        <section className="bg-card rounded-xl border p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <LanguagesIcon className="size-4" />
            {t("settings.appearance")}
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="settings-locale">
                {t("common.language")}
              </FieldLabel>
              <Select
                value={locale}
                onValueChange={(next) =>
                  router.replace(pathname, { locale: next as Locale })
                }
              >
                <SelectTrigger id="settings-locale" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {routing.locales.map((value) => (
                    <SelectItem key={value} value={value}>
                      {LOCALE_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="settings-theme">{t("common.theme")}</FieldLabel>
              <Select
                value={mounted ? theme : undefined}
                onValueChange={setTheme}
              >
                <SelectTrigger id="settings-theme" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <SunIcon className="size-4" />
                    {t("common.themeLight")}
                  </SelectItem>
                  <SelectItem value="dark">
                    <MoonIcon className="size-4" />
                    {t("common.themeDark")}
                  </SelectItem>
                  <SelectItem value="system">
                    <MonitorIcon className="size-4" />
                    {t("common.themeSystem")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </section>

        {/* --- لوحة التحكم --- */}
        <DashboardCustomizer initial={widgets} />

        {/* --- البيانات --- */}
        <section className="bg-card rounded-xl border p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <DownloadIcon className="size-4" />
            {t("settings.data")}
          </h2>

          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm">{t("settings.export")}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {t("settings.exportHint")}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={pending}
                onClick={downloadExport}
              >
                <DownloadIcon className="size-4" />
                {t("settings.download")}
              </Button>
            </div>

            {demoCount !== null && demoCount > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div className="min-w-0">
                  <p className="text-sm">{t("settings.demoData")}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t("settings.demoDataHint", { count: demoCount })}
                  </p>
                </div>

                <ConfirmDialog
                  title={t("settings.demoDeleteTitle")}
                  description={t("settings.demoDeleteBody", { count: demoCount })}
                  confirmLabel={t("common.delete")}
                  onConfirm={() =>
                    run(() => deleteDemoData({}), {
                      success: "settings.demoDeleted",
                      onSuccess: () => setDemoCount(0),
                    })
                  }
                  trigger={
                    <Button variant="outline" disabled={pending}>
                      <Trash2Icon className="size-4" />
                      {t("common.delete")}
                    </Button>
                  }
                />
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </>
  )
}
