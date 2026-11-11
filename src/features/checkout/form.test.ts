import { describe, expect, it } from 'vitest'
import { createOrderInputSchema, walletSchema, type Profile, type WalletsResponse } from '@/shared/contracts'
import { WALLET_SEEDS } from '@/mocks/fixtures/users'
import { MANUAL_WALLET } from './draft'
import {
  changedLines,
  checkoutFormSchema,
  connectTarget,
  initialValues,
  isUnchangedQuote,
  toOrderInput,
} from './form'
import type { Quote } from '@/shared/contracts'

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

  const known = ['wlt_ana_primary', 'wlt_ana_secondary']

  it('keeps a restored draft, re-applying every current field of its registered wallet', () => {
    const values = { ...initialValues(profile, wallets, null), note: 'rascunho' }
    expect(initialValues(profile, wallets, { ...values, knownWalletIds: known })).toEqual(values)
    // The wallet was edited since the draft was saved: its address/network win over the stale draft.
    const stale = {
      ...values,
      walletAddress: '0x0000000000000000000000000000000000000000',
      network: 'polygon' as const,
      secondaryAddress: 'old.eth',
      connector: 'coinbase' as const,
      ensName: 'old',
    }
    expect(initialValues(profile, wallets, { ...stale, knownWalletIds: known })).toMatchObject({
      walletChoice: 'wlt_ana_primary',
      network: 'ethereum',
      walletAddress: primary.address,
      secondaryAddress: primary.secondaryAddress ?? '',
      connector: primary.walletType,
      ensName: 'ana.kurio',
      note: 'rascunho',
    })
  })

  it('falls back when the drafted wallet is gone: another registered wallet, else manual', () => {
    const values = { ...initialValues(profile, wallets, null), walletChoice: 'wlt_ana_secondary' }
    const onlyPrimary = { primary, secondary: null }
    expect(initialValues(profile, onlyPrimary, { ...values, knownWalletIds: known })).toMatchObject({
      walletChoice: 'wlt_ana_primary',
      walletAddress: primary.address,
    })
    const none = { primary: null, secondary: null }
    expect(initialValues(profile, none, { ...values, knownWalletIds: known }).walletChoice).toBe(MANUAL_WALLET)
  })

  it('back from "Cadastrar carteira": a wallet created after a manual draft is preferred', () => {
    const manual = { ...initialValues(profile, { primary: null, secondary: null }, null), note: 'rascunho' }
    const restored = initialValues(profile, { primary, secondary: null }, { ...manual, knownWalletIds: [] })
    expect(restored).toMatchObject({ walletChoice: 'wlt_ana_primary', walletAddress: primary.address, note: 'rascunho' })
    // A manual choice made while the wallet already existed is kept.
    const kept = initialValues(profile, wallets, { ...manual, knownWalletIds: known })
    expect(kept.walletChoice).toBe(MANUAL_WALLET)
  })

  it('builds a contract-valid order payload (stored ENS, manual wallet → walletId null, empty optionals left out)', () => {
    const values = { ...initialValues(profile, wallets, null), walletChoice: MANUAL_WALLET, note: '  ' }
    const input = toOrderInput(values, 'qt_1')
    expect(createOrderInputSchema.safeParse(input).success).toBe(true)
    expect(input).toMatchObject({ quoteId: 'qt_1', connector: values.connector, walletId: null, payer: { ensName: 'ana.kurio.eth' } })
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

const quote = (lines: [string, string, number][], total: string): Quote => ({
  quoteId: 'qt',
  lines: lines.map(([lineId, unitPrice, quantity]) => ({
    lineId,
    nftId: `nft_${lineId}`,
    editionId: 'e',
    unitPrice,
    quantity,
    lineTotal: unitPrice,
    available: 5,
  })),
  subtotal: total,
  discount: '0',
  networkFee: '0',
  total,
  coupon: null,
  network: 'ethereum',
  expiresAt: '2026-11-11T12:00:00.000Z',
  fingerprint: 'f',
})

describe('quote comparison (QUOTE_STALE)', () => {
  it('changedLines lists price, quantity, added and removed lines by name', () => {
    const before = quote([['a', '1.69', 1], ['b', '1.19', 2], ['c', '0.5', 1]], '5')
    const after = quote([['a', '1.89', 1], ['b', '1.19', 3], ['d', '2', 1]], '7')
    expect(changedLines(before, after, { a: 'Sage Nomad #009' })).toEqual([
      { lineId: 'a', name: 'Sage Nomad #009', before: '1.69', after: '1.89' },
      { lineId: 'b', name: 'nft_b', before: '1.19', after: '1.19' },
      { lineId: 'c', name: 'nft_c', before: '0.5', after: null },
      { lineId: 'd', name: 'nft_d', before: null, after: '2' },
    ])
    expect(changedLines(before, before, {})).toEqual([])
  })

  it('isUnchangedQuote: a renewed quote with the same lines and total needs no new confirmation', () => {
    const before = quote([['a', '1.69', 1]], '1.706')
    expect(isUnchangedQuote(before, { ...before, quoteId: 'qt_new', expiresAt: '2026-11-11T13:00:00.000Z' })).toBe(true)
    expect(isUnchangedQuote(before, quote([['a', '1.79', 1]], '1.806'))).toBe(false)
    expect(isUnchangedQuote(before, { ...before, total: '1.707' })).toBe(false)
  })
})
