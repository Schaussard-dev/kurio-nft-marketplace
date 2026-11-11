import { useState } from 'react'
import type { Wallet } from '@/shared/contracts'
import { Checkbox } from '@/shared/ui/checkbox'
import type { WalletSlot } from '../api'
import { WalletForm } from './WalletForm'

const COPY: Record<WalletSlot, { title: string; empty: string }> = {
  primary: {
    title: 'Carteira principal',
    empty: 'Você ainda não adicionou uma carteira principal.',
  },
  secondary: {
    title: 'Carteira secundária',
    empty: 'Você ainda não adicionou uma carteira secundária.',
  },
}

const ADD_BUTTON = 'text-title-18 font-bold text-text-accent underline-offset-4 hover:underline'

/** One wallet slot: empty state with "Adicionar", or the form (prefilled when the slot is already filled). */
export function WalletSection({
  slot,
  wallet,
  onSaved,
}: {
  slot: WalletSlot
  wallet: Wallet | null
  onSaved?: (wallet: Wallet) => void
}) {
  const [open, setOpen] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(wallet?.sameAsPrimary ?? false)
  // Follow the server when it flips the flag (the checkbox is otherwise the user's own choice).
  const [syncedFlag, setSyncedFlag] = useState(wallet?.sameAsPrimary)
  if (syncedFlag !== wallet?.sameAsPrimary) {
    setSyncedFlag(wallet?.sameAsPrimary)
    setSameAsPrimary(wallet?.sameAsPrimary ?? false)
  }
  const headingId = `carteira-${slot}-titulo`
  const checkboxId = `carteira-${slot}-igual`
  const showForm = Boolean(wallet) || open

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="text-title-22 font-bold text-foreground">
            {COPY[slot].title}
          </h2>
          {slot === 'primary' && (
            <p className="text-body-15 text-text-accent">
              Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {slot === 'secondary' && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={checkboxId}
                checked={sameAsPrimary}
                onCheckedChange={(checked) => setSameAsPrimary(checked === true)}
                className="size-5 rounded-full"
              />
              <label htmlFor={checkboxId} className="text-body-15 text-foreground">
                Igual à carteira principal
              </label>
            </div>
          )}
          {!showForm && (
            <button type="button" onClick={() => setOpen(true)} className={ADD_BUTTON}>
              Adicionar
            </button>
          )}
        </div>
      </header>
      {showForm ? (
        <WalletForm
          slot={slot}
          wallet={wallet}
          sameAsPrimary={slot === 'secondary' && sameAsPrimary}
          onSaved={onSaved}
        />
      ) : (
        <p className="text-body-15 text-text-accent">{COPY[slot].empty}</p>
      )}
    </section>
  )
}
