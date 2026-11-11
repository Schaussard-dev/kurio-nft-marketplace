import { ART_DESCRIPTIONS } from '@/features/catalog/art'
import type { NftDetail } from '@/shared/contracts'

/** "Emerald Ape #042, imagem 2 de 4: <art description>" (spec §10: descriptive alt text). */
export function imageAlt(nft: NftDetail, index: number): string {
  const art = nft.gallery[index] ?? nft.art
  return `${nft.name}, imagem ${index + 1} de ${nft.gallery.length}: ${ART_DESCRIPTIONS[art]}`
}
