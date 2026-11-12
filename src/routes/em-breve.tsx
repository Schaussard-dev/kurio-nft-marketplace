import { Link, createFileRoute } from '@tanstack/react-router'
import { buttonVariants } from '@/shared/ui/button'
import { useDocumentTitle } from '@/shared/lib/use-document-title'

const SECTION_LABELS: Record<string, string> = {
  criadores: 'Criadores',
  aprenda: 'Aprenda',
  scanner: 'Scanner',
  colecao: 'Minha coleção',
  atividade: 'Atividade',
  estudio: 'Estúdio do criador',
  ofertas: 'Ofertas',
  arquivos: 'Arquivos baixados',
  suporte: 'Suporte',
  ajuda: 'Central de ajuda',
  'como-comprar': 'Como comprar NFTs',
  'carteira-seguranca': 'Carteira e segurança',
  politica: 'Política do mercado',
  denunciar: 'Denunciar item',
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  utilidade: 'Utilidade',
  diario: 'Diário da Cunhagem',
}

export const Route = createFileRoute('/em-breve')({
  validateSearch: (search: Record<string, unknown>): { secao?: string } =>
    typeof search.secao === 'string' ? { secao: search.secao } : {},
  component: ComingSoonPage,
})

function ComingSoonPage() {
  useDocumentTitle('Em breve')
  const { secao } = Route.useSearch()
  const label = secao ? (SECTION_LABELS[secao] ?? 'Esta seção') : 'Esta seção'
  return (
    <section className="mx-auto flex max-w-xl flex-col items-start gap-4 py-20">
      <h1 className="text-display-32 text-foreground">Em breve</h1>
      <p className="text-body-lg-16 text-text-secondary">{label} ainda não está disponível nesta demonstração.</p>
      <Link to="/" className={buttonVariants()}>
        Voltar ao início
      </Link>
    </section>
  )
}
