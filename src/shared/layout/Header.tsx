import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { DropdownMenu } from 'radix-ui'
import { LogIn, Search, ShoppingCart } from 'lucide-react'
import { useLogout, useSession } from '@/features/auth/queries'
import { ConnectionStatus } from '@/features/realtime/ConnectionStatus'
import { cn } from '@/shared/lib/utils'
import { buttonVariants } from '@/shared/ui/button'

const MARKET_PREFIXES = ['/nft', '/carrinho', '/pagamento']

const NAV_LINK = 'relative inline-flex h-full items-center px-1 text-body-lg-16 transition-colors hover:text-text-accent'
const NAV_ACTIVE =
  "font-bold text-text-accent after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary after:content-['']"

export interface HeaderProps {
  /** Number of items in the cart; 0 or undefined renders no badge. Wired by the cart feature. */
  cartCount?: number
}

function isMarketPath(pathname: string) {
  return MARKET_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function CartLink({ count }: { count: number }) {
  const label = count > 0 ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho'
  return (
    <Link
      to="/carrinho"
      aria-label={label}
      className="relative inline-flex size-10 items-center justify-center rounded-md text-foreground hover:text-text-accent"
    >
      <ShoppingCart className="size-6" aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute top-0.5 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-tiny-9 font-bold text-ink"
        >
          {count}
        </span>
      )}
    </Link>
  )
}

function SearchButton() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      aria-label="Buscar"
      className="inline-flex size-10 items-center justify-center rounded-md text-foreground hover:text-text-accent"
      onClick={() => {
        const field = document.getElementById('catalogo-busca')
        if (field) {
          field.scrollIntoView({ block: 'center' })
          field.focus()
          return
        }
        void navigate({ to: '/', hash: 'catalogo' })
      }}
    >
      <Search className="size-6" aria-hidden />
    </button>
  )
}

const MENU_ITEM =
  'flex cursor-default items-center rounded-sm px-3 py-2 text-body-14 text-foreground outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-text-accent'

function UserMenu({ displayName, avatarUrl }: { displayName: string; avatarUrl: string | null }) {
  const logout = useLogout()
  // Non-modal: the rest of the page stays exposed to assistive tech while the menu is open.
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Menu de ${displayName}`}
        className="inline-flex size-10 items-center justify-center overflow-hidden rounded-full bg-primary text-body-15 font-bold text-ink hover:bg-primary-light"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          displayName.charAt(0).toUpperCase()
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-48 overflow-y-auto rounded-lg border border-border-strong bg-surface p-1"
        >
          <DropdownMenu.Item asChild className={MENU_ITEM}>
            <Link to="/perfil" activeOptions={{ exact: true }}>
              Perfil
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={MENU_ITEM}>
            <Link to="/perfil/carteiras">Carteiras</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={MENU_ITEM}>
            <Link to="/perfil/favoritos">Lista de interesse</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border-strong" />
          <DropdownMenu.Item className={cn(MENU_ITEM, 'font-bold')} disabled={logout.isPending} onSelect={() => logout.mutate()}>
            Sair
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** Pages where "Entrar" has nothing to return to (Início is already the default target). */
const NO_RETURN = new Set(['/', '/entrar', '/cadastro'])

function AccountArea() {
  const session = useSession()
  const location = useRouterState({ select: (s) => s.location })
  if (session) return <UserMenu displayName={session.user.displayName} avatarUrl={session.user.avatarUrl} />
  // Signing in returns to the page it was opened from (spec §3, "retorno ao fluxo anterior").
  const redirect = NO_RETURN.has(location.pathname) ? undefined : location.href
  return (
    <Link to="/entrar" search={redirect ? { redirect } : {}} className={cn(buttonVariants({ size: 'sm' }), 'h-9 gap-2 px-3 text-body-lg-16 font-medium')}>
      <LogIn className="size-5" aria-hidden />
      Entrar
    </Link>
  )
}

export function Header({ cartCount = 0 }: HeaderProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const marketActive = isMarketPath(pathname)
  const homeActive = pathname === '/'

  return (
    <header className="mx-auto w-full max-w-[1232px] px-4">
      <div className="flex h-[68px] items-center justify-between gap-4 border-b border-primary/30 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <Link to="/" className="text-body-14 font-bold tracking-[1.4px] text-foreground" aria-label="Kurio, página inicial">
          KURIO
        </Link>

        <nav aria-label="Principal" className="hidden h-full items-stretch gap-10 lg:flex">
          <Link to="/" className={cn(NAV_LINK, homeActive && NAV_ACTIVE)} aria-current={homeActive ? 'page' : undefined}>
            Início
          </Link>
          <Link
            to="/"
            hash="catalogo" activeOptions={{ includeHash: true }}
            className={cn(NAV_LINK, marketActive && NAV_ACTIVE)}
            aria-current={marketActive ? 'page' : undefined}
          >
            Mercado
          </Link>
          <Link to="/em-breve" search={{ secao: 'criadores' }} className={NAV_LINK}>
            Criadores
          </Link>
          <Link to="/em-breve" search={{ secao: 'aprenda' }} className={NAV_LINK}>
            Aprenda
          </Link>
        </nav>

        <div className="flex items-center justify-end gap-2">
          <ConnectionStatus />
          <SearchButton />
          <span className="hidden lg:inline-flex">
            <CartLink count={cartCount} />
          </span>
          <AccountArea />
        </div>
      </div>
    </header>
  )
}
