import { describe, expect, it } from 'vitest'
import { explorerLinkLabel } from './explorer'

describe('explorerLinkLabel', () => {
  it('keeps the Figma copy for Ethereum', () => {
    expect(explorerLinkLabel('ethereum')).toBe('Ver no Etherscan')
  })

  it('names the explorer of the network the order settled on (QA-04)', () => {
    expect(explorerLinkLabel('polygon')).toBe('Ver no Polygonscan')
    expect(explorerLinkLabel('solana')).toBe('Ver no Solscan')
  })
})
