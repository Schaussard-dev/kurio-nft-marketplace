import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toApiError } from '@/shared/api/api-error'
import { loginInputSchema, type LoginInput } from '@/shared/contracts'
import { safeRedirect } from '@/shared/lib/safe-redirect'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useLogin } from '../queries'
import { takeResume } from '../session-events'
import { AuthDivider, AuthField } from './AuthField'
import { AUTH_INPUT_CLASS, type AuthVariant } from './auth-styles'
import { PasswordInput } from './PasswordInput'
import { SocialButtons, UnavailablePopover } from './SocialButtons'

export const EXPIRED_MESSAGE = 'Sua sessão expirou. Entre novamente para continuar.'

export function LoginForm({
  variant,
  redirect,
  expired = false,
}: {
  variant: AuthVariant
  redirect?: string
  expired?: boolean
}) {
  const login = useLogin()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await login.mutateAsync(values)
    } catch (error) {
      const apiError = toApiError(error)
      const fields = apiError.fieldErrors
      if (fields?.email?.[0]) setError('email', { message: fields.email[0] }, { shouldFocus: true })
      if (fields?.password?.[0]) setError('password', { message: fields.password[0] })
      if (!fields) {
        setFormError(apiError.status === 401 ? apiError.message : 'Não foi possível entrar agora. Tente novamente.')
      }
      return
    }
    const resume = takeResume()
    // `redirect` comes from the URL: only internal paths are followed (open-redirect protection).
    await navigate({ href: safeRedirect(redirect ?? resume?.path), replace: true })
  })

  const input = AUTH_INPUT_CLASS[variant]
  const prefix = `entrar-${variant}`

  return (
    <div className="flex flex-col gap-6">
      {expired && (
        <p
          role="alert"
          className="rounded-md border border-amber/60 bg-amber/10 px-4 py-3 text-caption-13 text-foreground"
        >
          {EXPIRED_MESSAGE}
        </p>
      )}
      <form aria-label="Entrar" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <AuthField id={`${prefix}-email`} label="E-mail" error={errors.email?.message}>
          {(a11y) => (
            <input
              {...a11y}
              {...register('email')}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="contato@email.com"
              className={input}
            />
          )}
        </AuthField>
        <AuthField id={`${prefix}-senha`} label="Senha" error={errors.password?.message}>
          {(a11y) => (
            <PasswordInput
              {...a11y}
              {...register('password')}
              autoComplete="current-password"
              placeholder="Senha"
              className={input}
            />
          )}
        </AuthField>
        <div className="flex justify-end">
          <UnavailablePopover>
            <button
              type="button"
              className={cn(
                'text-text-accent underline-offset-4 hover:underline',
                variant === 'dialog' ? 'text-caption-13' : 'text-body-15',
              )}
            >
              Esqueceu a senha?
            </button>
          </UnavailablePopover>
        </div>
        {formError && (
          <p role="alert" className="text-caption-13 text-danger">
            {formError}
          </p>
        )}
        <Button
          type="submit"
          disabled={login.isPending}
          className={cn('mt-4 w-full', variant === 'dialog' ? 'h-11' : 'h-[60px] rounded-xl text-body-lg-18')}
        >
          {login.isPending ? (
            <>
              <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
              Entrando…
            </>
          ) : (
            'Entrar'
          )}
        </Button>
      </form>
      <AuthDivider />
      <SocialButtons variant={variant} />
    </div>
  )
}
