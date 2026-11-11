import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreateOrderInput, Quote } from '@/shared/contracts'
import { getAttempt, peekAttempt } from '@/shared/lib/idempotency'
import { readAttempt, startAttempt, type AttemptDisplay } from './attempt'
import { memorySessionStorage } from './test-storage'

const quote: Quote = {
  quoteId: 'qt_1',
  lines: [
    { lineId: 'ln', nftId: 'nft_009', editionId: 'e3', unitPrice: '1.69', quantity: 1, lineTotal: '1.69', available: 15 },
  ],
  subtotal: '1.69',
  discount: '0',
  networkFee: '0.016',
  total: '1.706',
  coupon: null,
  network: 'ethereum',
  expiresAt: '2026-11-11T12:10:00.000Z',
  fingerprint: 'f',
}
const display: AttemptDisplay = {
  quote,
  walletLabel: 'Principal · 0xA91F…E82C',
  connectorLabel: 'MetaMask',
  networkLabel: 'Ethereum',
}
const input: CreateOrderInput = {
  quoteId: 'qt_1',
  connector: 'metamask',
  walletId: 'wlt_ana_primary',
  network: 'ethereum',
  payer: {
    displayName: 'Ana Souza',
    username: 'ana',
    profileName: 'ana',
    email: 'ana@kurio.dev',
    referralCode: 'KURIO-ANA',
    walletAddress: '0xA91F3c2d4E5f60718293a4b5C6d7E8f90123E82C',
  },
}

describe('stored order attempt with its review snapshot', () => {
  beforeEach(() => vi.stubGlobal('sessionStorage', memorySessionStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('stores what was reviewed with the payload, so a replay shows that and not the current screen', () => {
    const started = startAttempt('usr_ana', 'hash-a', input, display)
    expect(started.reused).toBe(false)
    expect(readAttempt('usr_ana')).toEqual({ key: started.key, payload: input, display })

    // A later send with another payload/screen replays the stored attempt and its snapshot.
    const other = { ...display, networkLabel: 'Polygon', quote: { ...quote, total: '1.692' } }
    const again = startAttempt('usr_ana', 'hash-b', { ...input, network: 'polygon' }, other)
    expect(again).toEqual({ key: started.key, payload: input, display, reused: true })
  })

  it('drops an unreadable attempt (no payload or snapshot) instead of replaying garbage', () => {
    getAttempt('usr_ana', 'hash-a', { nope: true })
    expect(readAttempt('usr_ana')).toBeNull()
    expect(peekAttempt('usr_ana')).toBeNull()
    expect(readAttempt('usr_bruno')).toBeNull()
  })
})
