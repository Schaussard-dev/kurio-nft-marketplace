import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { AuthField } from '@/features/auth/components/AuthField'
import { PROFILE_INPUT_CLASS } from '@/features/profile/components/profile-styles'
import { toApiError } from '@/shared/api/api-error'
import {
  WALLET_ADDRESS_ERROR,
  WALLET_ENS_REQUIRED_ERROR,
  WALLET_SECONDARY_ERROR,
  emailSchema,
  isValidSecondaryWallet,
  isValidWalletAddress,
  networkSchema,
  type Wallet,
  type WalletInput,
} from '@/shared/contracts'
import { ENS_LABEL_ERROR, ENS_LABEL_PATTERN, toFormEns, toStoredEns } from '@/shared/lib/ens'
import { Button } from '@/shared/ui/button'
import { useAnnounce } from '@/shared/ui/LiveRegion'
import type { WalletSlot } from '../api'
import { useSaveWallet } from '../queries'
import { EnsField } from './EnsField'
import { NetworkSelect } from './NetworkSelect'
import { WalletTypeSelect } from './WalletTypeSelect'

const REQUIRED = 'Campo obrigatório'
const required = z.string().trim().min(1, REQUIRED)

// "Rede" and "Tipo de carteira" start on the empty placeholder option, so an unchosen value reads as missing.
const formSchema = z
  .object({
    displayName: required,
    nickname: required,
    network: z.enum(networkSchema.options, { error: 'Selecione uma rede' }),
    profileName: required,
    address: required,
    secondaryAddress: z.string().trim(),
    walletType: z.enum(['metamask', 'walletconnect', 'coinbase'], {
      error: 'Selecione uma carteira',
    }),
    referralCode: required,
    email: z.string().trim().min(1, REQUIRED).pipe(emailSchema),
    ensName: z.string().trim().regex(ENS_LABEL_PATTERN, ENS_LABEL_ERROR),
  })
  .superRefine((value, ctx) => {
    if (!value.network) return
    if (value.address && !isValidWalletAddress(value.network, value.address)) {
      ctx.addIssue({ code: 'custom', path: ['address'], message: WALLET_ADDRESS_ERROR })
    }
    if (value.secondaryAddress && !isValidSecondaryWallet(value.network, value.secondaryAddress)) {
      ctx.addIssue({ code: 'custom', path: ['secondaryAddress'], message: WALLET_SECONDARY_ERROR })
    }
    // Spec: the ENS name is optional outside Ethereum.
    if (value.network === 'ethereum' && !value.ensName) {
      ctx.addIssue({ code: 'custom', path: ['ensName'], message: WALLET_ENS_REQUIRED_ERROR })
    }
  })
type FormValues = z.infer<typeof formSchema>

// DOM order (left column first within each row), which is also the focus order for the first error.
const FIELDS = [
  'displayName',
  'nickname',
  'network',
  'profileName',
  'address',
  'secondaryAddress',
  'walletType',
  'referralCode',
  'email',
  'ensName',
] as const satisfies (keyof FormValues)[]

const SECTION_LABEL: Record<WalletSlot, string> = {
  primary: 'Carteira principal',
  secondary: 'Carteira secundária',
}

function toFormValues(wallet: Wallet | null): Partial<FormValues> {
  if (!wallet) return {}
  return {
    displayName: wallet.displayName,
    nickname: wallet.nickname,
    network: wallet.network,
    profileName: wallet.profileName,
    address: wallet.address,
    secondaryAddress: wallet.secondaryAddress ?? '',
    walletType: wallet.walletType,
    referralCode: wallet.referralCode,
    email: wallet.email,
    ensName: toFormEns(wallet.ensName),
  }
}

