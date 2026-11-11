import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { ArtKey } from '../art'
import type { CatalogTab } from '../search-params'
import { ArtImage } from './ArtImage'

interface Slide {
  art: ArtKey
  alt: string
  eyebrow: string
  /** Desktop and mobile titles differ in the Figma frames. */
  title: { desktop: [string, string]; mobile: [string, string] }
  text: { desktop: string; mobile: string }
  tab?: CatalogTab
}

const SLIDES: Slide[] = [
  {
    art: 'emerald',
    alt: 'Emerald Ape #042: macaco de óculos redondos e jaqueta verde de colegial',
    eyebrow: 'Bem-vindo à Kurio',
    title: { desktop: ['SEJA DONO DO FUTURO', 'DA ARTE DIGITAL'], mobile: ['SEJA DONO DA', 'CULTURA DIGITAL'] },
    text: {
      desktop:
        'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.',
      mobile: 'Descubra NFTs selecionados de criadores do mundo todo.',
    },
  },
  {
    art: 'sage',
    alt: 'Sage Nomad #009: gorila de chapéu bucket verde e moletom lilás',
    eyebrow: 'Novos lançamentos',
    title: { desktop: ['LANÇAMENTOS GÊNESIS', 'DE EDIÇÃO LIMITADA'], mobile: ['LANÇAMENTOS', 'GÊNESIS'] },
    text: {
      desktop: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
      mobile: 'Edições escassas direto dos criadores.',
    },
    tab: 'new',
  },
  {
    art: 'golden',
    alt: 'Golden Beat #207: macaco dourado com fones de ouvido e jaqueta creme',
    eyebrow: 'Em alta',
    title: { desktop: ['ARTE DIGITAL', 'SELECIONADA'], mobile: ['ARTE DIGITAL', 'SELECIONADA'] },
    text: {
      desktop: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
      mobile: 'Novos artistas e coleções verificadas.',
    },
    tab: 'trending',
  },
]

const HERO_SIZES = '(min-width: 1024px) 450px, 140px'

/** Hero carousel: 3 slides, dot controls, no autoplay. Only the active slide is rendered. */
export function Hero() {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]!
  const exploreSearch = slide.tab ? { tab: slide.tab } : {}

  return (
    <section aria-roledescription="carrossel" aria-label="Destaques" className="relative">
      <div
        id="hero-slide"
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} de ${SLIDES.length}`}
        className={cn(
          'relative grid grid-cols-[minmax(0,1fr)_minmax(0,140px)] items-center gap-3 overflow-hidden rounded-3xl px-5 pt-5 pb-10',
          'bg-[radial-gradient(circle_at_45%_45%,color-mix(in_srgb,var(--color-primary)_38%,var(--color-surface))_0,color-mix(in_srgb,var(--color-primary)_22%,var(--color-surface))_38%,var(--color-surface)_75%)]',
          'lg:grid-cols-[minmax(0,1fr)_450px] lg:items-start lg:gap-10 lg:overflow-visible lg:rounded-none lg:bg-none lg:p-0 lg:pt-2',
        )}
      >
        <div className="flex min-w-0 flex-col items-start lg:px-10 lg:pt-11">
          <p className="text-caption-12 font-medium text-foreground lg:text-body-14 lg:tracking-[1.4px]">{slide.eyebrow}</p>
          <h2 className="mt-2 text-body-lg-18 font-bold text-foreground max-lg:leading-[29px] lg:mt-3 lg:text-display-43">
            <span className="lg:hidden">
              {slide.title.mobile[0]}
              <br />
              {slide.title.mobile[1]}
            </span>
            <span className="hidden lg:inline">
              {slide.title.desktop[0]}
              <br />
              {slide.title.desktop[1]}
            </span>
          </h2>
          <p className="mt-1.5 text-caption-12 leading-[18px] text-text-secondary lg:mt-1 lg:max-w-[557px] lg:text-body-14 lg:leading-6">
            <span className="lg:hidden">{slide.text.mobile}</span>
            <span className="hidden lg:inline">{slide.text.desktop}</span>
          </p>
          <Link
            to="/"
            search={exploreSearch}
            hash="catalogo"
            resetScroll={false}
            className="mt-1 inline-flex items-center gap-3 text-caption-12 font-bold text-text-accent lg:mt-8 lg:h-10 lg:w-[140px] lg:justify-center lg:rounded-md lg:bg-primary lg:text-body-lg-16 lg:text-ink lg:hover:bg-primary-light"
          >
            EXPLORAR
            <ArrowRight aria-hidden className="size-5 lg:hidden" />
          </Link>
        </div>
        <ArtImage
          art={slide.art}
          sizes={HERO_SIZES}
          alt={slide.alt}
          loading={index === 0 ? 'eager' : 'lazy'}
          fetchPriority={index === 0 ? 'high' : 'auto'}
          className="aspect-square w-full rounded-[20px] object-cover lg:rounded-3xl"
        />
      </div>

      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1 lg:right-auto lg:bottom-11 lg:left-[600px]">
        {SLIDES.map((item, i) => (
          <button
            key={item.art}
            type="button"
            aria-label={`Slide ${i + 1} de ${SLIDES.length}`}
            aria-controls="hero-slide"
            aria-current={i === index ? 'true' : undefined}
            onClick={() => setIndex(i)}
            className="flex size-6 items-center justify-center"
          >
            <span
              className={cn(
                'block size-2 rounded-full transition-colors',
                i === index ? 'scale-125 bg-primary' : 'bg-primary/50',
              )}
            />
          </button>
        ))}
      </div>
    </section>
  )
}
