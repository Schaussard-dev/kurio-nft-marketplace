import { CircleAlert, WalletMinimal } from 'lucide-react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { cn } from '@/shared/lib/utils'
import { CONNECTORS } from '../draft'
import { CONNECTOR_LABELS } from '../form'

// Mobile frame order: WalletConnect, MetaMask, Coinbase Wallet.
const ORDER = ['walletconnect', 'metamask', 'coinbase'] as const satisfies readonly (typeof CONNECTORS)[number][]

const RADIO =
  'size-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-primary/70 bg-transparent transition-colors checked:border-primary checked:bg-[radial-gradient(circle,var(--color-primary)_0_40%,transparent_45%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/** "Carteira e rede": the wallet app that approves the connection (MetaMask, WalletConnect, Coinbase Wallet). */
export function ConnectorPicker({
  registration,
  titleId,
  error,
  variant,
}: {
  registration: UseFormRegisterReturn
  titleId: string
  error?: string
  variant: 'cards' | 'rows'
}) {
  const cards = variant === 'cards'
  const errorId = `${titleId}-erro`
  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-labelledby={titleId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        aria-required
        data-field="connector"
        className={cn('flex flex-col', cards ? 'gap-4' : 'gap-5')}
      >
        {ORDER.map((connector) => (
          <label
            key={connector}
            className={cn(
              'flex cursor-pointer items-center transition-colors',
              cards
                ? 'flex-row-reverse justify-end gap-4 rounded-[20px] bg-surface px-4 py-3 [&>input]:ml-auto'
                : 'h-14 gap-5 rounded-xs border border-border-strong px-5 has-[:checked]:border-primary',
            )}
          >
            <input type="radio" value={connector} {...registration} className={RADIO} />
            <span className={cn('text-foreground', cards ? 'text-body-14' : 'text-body-15')}>{CONNECTOR_LABELS[connector]}</span>
            {cards && (
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-2 text-body-14 font-bold text-text-accent"
              >
                {connector === 'coinbase' ? <WalletMinimal className="size-5" /> : CONNECTOR_LABELS[connector][0]}
              </span>
            )}
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-caption-12 text-danger">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
