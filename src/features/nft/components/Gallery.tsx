import { Search } from 'lucide-react'
import { useState } from 'react'
import type { NftDetail } from '@/shared/contracts'
import { ArtImage } from '@/features/catalog/components/ArtImage'
import { cn } from '@/shared/lib/utils'
import { imageAlt } from '../image-alt'
import { ZoomDialog } from './ZoomDialog'

/**
 * Main artwork + 4 thumbnails (vertical column from 768px) and the zoom trigger. Phones follow the Figma
 * frame: no thumbnail strip, a dot indicator over the artwork, and a shorter image so the details start
 * in the first screen.
 */
export function Gallery({ nft }: { nft: NftDetail }) {
  const [active, setActive] = useState(0)
  const art = nft.gallery[active] ?? nft.art

  return (
    <div className="flex min-w-0 flex-col-reverse gap-3 md:contents">
      <ul aria-label="Miniaturas" className="hidden md:flex md:flex-col md:gap-[15px]">
        {nft.gallery.map((thumb, index) => (
          <li key={index} className="w-[68px] md:w-full">
            <button
              type="button"
              aria-label={`Ver imagem ${index + 1} de ${nft.gallery.length}`}
              aria-pressed={index === active}
              onClick={() => setActive(index)}
              className={cn(
                'block w-full overflow-hidden rounded-md border-2 transition-colors',
                index === active ? 'border-primary' : 'border-transparent hover:border-border-strong',
              )}
            >
              <ArtImage art={thumb} sizes="100px" alt="" className="aspect-square w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>

      <div data-testid="gallery-main" className="relative rounded-[28px] md:self-start md:rounded-md md:bg-surface md:p-4">
        <ArtImage
          art={art}
          sizes="(min-width: 1024px) 404px, (min-width: 768px) 40vw, 92vw"
          alt={imageAlt(nft, active)}
          loading="eager"
          fetchPriority="high"
          className="aspect-square max-h-[356px] w-full rounded-[28px] object-cover md:max-h-none md:rounded-[20px]"
        />
        <div role="group" aria-label="Imagens" className="absolute inset-x-0 bottom-12 flex justify-center md:hidden">
          {nft.gallery.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Ver imagem ${index + 1} de ${nft.gallery.length}`}
              aria-pressed={index === active}
              onClick={() => setActive(index)}
              className="inline-flex size-6 items-center justify-center"
            >
              <span
                aria-hidden
                className={cn('block h-1.5 rounded-full transition-all', index === active ? 'w-5 bg-primary' : 'w-1.5 bg-foreground/70')}
              />
            </button>
          ))}
        </div>
        <ZoomDialog nft={nft} index={active}>
          <button
            type="button"
            aria-label="Ampliar imagem"
            className="absolute top-3 right-3 inline-flex size-10 items-center justify-center rounded-full bg-ink/85 text-foreground transition-colors hover:bg-primary hover:text-ink md:top-2 md:right-2"
          >
            <Search aria-hidden className="size-5" />
          </button>
        </ZoomDialog>
      </div>
    </div>
  )
}
