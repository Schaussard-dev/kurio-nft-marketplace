import { Link } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import { buttonVariants } from '@/shared/ui/button'

/** 404 for an unknown NFT id (route `notFoundComponent`). */
export function NftNotFound() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-start gap-4 py-20">
      <SearchX aria-hidden className="size-10 text-text-accent" />
      <h1 className="text-display-32 text-foreground">NFT não encontrado</h1>
      <p className="text-body-lg-16 leading-6 text-text-secondary">
        Este NFT não existe ou foi removido do mercado. Explore o catálogo para encontrar outras obras.
      </p>
      <Link to="/" hash="catalogo" className={buttonVariants()}>
        Voltar ao catálogo
      </Link>
    </section>
  )
}
