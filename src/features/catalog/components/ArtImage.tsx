import type { ImgHTMLAttributes } from 'react'
import { artSources, type ArtKey } from '../art'

type ArtImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  art: ArtKey
  /** `sizes` attribute shared by the AVIF and WebP sources. */
  sizes: string
  alt: string
}

/** Responsive AVIF/WebP artwork with intrinsic 1:1 dimensions (no layout shift). */
export function ArtImage({ art, sizes, alt, loading = 'lazy', ...img }: ArtImageProps) {
  const sources = artSources(art)
  return (
    <picture>
      <source type="image/avif" srcSet={sources.srcSet.avif} sizes={sizes} />
      <source type="image/webp" srcSet={sources.srcSet.webp} sizes={sizes} />
      <img src={sources.webp} alt={alt} width={640} height={640} loading={loading} decoding="async" {...img} />
    </picture>
  )
}
