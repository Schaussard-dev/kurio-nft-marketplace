import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllCheckoutDrafts, clearCheckoutDraft, loadCheckoutDraft, saveCheckoutDraft, type CheckoutDraft } from './draft'
import { memorySessionStorage } from './test-storage'

// Compile-time: the draft type has no secret fields (a `password` key would make this `true` and fail to compile).
type HasSecret = 'password' extends keyof CheckoutDraft
  ? true
  : 'currentPassword' extends keyof CheckoutDraft
    ? true
    : 'token' extends keyof CheckoutDraft
      ? true
      : false
const noSecrets: HasSecret = false

const draft: CheckoutDraft = {
  displayName: 'Ana Souza',
  username: 'ana',
  network: 'ethereum',
  profileName: 'ana',
  walletAddress: '0xA91F3c2d4E5f60718293a4b5C6d7E8f90123E82C',
  secondaryAddress: '',
  connector: 'metamask',
  referralCode: 'KURIO-ANA',
  email: 'ana@kurio.dev',
  ensName: 'ana.kurio',
  walletChoice: 'wlt_ana_primary',
  note: 'Para minha coleção',
  knownWalletIds: ['wlt_ana_primary', 'wlt_ana_secondary'],
}

describe('checkout draft', () => {
  beforeEach(() => vi.stubGlobal('sessionStorage', memorySessionStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips the draft per user in sessionStorage', () => {
    expect(noSecrets).toBe(false)
    saveCheckoutDraft('usr_ana', draft)
    expect(sessionStorage.getItem('kurio-checkout-draft:usr_ana')).not.toBeNull()
    expect(loadCheckoutDraft('usr_ana')).toEqual(draft)
    expect(loadCheckoutDraft('usr_bruno')).toBeNull()
  })

  it('drops unknown keys and rejects malformed data', () => {
    sessionStorage.setItem('kurio-checkout-draft:usr_ana', JSON.stringify({ ...draft, password: 'Kurio@2026' }))
    expect(loadCheckoutDraft('usr_ana')).toEqual(draft)
    expect(loadCheckoutDraft('usr_ana')).not.toHaveProperty('password')
    sessionStorage.setItem('kurio-checkout-draft:usr_ana', JSON.stringify({ ...draft, network: 'bitcoin' }))
    expect(loadCheckoutDraft('usr_ana')).toBeNull()
    sessionStorage.setItem('kurio-checkout-draft:usr_ana', '{oops')
    expect(loadCheckoutDraft('usr_ana')).toBeNull()
  })

  it('clears one user, or every draft (logout / user switch)', () => {
    saveCheckoutDraft('usr_ana', draft)
    saveCheckoutDraft('usr_bruno', { ...draft, displayName: 'Bruno Lima' })
    clearCheckoutDraft('usr_ana')
    expect(loadCheckoutDraft('usr_ana')).toBeNull()
    expect(loadCheckoutDraft('usr_bruno')?.displayName).toBe('Bruno Lima')
    sessionStorage.setItem('other', 'kept')
    clearAllCheckoutDrafts()
    expect(loadCheckoutDraft('usr_bruno')).toBeNull()
    expect(sessionStorage.getItem('other')).toBe('kept')
  })
})
