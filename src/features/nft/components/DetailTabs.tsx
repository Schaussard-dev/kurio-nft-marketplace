import { Tabs } from 'radix-ui'
import type { NftDetail } from '@/shared/contracts'
import { Reviews } from './Reviews'

const TRIGGER =
  'relative -mb-px shrink-0 border-b-2 whitespace-nowrap border-transparent px-0 pb-2.5 text-left text-body-15 text-foreground transition-colors hover:text-text-accent data-[state=active]:border-primary data-[state=active]:font-bold data-[state=active]:text-text-accent md:text-body-lg-17'

/** "Rede:\nCunhado na…" blocks become a bold label + text; plain blocks are paragraphs. */
function LongDescription({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-4 text-body-14 leading-6 text-text-secondary">
      {text.split('\n\n').map((block, index) => {
        const [first, ...rest] = block.split('\n')
        if (rest.length === 0) return <p key={index}>{first}</p>
        return (
          <div key={index}>
            <p className="font-bold text-foreground">{first}</p>
            <p>{rest.join(' ')}</p>
          </div>
        )
      })}
    </div>
  )
}

/** "Detalhes do NFT" and "Avaliações de colecionadores (n)" (read-only), Radix tabs. */
export function DetailTabs({ nft }: { nft: NftDetail }) {
  return (
    <Tabs.Root defaultValue="details" className="flex flex-col">
      <Tabs.List aria-label="Informações do NFT" className="flex gap-8 overflow-x-auto border-b border-border-strong">
        <Tabs.Trigger value="details" className={TRIGGER}>
          Detalhes do NFT
        </Tabs.Trigger>
        <Tabs.Trigger value="reviews" className={TRIGGER}>
          Avaliações de colecionadores ({nft.reviewCount})
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="details" className="pt-5">
        <LongDescription text={nft.longDescription} />
      </Tabs.Content>
      <Tabs.Content value="reviews" className="pt-5">
        <Reviews reviews={nft.reviews} rating={nft.rating} />
      </Tabs.Content>
    </Tabs.Root>
  )
}
