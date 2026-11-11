import { Search } from 'lucide-react'
import { useState } from 'react'
import type { NftDetail } from '@/shared/contracts'
import { ArtImage } from '@/features/catalog/components/ArtImage'
import { cn } from '@/shared/lib/utils'
import { imageAlt } from '../image-alt'
import { ZoomDialog } from './ZoomDialog'

/** Main artwork + 4 thumbnails (vertical column on desktop, row on mobile) and the zoom trigger. */
export function Gallery({ nft }: { nft: NftDetail }) {
  const [active, setActive] = useState(0)
  const art = nft.gallery[active] ?? nft.art

  return (
    <div className="flex min-w-0 flex-col-reverse gap-3 md:contents">
      <ul aria-label="Miniaturas" className="flex gap-3 md:flex-col md:gap-[15px]">
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

      <div data-testid="gallery-main" className="relative rounded-[28px] md:rounded-md md:bg-surface md:p-5">
        <ArtImage
          art={art}
          sizes="(min-width: 1024px) 404px, (min-width: 768px) 40vw, 92vw"
          alt={imageAlt(nft, active)}
          loading="eager"
          fetchPriority="high"
          className="aspect-square w-full rounded-[28px] object-cover md:rounded-[20px]"
        />
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
