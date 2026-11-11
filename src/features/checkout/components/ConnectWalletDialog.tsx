import { CircleAlert, LoaderCircle } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { DialogDescription, DialogTitle } from '@/shared/ui/dialog'

export type ConnectStatus = 'pending' | 'rejected' | 'error'

/** Step 2: the (simulated) wallet asks the collector to approve the connection. */
export function ConnectWalletDialog({
  walletLabel,
  status,
  onRetry,
  onCancel,
}: {
  /** e.g. "Principal via MetaMask" */
  walletLabel: string
  status: ConnectStatus
  onRetry: () => void
  onCancel: () => void
}) {
  return (
    <>
      <DialogTitle className="text-title-20 font-bold text-foreground">Conectar carteira</DialogTitle>
      <DialogDescription className="text-body-15 text-text-secondary">{walletLabel}</DialogDescription>
      {status === 'pending' ? (
        <p role="status" className="flex items-center gap-3 py-4 text-body-lg-17 text-foreground">
          <LoaderCircle aria-hidden className="size-6 animate-spin text-text-accent motion-reduce:animate-none" />
          Aguardando aprovação na carteira…
        </p>
      ) : (
        <>
          <p role="alert" className="flex items-center gap-2 py-2 text-body-lg-17 text-danger">
            <CircleAlert aria-hidden className="size-5 shrink-0" />
            {status === 'rejected' ? 'Conexão recusada na carteira.' : 'Não foi possível conectar a carteira.'}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-12" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="button" className="h-12" onClick={onRetry} autoFocus>
              Tentar novamente
            </Button>
          </div>
        </>
      )}
    </>
  )
}
