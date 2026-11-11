import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { AuthField } from '@/features/auth/components/AuthField'
import { PasswordInput } from '@/features/auth/components/PasswordInput'
import { toApiError } from '@/shared/api/api-error'
import { changePasswordInputSchema, type ChangePasswordInput } from '@/shared/contracts'
import { Button } from '@/shared/ui/button'
import { useChangePassword } from '../queries'
import { PROFILE_INPUT_CLASS } from './profile-styles'

const EMPTY: ChangePasswordInput = { currentPassword: '', newPassword: '', confirmPassword: '' }
const FIELDS = ['currentPassword', 'newPassword'] as const

export function PasswordForm() {
  const change = useChangePassword()
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordInputSchema), defaultValues: EMPTY })

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      // confirmPassword is a client-side check only and never leaves the browser.
      await change.mutateAsync({ currentPassword, newPassword })
    } catch (error) {
      const apiError = toApiError(error)
      const withErrors = FIELDS.filter((field) => apiError.fieldErrors?.[field]?.[0])
      withErrors.forEach((field, index) =>
        setError(field, { message: apiError.fieldErrors![field][0] }, { shouldFocus: index === 0 }),
      )
      if (withErrors.length === 0) toast.error('Não foi possível alterar a senha. Tente novamente.')
      return
    }
    reset(EMPTY)
    toast.success('Senha alterada')
  })

  return (
    <form aria-label="Alterar senha" noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
      <h2 className="text-title-22 font-bold text-foreground">Alterar senha</h2>
      <AuthField id="senha-atual" label="Senha atual" visibleLabel error={errors.currentPassword?.message}>
        {(a11y) => (
          <PasswordInput
            {...a11y}
            {...register('currentPassword')}
            autoComplete="current-password"
            className={PROFILE_INPUT_CLASS}
          />
        )}
      </AuthField>
      <AuthField id="senha-nova" label="Nova senha" visibleLabel error={errors.newPassword?.message}>
        {(a11y) => (
          <PasswordInput
            {...a11y}
            {...register('newPassword')}
            autoComplete="new-password"
            className={PROFILE_INPUT_CLASS}
          />
        )}
      </AuthField>
      <AuthField id="senha-confirmar" label="Confirmar nova senha" visibleLabel error={errors.confirmPassword?.message}>
        {(a11y) => (
          <PasswordInput
            {...a11y}
            {...register('confirmPassword')}
            autoComplete="new-password"
            className={PROFILE_INPUT_CLASS}
          />
        )}
      </AuthField>
      <div>
        <Button type="submit" disabled={change.isPending} className="h-14 rounded-sm px-12">
          {change.isPending ? (
            <>
              <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
              Alterando…
            </>
          ) : (
            'Alterar senha'
          )}
        </Button>
      </div>
    </form>
  )
}
