import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/nft/$nftId')({
  component: NftDetailPage,
})

// Placeholder; a later task builds the NFT detail page.
function NftDetailPage() {
  return <h1 className="text-heading-28 text-foreground">NFT</h1>
}
