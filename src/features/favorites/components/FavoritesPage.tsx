import { Link } from '@tanstack/react-router'
import { HeartOff, TriangleAlert } from 'lucide-react'
import { NftCard } from '@/features/catalog/components/NftCard'
import { NftCardSkeleton } from '@/features/catalog/components/NftCardSkeleton'
import { Button, buttonVariants } from '@/shared/ui/button'
import { useFavoriteToggle, useFavorites } from '../queries'

const GRID = 'grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-10'

/** "Lista de interesse": the signed-in user's favorites (private route). */
export function FavoritesPage() {
  const query = useFavorites()
  const { isFavorite, toggleFavorite } = useFavoriteToggle()
  const { data, isError, isFetching, refetch } = query

  let body
  if (isError && !data) {
    body = (
      <div role="alert" className="flex flex-col items-center gap-4 rounded-lg bg-surface px-6 py-16 text-center">
        <TriangleAlert aria-hidden className="size-8 text-danger" />
        <p className="text-body-lg-18 font-bold text-foreground">Não foi possível carregar seus favoritos.</p>
        <Button onClick={() => void refetch()} disabled={isFetching}>
          Tentar novamente
        </Button>
      </div>
    )
  } else if (data && data.items.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-4 rounded-lg bg-surface px-6 py-16 text-center">
        <HeartOff aria-hidden className="size-8 text-text-accent" />
        <h2 className="text-body-lg-18 font-bold text-foreground">Sua lista de interesse está vazia</h2>
        <p className="text-body-14 leading-6 text-text-secondary">
          Toque no coração de um NFT para guardá-lo aqui e acompanhar o preço.
        </p>
        <Link to="/" hash="catalogo" className={buttonVariants({ variant: 'outline' })}>
          Explorar o mercado
        </Link>
      </div>
    )
  } else {
    body = (
      <>
        <h2 className="mb-6 text-body-15 text-text-secondary">
          {data ? `${data.items.length} ${data.items.length === 1 ? 'NFT salvo' : 'NFTs salvos'}` : 'Carregando…'}
        </h2>
        <ul aria-label="Lista de interesse" aria-busy={!data} className={GRID}>
          {data
            ? data.items.map((nft) => (
                <NftCard
                  key={nft.id}
                  nft={nft}
                  isFavorite={(card) => isFavorite(card.id)}
                  onToggleFavorite={(card) => toggleFavorite(card.id, card)}
                />
              ))
            : Array.from({ length: 3 }, (_, index) => <NftCardSkeleton key={index} />)}
        </ul>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-heading-28 text-foreground">Lista de interesse</h1>
      <div>{body}</div>
    </div>
  )
}
