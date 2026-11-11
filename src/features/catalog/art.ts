export type ArtKey = 'emerald' | 'sage' | 'ivory' | 'golden'

export const ART_KEYS: readonly ArtKey[] = ['emerald', 'sage', 'ivory', 'golden']

const ART_WIDTHS = [320, 640, 1024] as const
const DEFAULT_WIDTH = 640

type ArtFormat = 'avif' | 'webp'

export interface ArtSources {
  /** Default-size URL per format, for plain `src` usage. */
  avif: string
  webp: string
  /** `srcSet` strings to feed `<source srcSet>` elements. */
  srcSet: { avif: string; webp: string }
}

function url(key: ArtKey, width: number, format: ArtFormat): string {
  return `/nfts/${key}-${width}.${format}`
}

function srcSet(key: ArtKey, format: ArtFormat): string {
  return ART_WIDTHS.map((width) => `${url(key, width, format)} ${width}w`).join(', ')
}

export function artSources(key: ArtKey): ArtSources {
  return {
    avif: url(key, DEFAULT_WIDTH, 'avif'),
    webp: url(key, DEFAULT_WIDTH, 'webp'),
    srcSet: { avif: srcSet(key, 'avif'), webp: srcSet(key, 'webp') },
  }
}
