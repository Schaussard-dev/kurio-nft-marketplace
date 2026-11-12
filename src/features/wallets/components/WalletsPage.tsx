import { useRouter } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { safeRedirect } from '@/shared/lib/safe-redirect'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useWallets } from '../queries'
import { WalletSection } from './WalletSection'
import { useDocumentTitle } from '@/shared/lib/use-document-title'

/** "Carteiras": primary and secondary wallet management; `redirect` returns to checkout after the first save. */
export function WalletsPage({ redirect }: { redirect?: string }) {
  useDocumentTitle('Carteiras')
  const router = useRouter()
  const { data, isError, isFetching, refetch } = useWallets()
  const hadWallet = Boolean(data?.primary || data?.secondary)

  const afterSave = () => {
    if (redirect && !hadWallet) router.history.push(safeRedirect(redirect))
  }

  return (
    <div className="flex flex-col gap-10">
      <h1 className="sr-only">Carteiras</h1>
      {data ? (
        <>
          <WalletSection slot="primary" wallet={data.primary} onSaved={afterSave} />
          <WalletSection slot="secondary" wallet={data.secondary} onSaved={afterSave} />
        </>
      ) : isError ? (
        <div role="alert" className="flex flex-col items-start gap-4 rounded-lg bg-surface p-6">
          <TriangleAlert aria-hidden className="size-6 text-danger" />
          <p className="text-body-15 font-bold text-foreground">Não foi possível carregar suas carteiras.</p>
          <Button onClick={() => void refetch()} disabled={isFetching}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-sm" />
          ))}
        </div>
      )}
    </div>
  )
}
