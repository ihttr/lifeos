"use client"

import { LoaderCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { loginAction, type LoginState } from "@/server/actions/auth"

export function LoginForm({
  locale,
  next,
}: {
  locale: string
  next?: string
}) {
  const t = useTranslations()
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    null
  )

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">{t("auth.email")}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            dir="ltr"
            required
            autoFocus
            aria-invalid={state?.error ? true : undefined}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">{t("auth.password")}</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            required
            aria-invalid={state?.error ? true : undefined}
          />
          {state?.error ? <FieldError>{t(state.error)}</FieldError> : null}
        </Field>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? (
            <>
              <LoaderCircleIcon className="animate-spin" />
              {t("auth.signingIn")}
            </>
          ) : (
            t("auth.signIn")
          )}
        </Button>
      </FieldGroup>
    </form>
  )
}
