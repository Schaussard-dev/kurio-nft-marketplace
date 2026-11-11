import { Link } from '@tanstack/react-router'
import { ShoppingCart } from 'lucide-react'
import { buttonVariants } from '@/shared/ui/button'

/** Empty cart: explains it and leads back to the catalog. */
export function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg bg-surface px-6 py-16 text-center">
      <ShoppingCart aria-hidden className="size-8 text-text-accent" />
      <h2 id="carrinho-vazio-titulo" tabIndex={-1} className="text-body-lg-18 font-bold text-foreground outline-none">
        Seu carrinho está vazio
      </h2>
      <p className="text-body-14 leading-6 text-text-secondary">Explore o mercado e adicione NFTs para vê-los aqui.</p>
      <Link to="/" hash="catalogo" className={buttonVariants({ variant: 'outline' })}>
        Explorar o mercado
      </Link>
    </div>
  )
}
