import { Link } from '@tanstack/react-router'
import { Download, Heart, LogOut, MapPin, ShoppingCart, Tag, TriangleAlert, User } from 'lucide-react'
import { useLogout } from '@/features/auth/queries'

const ITEM =
  'flex h-[52px] shrink-0 items-center gap-3 border-l-4 lg:h-[45px] border-transparent px-4 text-body-15 whitespace-nowrap text-text-accent hover:bg-surface-2'
const ACTIVE = { className: 'border-primary bg-surface-2', 'aria-current': 'page' as const }

/** "Meu perfil" menu; below lg it becomes a horizontally scrollable strip (no mobile frame in Figma). */
export function ProfileSidebar() {
  const logout = useLogout()
  return (
    <aside aria-label="Menu do perfil" className="min-w-0 self-start bg-surface">
      <p className="px-4 pt-4 pb-3 text-body-lg-18 font-bold text-foreground">Meu perfil</p>
      <nav aria-label="Seções do perfil" className="flex overflow-x-auto lg:flex-col">
        <Link to="/perfil" activeOptions={{ exact: true }} activeProps={ACTIVE} className={ITEM}>
          <User className="size-5" aria-hidden />
          Dados do perfil
        </Link>
        <Link to="/perfil/carteiras" activeProps={ACTIVE} className={ITEM}>
          <MapPin className="size-5" aria-hidden />
          Carteiras
        </Link>
        <Link to="/em-breve" search={{ secao: 'atividade' }} className={ITEM}>
          <ShoppingCart className="size-5" aria-hidden />
          Atividade
        </Link>
        <Link to="/perfil/favoritos" activeProps={ACTIVE} className={ITEM}>
          <Heart className="size-5" aria-hidden />
          Lista de interesse
        </Link>
        <Link to="/em-breve" search={{ secao: 'ofertas' }} className={ITEM}>
          <Tag className="size-5" aria-hidden />
          Ofertas
        </Link>
        <Link to="/em-breve" search={{ secao: 'arquivos' }} className={ITEM}>
          <Download className="size-5" aria-hidden />
          Arquivos baixados
        </Link>
        <Link to="/em-breve" search={{ secao: 'suporte' }} className={ITEM}>
          <TriangleAlert className="size-5" aria-hidden />
          Suporte
        </Link>
      </nav>
      <button
        type="button"
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
        className="flex h-[52px] w-full items-center gap-3 border-t border-primary/60 px-4 text-body-15 font-bold text-text-accent hover:bg-surface-2"
      >
        <LogOut className="size-5" aria-hidden />
        Sair
      </button>
    </aside>
  )
}
