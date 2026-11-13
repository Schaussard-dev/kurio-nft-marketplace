import { useRef, useState } from 'react'
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

const SLIDE = cn(
  'relative grid w-full shrink-0 snap-center grid-cols-[minmax(0,1fr)_minmax(0,140px)] items-center gap-3 overflow-hidden rounded-[30px] p-4 pb-7',
  'bg-[radial-gradient(circle_at_45%_45%,color-mix(in_srgb,var(--color-primary)_38%,var(--color-surface))_0,color-mix(in_srgb,var(--color-primary)_22%,var(--color-surface))_38%,var(--color-surface)_75%)]',
  'lg:grid-cols-[minmax(0,1fr)_450px] lg:items-start lg:gap-10 lg:overflow-visible lg:rounded-none lg:bg-none lg:p-0 lg:pt-2',
)

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Hero carousel: 3 slides, dot controls, no autoplay. Below lg the slides sit side by side in a scroll-snap
 * track, so a swipe drags them under the finger (native momentum) and the active dot follows the scroll.
 * From lg up only the active slide is shown (Figma desktop) and the dots switch it.
 */
export function Hero() {
  const [index, setIndex] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  /** Left offset of each slide inside the track (the gap between slides included). */
  const slideOffset = (track: HTMLDivElement, i: number) => {
    const slides = track.children
    return (slides[i] as HTMLElement).offsetLeft - (slides[0] as HTMLElement).offsetLeft
  }

  const onScroll = () => {
    const track = trackRef.current
    if (!track || track.scrollWidth <= track.clientWidth) return
    let nearest = 0
    for (let i = 1; i < SLIDES.length; i++) {
      if (Math.abs(slideOffset(track, i) - track.scrollLeft) < Math.abs(slideOffset(track, nearest) - track.scrollLeft)) nearest = i
    }
    setIndex(nearest)
  }

  const goTo = (i: number) => {
    setIndex(i)
    const track = trackRef.current
    if (track && track.scrollWidth > track.clientWidth) {
      track.scrollTo({ left: slideOffset(track, i), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    }
  }

  return (
    <section aria-roledescription="carrossel" aria-label="Destaques" className="relative">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain rounded-[30px] [scrollbar-width:none] lg:block lg:overflow-visible lg:rounded-none"
      >
        {SLIDES.map((slide, i) => {
          const active = i === index
          return (
            <div
              key={slide.art}
              id={`hero-slide-${i}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${SLIDES.length}`}
              // Off-screen slides stay out of the tab order and the accessibility tree; a swipe makes one active.
              inert={!active}
              className={cn(SLIDE, !active && 'lg:hidden')}
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
                  search={slide.tab ? { tab: slide.tab } : {}}
                  hash="catalogo"
                  activeOptions={{ includeHash: true }}
                  resetScroll={false}
                  className="mt-1 inline-flex items-center gap-3 text-caption-12 font-bold text-text-accent lg:mt-8 lg:h-10 lg:w-[140px] lg:justify-center lg:rounded-md lg:bg-primary lg:text-body-lg-16 lg:text-ink lg:hover:bg-primary-light"
                >
                  EXPLORAR
                  <ArrowRight aria-hidden className="size-5 lg:hidden" />
                </Link>
              </div>
              <div className="relative">
                <ArtImage
                  art={slide.art}
                  sizes={HERO_SIZES}
                  alt={slide.alt}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  className="aspect-square w-full rounded-2xl object-cover lg:rounded-3xl"
                />
                {/* Mobile frame: a second, smaller artwork overlaps the bottom-left corner (decorative). */}
                <ArtImage
                  art={SLIDES[(i + 1) % SLIDES.length]!.art}
                  sizes="58px"
                  alt=""
                  loading="lazy"
                  className="absolute -bottom-2 left-3.5 size-[42%] rounded-2xl object-cover shadow-lg lg:hidden"
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Taller touch targets (44px) at the Figma dot spacing (28px apart); 24px squares on desktop. Swiping is
          the primary gesture on phones. */}
      <div className="absolute inset-x-0 bottom-0.5 flex justify-center lg:right-[560px] lg:bottom-11 lg:left-auto lg:gap-1">
        {SLIDES.map((item, i) => (
          <button
            key={item.art}
            type="button"
            aria-label={`Slide ${i + 1} de ${SLIDES.length}`}
            aria-controls={`hero-slide-${i}`}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => goTo(i)}
            className="flex h-11 w-7 items-center justify-center lg:size-6"
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
