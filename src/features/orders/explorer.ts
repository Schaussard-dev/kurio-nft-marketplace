import type { Network } from '@/shared/contracts'

const EXPLORERS: Record<Network, string> = {
  ethereum: 'Etherscan',
  polygon: 'Polygonscan',
  solana: 'Solscan',
}

/** Receipt link copy: the Figma "Ver no Etherscan" for Ethereum, the matching explorer on other networks. */
export function explorerLinkLabel(network: Network): string {
  return `Ver no ${EXPLORERS[network]}`
}
