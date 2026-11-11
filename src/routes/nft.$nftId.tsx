import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ADDED_MESSAGE, useAddToCart, useQuickAddToCart } from '@/features/cart/queries'
import { FavoriteButton } from '@/features/favorites/components/FavoriteButton'
import { DetailTabs } from '@/features/nft/components/DetailTabs'
import { Gallery } from '@/features/nft/components/Gallery'
import { MoreFromCollection } from '@/features/nft/components/MoreFromCollection'
import { NftDetailSkeleton } from '@/features/nft/components/NftDetailSkeleton'
import { MobileBuyBar, NftInfo, type PurchaseProps } from '@/features/nft/components/NftInfo'
import { NftNotFound } from '@/features/nft/components/NftNotFound'
import { nftQueryOptions } from '@/features/nft/queries'
import { clampQuantity, resolveEdition } from '@/features/nft/quantity'
import { toApiError } from '@/shared/api/api-error'
import { Breadcrumbs } from '@/shared/layout/Breadcrumbs'
import { useMediaQuery } from '@/shared/lib/use-media-query'
import { Button, buttonVariants } from '@/shared/ui/button'

interface NftSearch {
  /** Selected edition id; unknown or sold-out ids fall back to the default edition. */
  edition?: string
}

export const Route = createFileRoute('/nft/$nftId')({
  validateSearch: (search: Record<string, unknown>): NftSearch =>
    typeof search.edition === 'string' && search.edition ? { edition: search.edition } : {},
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(nftQueryOptions(params.nftId))
    } catch (error) {
      if (toApiError(error).code === 'NOT_FOUND') throw notFound()
      throw error
    }
  },
  pendingComponent: NftDetailSkeleton,
  notFoundComponent: NftNotFound,
  errorComponent: NftLoadError,
  component: NftDetailPage,
})

function NftLoadError() {
  const router = useRouter()
  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-lg bg-surface px-6 py-16 text-center">
      <TriangleAlert aria-hidden className="size-8 text-danger" />
      <p className="text-body-lg-18 font-bold text-foreground">Não foi possível carregar este NFT.</p>
      <p className="text-body-14 text-text-secondary">Verifique sua conexão e tente novamente.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => void router.invalidate()}>Tentar novamente</Button>
        {/* Below 768px the detail has no app chrome, so the error must offer a way out itself. */}
        <Link to="/" hash="catalogo" className={buttonVariants({ variant: 'outline' })}>
          Voltar ao catálogo
        </Link>
      </div>
    </div>
  )
}

function BackButton() {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const className =
    'inline-flex size-12 items-center justify-center rounded-full border border-border-strong bg-surface text-foreground hover:bg-surface-2'
  if (!canGoBack) {
    return (
      <Link to="/" aria-label="Voltar ao início" className={className}>
        <ChevronLeft aria-hidden className="size-6" />
      </Link>
    )
  }
  return (
    <button type="button" aria-label="Voltar" onClick={() => router.history.back()} className={className}>
      <ChevronLeft aria-hidden className="size-6" />
    </button>
  )
}

function NftDetailPage() {
  const { nftId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: nft } = useSuspenseQuery(nftQueryOptions(nftId))
  const desktop = useMediaQuery('(min-width: 768px)')
  // Requested quantity, reset when another NFT opens in the same route instance ("Mais desta coleção").
  const [requestedState, setRequestedState] = useState({ nftId, value: 1 })
  const requested = requestedState.nftId === nftId ? requestedState.value : 1
  const setRequested = (value: number) => setRequestedState({ nftId, value })

  const edition = resolveEdition(nft.editions, search.edition)
  const quantity = edition ? clampQuantity(requested, edition) : { value: 0, limited: true, max: 0 }

  useEffect(() => {
    const previous = document.title
    document.title = `${nft.name} · Kurio`
    return () => {
      document.title = previous
    }
  }, [nft.name])

  const selectEdition = (editionId: string) => {
    setRequested(1)
    void navigate({ search: { edition: editionId }, replace: true, resetScroll: false })
  }

  const addToCart = useAddToCart()
  const quickAdd = useQuickAddToCart()
  const navigateApp = useNavigate()
  const purchase: PurchaseProps = {
    nft,
    edition,
    quantity,
    onQuantityChange: setRequested,
    adding: addToCart.isPending,
    onAddToCart: (input, { goToCart }) =>
      addToCart.mutate(input, {
        onSuccess: () => (goToCart ? void navigateApp({ to: '/carrinho' }) : toast.success(ADDED_MESSAGE)),
      }),
  }

  return (
    <div className="flex flex-col max-md:pb-48">
      {desktop ? (
        <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: nft.name }]} />
      ) : (
        <div className="flex items-center justify-between">
          <BackButton />
          <FavoriteButton nft={nft} variant="icon" />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-6 md:mt-3 md:grid md:grid-cols-[80px_minmax(0,1fr)] md:gap-x-7 md:gap-y-10 lg:grid-cols-[100px_minmax(0,444px)_minmax(0,1fr)] lg:gap-x-8">
        <Gallery key={nft.id} nft={nft} />
        <div className="max-md:-mx-4 max-md:rounded-t-[32px] max-md:bg-surface max-md:px-6 max-md:pt-8 max-md:pb-6 md:col-span-2 lg:col-span-1">
          <NftInfo variant={desktop ? 'desktop' : 'mobile'} onSelectEdition={selectEdition} {...purchase} />
        </div>
      </div>

      <div className="mt-10 md:mt-20">
        <DetailTabs nft={nft} />
      </div>
      <div className="mt-14 md:mt-20">
        <MoreFromCollection nft={nft} onAddToCart={(card) => void quickAdd(card)} />
      </div>
      {!desktop && <MobileBuyBar {...purchase} />}
    </div>
  )
}
