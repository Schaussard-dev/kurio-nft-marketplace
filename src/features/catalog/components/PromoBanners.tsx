import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { ArtKey } from '../art'
import type { CatalogSearch } from '../search-params'
import { ArtImage } from './ArtImage'

interface Promo {
  art: ArtKey
  title: [string, string]
  text: string
  /** Real catalog view the banner opens. */
  search: Partial<CatalogSearch>
}

const PROMOS: Promo[] = [
  {
    art: 'emerald',
    title: ['Lançamentos gênesis', 'de edição limitada'],
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    search: { tab: 'new' },
  },
  {
    art: 'ivory',
    title: ['Arte digital selecionada', 'e muito mais'],
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    search: { categories: ['arte-digital'] },
  },
]

export function PromoBanners() {
  return (
    <section aria-label="Promoções" className="grid gap-7 md:grid-cols-2">
      {PROMOS.map((promo) => (
        <article key={promo.art} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-3xl bg-surface md:rounded-[20px]">
          <ArtImage art={promo.art} sizes="(min-width: 768px) 290px, 50vw" alt="" className="h-full min-h-[200px] w-full rounded-[20px] object-cover md:h-[250px]" />
          <div className="flex flex-col items-end justify-center gap-3 py-6 pr-4 pl-2 text-right md:pr-6">
            <h2 className="text-body-lg-16 leading-6 font-bold text-foreground md:text-body-lg-18 md:leading-6">
              {promo.title[0]}
              <br />
              {promo.title[1]}
            </h2>
            <p className="text-caption-12 leading-5 text-text-secondary md:text-body-14 md:leading-6">{promo.text}</p>
            <Link
              to="/"
              search={promo.search}
              hash="catalogo"
              resetScroll={false}
              className="inline-flex h-10 w-[140px] items-center justify-center gap-1 rounded-md bg-primary text-body-14 font-medium text-ink transition-colors hover:bg-primary-light"
            >
              Explorar
              <span className="sr-only">
                {promo.title[0]} {promo.title[1]}
              </span>
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}
