import type { ReactNode } from 'react'
import type { NftDetail } from '@/shared/contracts'
import { ArtImage } from '@/features/catalog/components/ArtImage'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { imageAlt } from '../image-alt'

interface ZoomDialogProps {
  nft: NftDetail
  index: number
  /** The button that opens the dialog; Radix returns focus to it on close. */
  children: ReactNode
}

/** Enlarged artwork in a modal dialog (focus trapped, Esc closes). */
export function ZoomDialog({ nft, index, children }: ZoomDialogProps) {
  const art = nft.gallery[index] ?? nft.art
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-[min(92vw,820px)] gap-3 border-border-strong bg-surface p-4 sm:max-w-[min(92vw,820px)] md:p-6">
        <DialogTitle className="pr-8 text-body-lg-18 font-bold text-foreground">
          {nft.name}, imagem {index + 1} de {nft.gallery.length}
        </DialogTitle>
        <DialogDescription className="sr-only">Imagem ampliada da obra. Pressione Esc para fechar.</DialogDescription>
        <ArtImage
          art={art}
          sizes="(min-width: 900px) 772px, 88vw"
          alt={imageAlt(nft, index)}
          loading="eager"
          className="max-h-[78dvh] w-full rounded-[20px] object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}
