import { LoaderCircle } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { DialogDescription, DialogTitle } from '@/shared/ui/dialog'

/**
 * Step 4 when the API did not answer in time: the order may exist, so the only way forward is to ask
 * again with the same Idempotency-Key ("Verificar pedido"), which never creates a second order.
 */
export function PendingOrderDialog({
  checking,
  onVerify,
  onClose,
}: {
  /** The automatic resend (or a "Verificar pedido") is in flight. */
  checking: boolean
  onVerify: () => void
  onClose: () => void
}) {
  return (
    <>
      <DialogTitle className="text-title-20 font-bold text-foreground">Confirmando pedido</DialogTitle>
      <DialogDescription className="text-body-lg-17 text-foreground">A confirmação está demorando…</DialogDescription>
      {checking ? (
        <p role="status" className="flex items-center gap-3 text-body-15 text-text-secondary">
          <LoaderCircle aria-hidden className="size-5 animate-spin text-text-accent motion-reduce:animate-none" />
          Verificando se o pedido foi registrado…
        </p>
      ) : (
        <>
          <p role="alert" className="text-body-15 text-text-secondary">
            Ainda não recebemos a confirmação. Verifique o pedido: a verificação nunca cria uma segunda compra.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-12" onClick={onClose}>
              Fechar
            </Button>
            <Button type="button" className="h-12" onClick={onVerify} autoFocus>
              Verificar pedido
            </Button>
          </div>
        </>
      )}
    </>
  )
}
