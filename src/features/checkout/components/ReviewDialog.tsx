import { CircleAlert, LoaderCircle } from 'lucide-react'
import type { Quote } from '@/shared/contracts'
import { formatDiscount, formatEth } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { DialogDescription, DialogTitle } from '@/shared/ui/dialog'

/**
 * Step 3: the quote being confirmed (frozen when the review opened). "Enviar pedido" stays focusable
 * but aria-disabled while the order is in flight, so repeated clicks or Enter key repeats send nothing.
 */
export function ReviewDialog({
  quote,
  names,
  walletLabel,
  connectorLabel,
  networkLabel,
  submitting,
  error,
  onSend,
  onBack,
}: {
  quote: Quote
  /** NFT names by line id. */
  names: Record<string, string>
  walletLabel: string
  connectorLabel: string
  networkLabel: string
  submitting: boolean
  error?: string
  onSend: () => void
  onBack: () => void
}) {
  return (
    <>
      <DialogTitle className="text-title-20 font-bold text-foreground">Revise seu pedido</DialogTitle>
      <DialogDescription className="text-body-15 text-text-secondary">
        Pagamento com {walletLabel} via {connectorLabel} · Rede {networkLabel}
      </DialogDescription>
      <ul aria-label="Itens do pedido" className="flex flex-col gap-2 border-y border-border-strong py-3">
        {quote.lines.map((line) => (
          <li key={line.lineId} className="flex items-baseline justify-between gap-3 text-body-15 text-foreground">
            <span className="min-w-0 truncate">
              {names[line.lineId] ?? line.nftId} <span className="text-text-secondary">(x {line.quantity})</span>
            </span>
            <span className="font-bold whitespace-nowrap">{formatEth(line.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-2 text-body-15 text-foreground">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{formatEth(quote.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Desconto do lançamento</dt>
          <dd>{formatDiscount(quote.discount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Taxa de rede</dt>
          <dd>{formatEth(quote.networkFee)}</dd>
        </div>
        <div className="flex justify-between text-title-20 font-bold">
          <dt>Total</dt>
          <dd data-testid="review-total" className="text-text-accent">
            {formatEth(quote.total)}
          </dd>
        </div>
      </dl>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-body-15 text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      {submitting && (
        <p role="status" className="flex items-center gap-2 text-body-15 text-text-secondary">
          <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          Enviando pedido…
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-12" onClick={onBack} disabled={submitting}>
          Voltar
        </Button>
        <Button
          type="button"
          className="h-12 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
          aria-disabled={submitting || undefined}
          onClick={() => {
            if (!submitting) onSend()
          }}
          autoFocus
        >
          Enviar pedido
        </Button>
      </div>
    </>
  )
}
