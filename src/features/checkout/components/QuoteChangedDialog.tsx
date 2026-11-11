import type { Quote } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { changedLines } from '../form'


/**
 * Step 5: POST /orders answered QUOTE_STALE. The collector sees what changed and must confirm the new
 * value explicitly; confirming re-opens the review with the new quote.
 */
export function QuoteChangedDialog({
  previous,
  next,
  names,
  onConfirm,
  onCancel,
}: {
  previous: Quote
  next: Quote
  names: Record<string, string>
  onConfirm: () => void
  onCancel: () => void
}) {
  const changes = changedLines(previous, next, names)
  return (
    <>
      <DialogTitle className="text-title-20 font-bold text-foreground">O valor do pedido mudou</DialogTitle>
      <DialogDescription className="text-body-15 text-text-secondary">
        Os valores foram atualizados desde a revisão. Confira e confirme o novo valor para continuar.
      </DialogDescription>
      <table className="w-full text-left text-body-15 text-foreground">
        <caption className="sr-only">Alterações de preço por item</caption>
        <thead className="text-caption-13 text-text-secondary">
          <tr>
            <th scope="col" className="pb-2 font-normal">
              NFT
            </th>
            <th scope="col" className="pb-2 text-right font-normal">
              Antes
            </th>
            <th scope="col" className="pb-2 text-right font-normal">
              Agora
            </th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.lineId} className="border-t border-border-strong">
              <th scope="row" className="py-2 pr-2 font-normal">
                {change.name}
              </th>
              <td className="py-2 text-right whitespace-nowrap text-text-secondary">
                {change.before ? formatEth(change.before) : 'Novo item'}
              </td>
              <td className="py-2 text-right font-bold whitespace-nowrap">
                {change.after ? formatEth(change.after) : 'Removido'}
              </td>
            </tr>
          ))}
          <tr className="border-t border-border-strong text-title-20 font-bold">
            <th scope="row" className="py-2">
              Total
            </th>
            <td data-testid="stale-old-total" className="py-2 text-right whitespace-nowrap text-text-secondary line-through">
              {formatEth(previous.total)}
            </td>
            <td data-testid="stale-new-total" className="py-2 text-right whitespace-nowrap text-text-accent">
              {formatEth(next.total)}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-12" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" className="h-12" onClick={onConfirm} autoFocus>
          Confirmar novo valor
        </Button>
      </div>
    </>
  )
}
