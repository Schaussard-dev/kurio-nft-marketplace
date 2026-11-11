import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toApiError } from '@/shared/api/api-error'
import { registerInputSchema, type RegisterInput } from '@/shared/contracts'
import { safeRedirect } from '@/shared/lib/safe-redirect'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useRegister } from '../queries'
import { AuthDivider, AuthField } from './AuthField'
import { AUTH_INPUT_CLASS, type AuthVariant } from './auth-styles'
import { PasswordInput } from './PasswordInput'
import { SocialButtons } from './SocialButtons'

const FIELDS = ['username', 'email', 'password', 'confirmPassword'] as const satisfies (keyof RegisterInput)[]

export function RegisterForm({ variant, redirect }: { variant: AuthVariant; redirect?: string }) {
  const registerUser = useRegister()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerInputSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await registerUser.mutateAsync(values)
    } catch (error) {
      const apiError = toApiError(error)
      // 409 EMAIL_TAKEN / USERNAME_TAKEN and 422 come back per field; focus the first one.
      const withErrors = FIELDS.filter((field) => apiError.fieldErrors?.[field]?.[0])
      withErrors.forEach((field, index) =>
        setError(field, { message: apiError.fieldErrors![field][0] }, { shouldFocus: index === 0 }),
      )
      if (withErrors.length === 0) setFormError('Não foi possível criar a conta agora. Tente novamente.')
      return
    }
    await navigate({ href: safeRedirect(redirect), replace: true })
  })

  const input = AUTH_INPUT_CLASS[variant]
  const prefix = `cadastro-${variant}`
  const label = variant === 'dialog' ? 'Criar conta' : 'Criar perfil'

  return (
    <div className="flex flex-col gap-6">
      <form aria-label="Criar conta" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <AuthField id={`${prefix}-usuario`} label="Nome de usuário" error={errors.username?.message}>
          {(a11y) => (
            <input
              {...a11y}
              {...register('username')}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Nome de usuário"
              className={input}
            />
          )}
        </AuthField>
        <AuthField id={`${prefix}-email`} label="E-mail" error={errors.email?.message}>
          {(a11y) => (
            <input
              {...a11y}
              {...register('email')}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="Digite seu e-mail"
              className={input}
            />
          )}
        </AuthField>
        <AuthField id={`${prefix}-senha`} label="Senha" error={errors.password?.message}>
          {(a11y) => (
            <PasswordInput
              {...a11y}
              {...register('password')}
              autoComplete="new-password"
              placeholder="Senha"
              className={input}
            />
          )}
        </AuthField>
        <AuthField id={`${prefix}-confirmar`} label="Confirmar senha" error={errors.confirmPassword?.message}>
          {(a11y) =>
            // Figma: the dialog's confirmation is a plain field, the mobile page has the eye toggle.
            variant === 'page' ? (
              <PasswordInput
                {...a11y}
                {...register('confirmPassword')}
                autoComplete="new-password"
                placeholder="Confirmar senha"
                className={input}
              />
            ) : (
              <input
                {...a11y}
                {...register('confirmPassword')}
                type="password"
                autoComplete="new-password"
                placeholder="Confirmar senha"
                className={input}
              />
            )
          }
        </AuthField>
        {formError && (
          <p role="alert" className="text-caption-13 text-danger">
            {formError}
          </p>
        )}
        <Button
          type="submit"
          disabled={registerUser.isPending}
          className={cn('mt-4 w-full', variant === 'dialog' ? 'h-11' : 'h-[60px] rounded-xl text-body-lg-18')}
        >
          {registerUser.isPending ? (
            <>
              <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
              Criando conta…
            </>
          ) : (
            label
          )}
        </Button>
      </form>
      <AuthDivider />
      <SocialButtons variant={variant} />
    </div>
  )
}