export function WalletForm({
  slot,
  wallet,
  sameAsPrimary = false,
  onSaved,
}: {
  slot: WalletSlot
  wallet: Wallet | null
  /** Secondary only: "Igual à carteira principal" is checked, so the server copies the primary wallet. */
  sameAsPrimary?: boolean
  onSaved?: (wallet: Wallet) => void
}) {
  const save = useSaveWallet()
  const announce = useAnnounce()
  const [sameError, setSameError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    reset,
    trigger,
    getValues,
    getFieldState,
    control,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(wallet),
    // Registration order differs from the DOM order (some fields register eagerly), so focus is set by hand.
    shouldFocusError: false,
  })
  const network = useWatch({ control, name: 'network' })

  // An untouched form follows the server data (e.g. a same-as-primary secondary after the primary changed).
  useEffect(() => {
    if (!isDirty) reset(toFormValues(wallet))
  }, [wallet, isDirty, reset])

  const id = (name: string) => `carteira-${slot}-${name}`

  async function persist(input: WalletInput | { sameAsPrimary: true }) {
    setSameError(null)
    try {
      const saved = await save.mutateAsync({ slot, input })
      reset(toFormValues(saved))
      toast.success('Carteira salva')
      onSaved?.(saved)
    } catch (error) {
      const apiError = toApiError(error)
      const withErrors = FIELDS.filter((field) => apiError.fieldErrors?.[field]?.[0])
      withErrors.forEach((field, index) =>
        setError(field, { message: apiError.fieldErrors![field][0] }, { shouldFocus: index === 0 }),
      )
      const same = apiError.fieldErrors?.sameAsPrimary?.[0]
      if (same) setSameError(same)
      if (withErrors.length > 0 || same) announce('Verifique os campos destacados', 'assertive')
      else toast.error('Não foi possível salvar a carteira. Tente novamente.')
    }
  }

  const onValid = handleSubmit(
    (values) =>
      persist({
        ...values,
        ensName: toStoredEns(values.ensName),
        sameAsPrimary: false,
      }),
    (invalid) => {
      const first = FIELDS.find((field) => invalid[field])
      if (first) setFocus(first)
      announce('Verifique os campos destacados', 'assertive')
    },
  )

  // Network-specific address rules: changing the network re-checks the address fields that hold a value.
  const revalidateAddresses = () => {
    const fields: ('address' | 'secondaryAddress' | 'ensName')[] = (['address', 'secondaryAddress'] as const).filter(
      (field) => getValues(field),
    )
    if (getFieldState('ensName').error) fields.push('ensName')
    if (fields.length > 0) void trigger(fields)
  }

  const submitting = save.isPending

  return (
    <form
      aria-label={SECTION_LABEL[slot]}
      noValidate
      onSubmit={sameAsPrimary ? (event) => (event.preventDefault(), void persist({ sameAsPrimary: true })) : onValid}
      className="grid gap-x-10 gap-y-6 md:grid-cols-2"
    >
      {sameAsPrimary ? (
        <div className="flex flex-col gap-3 md:col-span-2">
          <p className="text-body-15 text-text-secondary">
            Os dados da carteira principal serão copiados para a carteira secundária.
          </p>
          {sameError && (
            <p role="alert" className="text-caption-12 text-danger">
              {sameError}
            </p>
          )}
        </div>
      ) : (
        <>
          <AuthField id={id('nome')} label="Nome de exibição" visibleLabel error={errors.displayName?.message}>
            {(a11y) => (
              <input {...a11y} {...register('displayName')} autoComplete="name" className={PROFILE_INPUT_CLASS} />
            )}
          </AuthField>
          <AuthField id={id('apelido')} label="Apelido da carteira" visibleLabel error={errors.nickname?.message}>
            {(a11y) => <input {...a11y} {...register('nickname')} className={PROFILE_INPUT_CLASS} />}
          </AuthField>
          <NetworkSelect
            id={id('rede')}
            error={errors.network?.message}
            registration={register('network', {
              onChange: revalidateAddresses,
            })}
          />
          <AuthField id={id('perfil')} label="Nome do perfil" visibleLabel error={errors.profileName?.message}>
            {(a11y) => (
              <input {...a11y} {...register('profileName')} autoCapitalize="none" className={PROFILE_INPUT_CLASS} />
            )}
          </AuthField>
          <AuthField id={id('endereco')} label="Endereço da carteira" visibleLabel error={errors.address?.message}>
            {(a11y) => (
              <input
                {...a11y}
                {...register('address')}
                placeholder={network === 'solana' ? 'Endereço Solana da carteira' : 'Endereço 0x da carteira'}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                className={PROFILE_INPUT_CLASS}
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
                  placeholder="ENS ou carteira secundária (opcional)"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  className={PROFILE_INPUT_CLASS}
                />
              )}
            </AuthField>
          </div>
          <WalletTypeSelect id={id('tipo')} error={errors.walletType?.message} registration={register('walletType')} />
          <AuthField id={id('indicacao')} label="Código de indicação" visibleLabel error={errors.referralCode?.message}>
            {(a11y) => (
              <input {...a11y} {...register('referralCode')} autoCapitalize="none" className={PROFILE_INPUT_CLASS} />
            )}
          </AuthField>
          <AuthField id={id('email')} label="E-mail" visibleLabel error={errors.email?.message}>
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
          <EnsField
            id={id('ens')}
            required={network === 'ethereum'}
            error={errors.ensName?.message}
            registration={register('ensName')}
          />
        </>
      )}
      <div className="md:col-span-2">
        <Button type="submit" disabled={submitting} className="h-10 rounded-[3px] px-8 text-body-14">
          {submitting ? (
            <>
              <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
              Salvando…
            </>
          ) : (
            'Salvar carteira'
          )}
        </Button>
      </div>
    </form>
  )
}
