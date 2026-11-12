import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, LoaderCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { AuthField } from '@/features/auth/components/AuthField'
import { toApiError } from '@/shared/api/api-error'
import { updateProfileInputSchema, type Profile, type UpdateProfileInput } from '@/shared/contracts'
import { ENS_LABEL_ERROR, ENS_LABEL_PATTERN, ENS_SUFFIX, toFormEns, toStoredEns } from '@/shared/lib/ens'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useUpdateProfile } from '../queries'
import { AvatarField } from './AvatarField'
import { PROFILE_INPUT_CLASS } from './profile-styles'

const FIELDS = ['displayName', 'username', 'email'] as const satisfies (keyof UpdateProfileInput)[]

// The field holds the name without the suffix, so it is validated before the suffix is added.
const formSchema = updateProfileInputSchema.extend({
  ensName: z.string().regex(ENS_LABEL_PATTERN, ENS_LABEL_ERROR),
})

function toFormValues(profile: Profile): UpdateProfileInput {
  return {
    displayName: profile.displayName,
    username: profile.username,
    email: profile.email,
    walletNickname: profile.walletNickname,
    ensName: toFormEns(profile.ensName),
  }
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(profile),
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync({ ...values, ensName: toStoredEns(values.ensName) })
      reset(toFormValues(saved))
      toast.success('Perfil atualizado')
    } catch (error) {
      const apiError = toApiError(error)
      const withErrors = FIELDS.filter((field) => apiError.fieldErrors?.[field]?.[0])
      withErrors.forEach((field, index) =>
        setError(field, { message: apiError.fieldErrors![field][0] }, { shouldFocus: index === 0 }),
      )
      if (withErrors.length === 0) toast.error('Não foi possível salvar o perfil. Tente novamente.')
    }
  })

  return (
    <form aria-label="Dados do perfil" noValidate onSubmit={onSubmit} className="grid gap-x-10 gap-y-6 md:grid-cols-2">
      <AuthField id="perfil-nome" label="Nome de exibição" visibleLabel error={errors.displayName?.message}>
        {(a11y) => <input {...a11y} {...register('displayName')} autoComplete="name" className={PROFILE_INPUT_CLASS} />}
      </AuthField>
      <AuthField id="perfil-usuario" label="Nome de usuário" visibleLabel error={errors.username?.message}>
        {(a11y) => (
          <input
            {...a11y}
            {...register('username')}
            autoComplete="username"
            autoCapitalize="none"
            className={PROFILE_INPUT_CLASS}
          />
        )}
      </AuthField>
      <AuthField id="perfil-email" label="E-mail" visibleLabel error={errors.email?.message}>
        {(a11y) => (
          <input
            {...a11y}
            {...register('email')}
            type="email"
            autoComplete="email"
            inputMode="email"
            className={PROFILE_INPUT_CLASS}
          />
        )}
      </AuthField>
      <AuthField id="perfil-ens" label="Nome ENS" visibleLabel required={false} error={errors.ensName?.message}>
        {(a11y) => (
          <div className="flex gap-3">
            <div className="relative">
              <select
                aria-label="Domínio ENS"
                className={cn(PROFILE_INPUT_CLASS, 'w-28 appearance-none pr-9')}
                defaultValue={ENS_SUFFIX}
              >
                <option value={ENS_SUFFIX}>{ENS_SUFFIX}</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
                aria-hidden
              />
            </div>
            <input {...a11y} {...register('ensName')} autoCapitalize="none" className={PROFILE_INPUT_CLASS} />
          </div>
        )}
      </AuthField>
      <AuthField
        id="perfil-apelido"
        label="Apelido da carteira"
        visibleLabel
        required={false}
        error={errors.walletNickname?.message}
      >
        {(a11y) => <input {...a11y} {...register('walletNickname')} className={PROFILE_INPUT_CLASS} />}
      </AuthField>
      <AvatarField displayName={profile.displayName} avatarUrl={profile.avatarUrl} />
      <div className="md:col-span-2">
        <Button type="submit" disabled={update.isPending} className="h-10 rounded-[3px] px-12 text-body-14">
          {update.isPending ? (
            <>
              <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
              Salvando…
            </>
          ) : (
            'Salvar'
          )}
        </Button>
      </div>
    </form>
  )
}
