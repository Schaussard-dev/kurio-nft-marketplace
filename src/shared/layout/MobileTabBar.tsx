import { Link, useRouterState } from '@tanstack/react-router'
import { Heart, House, ScanLine, ShoppingCart, User } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const TAB =
  'relative flex size-12 items-center justify-center justify-self-center rounded-full text-text-secondary transition-colors hover:text-text-accent'

/** Mobile bottom bar (Figma Mobile/Início): four tabs and a raised central scan button. */
export function MobileTabBar({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const homeActive = pathname === '/'
  const favoritesActive = pathname === '/perfil/favoritos'
  const cartActive = pathname === '/carrinho'
  const profileActive = pathname.startsWith('/perfil') && !favoritesActive
  // Active = accent color plus a dot under the icon: never color (or the Figma fills) alone (spec §10).
  const on = "text-text-accent after:absolute after:bottom-0.5 after:size-1.5 after:rounded-full after:bg-current after:content-['']"

  return (
    <nav aria-label="Navegação móvel" className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="relative mx-auto grid h-20 max-w-md grid-cols-5 items-center rounded-t-[32px] border-t border-border-strong bg-surface px-3 pb-[env(safe-area-inset-bottom)]">
        <Link to="/" aria-label="Início" aria-current={homeActive ? 'page' : undefined} className={cn(TAB, homeActive && on)}>
          <House className="size-6" fill={homeActive ? 'currentColor' : 'none'} aria-hidden />
        </Link>
        <Link
          to="/perfil/favoritos"
          aria-label="Favoritos"
          aria-current={favoritesActive ? 'page' : undefined}
          className={cn(TAB, favoritesActive && on)}
        >
          <Heart className="size-6" fill="currentColor" aria-hidden />
        </Link>
        <Link
          to="/em-breve"
          search={{ secao: 'scanner' }}
          aria-label="Escanear"
          className="relative -top-7 flex size-16 items-center justify-center justify-self-center rounded-full bg-gradient-to-b from-primary-light to-primary-dark text-ink ring-[6px] ring-ink"
        >
          <ScanLine className="size-7" aria-hidden />
        </Link>
        <Link
          to="/carrinho"
          aria-label={cartCount > 0 ? `Carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}` : 'Carrinho'}
          aria-current={cartActive ? 'page' : undefined}
          className={cn(TAB, cartActive && on)}
        >
          <ShoppingCart className="size-6" aria-hidden />
          {cartCount > 0 && (
            <span
              aria-hidden
              className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-tiny-9 font-bold text-ink"
            >
              {cartCount}
            </span>
          )}
        </Link>
        <Link to="/perfil" aria-label="Perfil" aria-current={profileActive ? 'page' : undefined} className={cn(TAB, profileActive && on)}>
          <User className="size-6" fill="currentColor" aria-hidden />
        </Link>
      </div>
    </nav>
  )
}
