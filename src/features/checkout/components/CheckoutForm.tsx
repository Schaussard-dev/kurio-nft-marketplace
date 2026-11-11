import { ChevronDown } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'
import { AuthField } from '@/features/auth/components/AuthField'
import { PROFILE_INPUT_CLASS } from '@/features/profile/components/profile-styles'
import { EnsField } from '@/features/wallets/components/EnsField'
import { NetworkSelect } from '@/features/wallets/components/NetworkSelect'
import type { Network } from '@/shared/contracts'
import { cn } from '@/shared/lib/utils'
import { CONNECTORS } from '../draft'
import { CONNECTOR_LABELS, NETWORK_LABELS, NOTE_MAX, type CheckoutFormValues } from '../form'

const CONNECTOR_OPTIONS = CONNECTORS.map((value) => ({ value, label: CONNECTOR_LABELS[value] }))

/**
 * "Perfil do colecionador" fields (Desktop/Pagamento). While a registered wallet is selected, its
 * network and address are shown read-only: the order must pay from the wallet that was approved.
 */
export function CheckoutForm({
  form,
  locked,
  onNetworkChange,
  children,
}: {
  form: UseFormReturn<CheckoutFormValues>
  locked: boolean
  /** Network-specific rules: re-check the address fields when the network changes. */
  onNetworkChange: () => void
  /** Wallet choice ("Usar outra carteira?") rendered between the fields and the note, as in Figma. */
  children?: React.ReactNode
}) {
  const {
    register,
    watch,
    setValue,
    formState: { errors, isSubmitted },
  } = form
  const network = watch('network')
  const connector = watch('connector')
  const id = (name: string) => `pagamento-${name}`

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
        <AuthField id={id('nome')} label="Nome de exibição" visibleLabel error={errors.displayName?.message}>
          {(a11y) => (
            <input {...a11y} {...register('displayName')} data-field="displayName" autoComplete="name" className={PROFILE_INPUT_CLASS} />
          )}
        </AuthField>
        <AuthField id={id('usuario')} label="Nome de usuário" visibleLabel error={errors.username?.message}>
          {(a11y) => (
            <input
              {...a11y}
              {...register('username')}
              data-field="username"
              autoCapitalize="none"
              autoComplete="username"
              className={PROFILE_INPUT_CLASS}
            />
          )}
        </AuthField>
        {locked ? (
          <AuthField id={id('rede')} label="Rede" visibleLabel>
            {(a11y) => (
              <input
                {...a11y}
                data-field="network"
                readOnly
                value={network ? NETWORK_LABELS[network as Network] : ''}
                className={cn(PROFILE_INPUT_CLASS, 'text-text-secondary')}
              />
            )}
          </AuthField>
        ) : (
          <div data-field-wrap="network" className="contents">
            <NetworkSelect
              id={id('rede')}
              error={errors.network?.message}
              registration={register('network', { onChange: onNetworkChange })}
            />
          </div>
        )}
        <AuthField id={id('perfil')} label="Nome do perfil" visibleLabel error={errors.profileName?.message}>
          {(a11y) => (
            <input {...a11y} {...register('profileName')} data-field="profileName" autoCapitalize="none" className={PROFILE_INPUT_CLASS} />
          )}
        </AuthField>
        <AuthField id={id('endereco')} label="Endereço da carteira" visibleLabel error={errors.walletAddress?.message}>
          {(a11y) => (
            <input
              {...a11y}
              {...register('walletAddress')}
              data-field="walletAddress"
              readOnly={locked}
              placeholder={network === 'solana' ? 'Endereço Solana da carteira' : 'Endereço 0x da carteira'}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              className={cn(PROFILE_INPUT_CLASS, locked && 'text-text-secondary')}
            />
          )}
        </AuthField>
        <div className="md:self-end">
          <AuthField
            id={id('secundaria')}
            label="ENS ou carteira secundária (opcional)"
            required={false}
            error={errors.secondaryAddress?.message}
          >
            {(a11y) => (
              <input
                {...a11y}
                {...register('secondaryAddress')}
                data-field="secondaryAddress"
                placeholder="ENS ou carteira secundária (opcional)"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                className={PROFILE_INPUT_CLASS}
              />
            )}
          </AuthField>
        </div>
        {/* Same value as the "Carteira e rede" radios (registered there), so this select is controlled. */}
        <AuthField id={id('tipo')} label="Tipo de carteira" visibleLabel error={errors.connector?.message}>
          {(a11y) => (
            <div className="relative">
              <select
                {...a11y}
                value={connector}
                onChange={(event) =>
                  setValue('connector', event.target.value as CheckoutFormValues['connector'], {
                    shouldDirty: true,
                    shouldValidate: isSubmitted,
                  })
                }
                className={cn(PROFILE_INPUT_CLASS, 'appearance-none pr-10')}
              >
                <option value="">Selecione uma carteira</option>
                {CONNECTOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2" aria-hidden />
            </div>
          )}
        </AuthField>
        <AuthField id={id('indicacao')} label="Código de indicação" visibleLabel error={errors.referralCode?.message}>
          {(a11y) => (
            <input {...a11y} {...register('referralCode')} data-field="referralCode" autoCapitalize="none" className={PROFILE_INPUT_CLASS} />
          )}
        </AuthField>
        <AuthField id={id('email')} label="E-mail" visibleLabel error={errors.email?.message}>
          {(a11y) => (
            <input
              {...a11y}
              {...register('email')}
              data-field="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              className={PROFILE_INPUT_CLASS}
            />
          )}
        </AuthField>
        <EnsField
          id={id('ens')}
          required={network === 'ethereum'}
          error={errors.ensName?.message}
          registration={register('ensName')}
        />
      </div>
      {children}
      <AuthField
        id={id('observacao')}
        label="Observação do colecionador (opcional)"
        visibleLabel
        required={false}
        error={errors.note?.message}
      >
        {(a11y) => (
          <textarea
            {...a11y}
            {...register('note')}
            data-field="note"
            rows={5}
            maxLength={NOTE_MAX}
            className={cn(PROFILE_INPUT_CLASS, 'h-auto min-h-44 resize-y py-3 md:max-w-[422px]')}
          />
        )}
      </AuthField>
    </div>
  )
}
