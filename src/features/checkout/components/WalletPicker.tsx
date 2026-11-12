import { Link } from '@tanstack/react-router'
import { WalletMinimal } from 'lucide-react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import type { Wallet } from '@/shared/contracts'
import { cn } from '@/shared/lib/utils'
import { MANUAL_WALLET } from '../draft'
import { networkCaption, shortAddress, walletTitle } from '../form'


const RADIO =
  'size-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-primary/70 bg-transparent transition-colors checked:border-primary checked:bg-[radial-gradient(circle,var(--color-primary)_0_40%,transparent_45%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/**
 * "Carteira de pagamento": registered wallets (Reserva / Principal cards on mobile, compact rows on
 * desktop) plus "Usar outra carteira?" for manual entry. Native radios: arrow keys and labels for free.
 * No wallet registered: the empty state of spec §9 with "Cadastrar carteira".
 */
export function WalletPicker({
  wallets,
  registration,
  manageHref,
  variant,
  titleId,
}: {
  wallets: Wallet[]
  registration: UseFormRegisterReturn
  /** /perfil/carteiras?redirect=<this checkout> */
  manageHref: { to: '/perfil/carteiras'; search: { redirect: string } }
  variant: 'cards' | 'rows'
  /** Id of the visible heading that names the group. */
  titleId?: string
}) {
  const cards = variant === 'cards'
  const option = cn(
    'flex cursor-pointer items-center gap-5 transition-colors has-[:checked]:border-primary',
    cards ? 'rounded-[20px] bg-surface px-5 py-4' : 'rounded-xs border border-border-strong px-4 py-3',
  )
  return (
    <div
      role="radiogroup"
      aria-label={titleId ? undefined : 'Carteira de pagamento'}
      aria-labelledby={titleId}
      data-field="walletChoice"
      className={cn('flex flex-col', cards ? 'gap-6' : 'gap-3')}
    >
      {wallets.length === 0 && (
        <div className="flex flex-col items-start gap-2 rounded-sm border border-dashed border-border-strong px-5 py-4">
          <p className="flex items-center gap-2 text-body-15 font-bold text-foreground">
            <WalletMinimal aria-hidden className="size-5 text-text-accent" />
            Nenhuma carteira cadastrada
          </p>
          <Link {...manageHref} className="text-body-15 text-text-accent underline underline-offset-4">
            Cadastrar carteira
          </Link>
        </div>
      )}
      {wallets.map((wallet) => (
        <label key={wallet.id} className={option}>
          <input type="radio" value={wallet.id} {...registration} className={RADIO} />
          <span className="flex min-w-0 flex-col gap-1">
            <span className={cn('font-bold text-foreground', cards ? 'text-body-lg-16' : 'text-body-15')}>
              {walletTitle(wallet)}
            </span>
            <span className={cn('truncate text-text-secondary', cards ? 'text-body-15' : 'text-caption-13')}>
              {wallet.ensName || shortAddress(wallet.address)}
            </span>
            <span className={cn('text-text-secondary', cards ? 'text-body-15' : 'text-caption-13')}>
              {networkCaption(wallet.network)}
            </span>
          </span>
        </label>
      ))}
      <label className={cn(cards ? option : 'flex cursor-pointer items-center gap-3 py-1')}>
        <input type="radio" value={MANUAL_WALLET} {...registration} className={RADIO} />
        <span className={cn('text-foreground', cards ? 'text-body-15 font-bold' : 'text-body-15')}>
          Usar outra carteira?
        </span>
      </label>
    </div>
  )
}
