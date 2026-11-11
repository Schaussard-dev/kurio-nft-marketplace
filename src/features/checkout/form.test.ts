import { describe, expect, it } from 'vitest'
import { createOrderInputSchema, walletSchema, type Profile, type WalletsResponse } from '@/shared/contracts'
import { WALLET_SEEDS } from '@/mocks/fixtures/users'
import { MANUAL_WALLET } from './draft'
import { checkoutFormSchema, connectTarget, initialValues, toOrderInput } from './form'

const profile: Profile = {
  id: 'usr_ana',
  username: 'ana',
  email: 'ana@kurio.dev',
  displayName: 'Ana Souza',
  walletNickname: 'Principal',
  ensName: 'ana.kurio.eth',
  avatarUrl: null,
}
const [primary, secondary] = WALLET_SEEDS.map((record) => walletSchema.parse(record))
const wallets: WalletsResponse = { primary, secondary }

describe('checkout form', () => {
  it('prefills from the profile and the primary wallet and is valid as is', () => {
    const values = initialValues(profile, wallets, null)
    expect(values).toMatchObject({
      walletChoice: 'wlt_ana_primary',
      network: 'ethereum',
      walletAddress: primary.address,
      connector: 'metamask',
      ensName: 'ana.kurio',
      referralCode: 'KURIO-ANA',
    })
    expect(checkoutFormSchema.safeParse(values).success).toBe(true)
  })

  it('without wallets starts on manual entry with the wallet fields empty (invalid until filled)', () => {
    const values = initialValues(profile, { primary: null, secondary: null }, null)
    expect(values.walletChoice).toBe(MANUAL_WALLET)
    const result = checkoutFormSchema.safeParse(values)
    expect(result.success).toBe(false)
    const paths = result.error!.issues.map((issue) => issue.path[0])
    expect(paths).toEqual(expect.arrayContaining(['walletAddress', 'referralCode', 'network', 'connector']))
  })

  it('keeps a restored draft, falling back to manual when its wallet is gone', () => {
    const draft = { ...initialValues(profile, wallets, null), note: 'rascunho' }
    expect(initialValues(profile, wallets, draft)).toEqual(draft)
    expect(initialValues(profile, { primary: null, secondary: null }, draft).walletChoice).toBe(MANUAL_WALLET)
  })

  it('builds a contract-valid order payload (stored ENS, manual wallet → walletId null, empty optionals left out)', () => {
    const values = { ...initialValues(profile, wallets, null), walletChoice: MANUAL_WALLET, note: '  ' }
    const input = toOrderInput(values, 'qt_1')
    expect(createOrderInputSchema.safeParse(input).success).toBe(true)
    expect(input).toMatchObject({ quoteId: 'qt_1', walletId: null, payer: { ensName: 'ana.kurio.eth' } })
    expect(input).not.toHaveProperty('note')
    expect(input.payer).not.toHaveProperty('secondaryAddress')
    expect(connectTarget(values)).toBe('metamask')
    expect(connectTarget({ walletChoice: 'wlt_ana_primary', connector: 'coinbase' })).toBe('wlt_ana_primary')
  })

  it('checks the address for the network and requires ENS only on Ethereum', () => {
    const values = initialValues(profile, wallets, null)
    const issues = (v: typeof values) => checkoutFormSchema.safeParse(v).error?.issues.map((i) => i.path[0]) ?? []
    expect(issues({ ...values, network: 'solana' })).toContain('walletAddress')
    expect(issues({ ...values, ensName: '' })).toContain('ensName')
    expect(issues({ ...values, network: 'polygon', ensName: '' })).toEqual([])
  })
})
