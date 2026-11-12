import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'
import type { Network } from './common'
import type { ArtKey } from '@/features/catalog/art'
import {
  addCartItemInputSchema,
  apiErrorBodySchema,
  apiErrorCodeSchema,
  artKeySchema,
  avatarInputSchema,
  cartSchema,
  catalogQuerySchema,
  catalogResponseSchema,
  changePasswordInputSchema,
  createOrderInputSchema,
  editionSchema,
  ethStringSchema,
  eventEnvelopeSchema,
  loginInputSchema,
  networkSchema,
  nftDetailSchema,
  nftSummarySchema,
  nftUpdatedDataSchema,
  orderSchema,
  orderUpdatedDataSchema,
  paginatedSchema,
  quoteSchema,
  registerInputSchema,
  sessionSchema,
  walletInputSchema,
  walletSchema,
  walletsResponseSchema,
} from './index'

const NOW = '2026-11-11T12:00:00.000Z'

const summary = {
  id: 'nft-1',
  tokenNumber: 42,
  name: 'Genesis',
  art: 'emerald',
  price: '1.5',
  previousPrice: null,
  rare: true,
  category: 'arte',
  network: 'ethereum',
  collection: 'Kurio',
  createdAt: NOW,
  trendingScore: 10,
  version: 1,
}
const edition = { id: 'e1', label: '1/10', available: 3, maxPerOrder: 2 }
const evmAddress = `0x${'a'.repeat(40)}`
const solAddress = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'
const wallet = {
  id: 'w1',
  slot: 'primary',
  displayName: 'Ana',
  nickname: 'main',
  network: 'ethereum',
  profileName: 'ana',
  address: evmAddress,
  walletType: 'metamask',
  referralCode: 'REF1',
  email: 'ana@kurio.dev',
  ensName: 'ana.eth',
  sameAsPrimary: false,
}
const order = {
  id: 'o1',
  status: 'pending',
  version: 1,
  createdAt: NOW,
  resolvedAt: null,
  declineReason: null,
  txHash: '0xabc',
  explorerUrl: 'https://etherscan.io/tx/0xabc',
  idempotencyKey: 'key-1',
  snapshot: {
    lines: [
      {
        nftId: 'nft-1',
        name: 'Genesis',
        art: 'sage',
        tokenNumber: 42,
        editionId: 'ed-1',
        editionLabel: '1/10',
        unitPrice: '1.5',
        quantity: 2,
        lineTotal: '3',
      },
    ],
    subtotal: '3',
    discount: '0',
    networkFee: '0.016',
    total: '3.016',
    walletLabel: 'MetaMask',
    connector: 'metamask',
    network: 'ethereum',
  },
}

describe('common', () => {
  it('ethStringSchema accepts decimals and rejects junk', () => {
    expect(ethStringSchema.safeParse('1.25').success).toBe(true)
    expect(ethStringSchema.safeParse('1,25').success).toBe(false)
    expect(ethStringSchema.safeParse('-1').success).toBe(false)
  })

  it('networkSchema is the three networks', () => {
    expect(networkSchema.options).toEqual(['ethereum', 'polygon', 'solana'])
  })

  it('artKeySchema matches ArtKey from art.ts', () => {
    expectTypeOf<z.infer<typeof artKeySchema>>().toEqualTypeOf<ArtKey>()
    expect(artKeySchema.safeParse('golden').success).toBe(true)
    expect(artKeySchema.safeParse('pink').success).toBe(false)
  })

  it('paginatedSchema wraps items', () => {
    const schema = paginatedSchema(editionSchema)
    const page = { page: 1, pageSize: 12, total: 1, totalPages: 1 }
    expect(schema.safeParse({ items: [edition], ...page }).success).toBe(true)
    expect(schema.safeParse({ items: [{}], ...page }).success).toBe(false)
  })
})

describe('errors', () => {
  it('accepts fieldErrors and rejects unknown codes', () => {
    const ok = apiErrorBodySchema.safeParse({
      error: { code: 'VALIDATION_ERROR', message: 'x', fieldErrors: { email: ['inválido'] } },
    })
    expect(ok.success).toBe(true)
    expect(apiErrorCodeSchema.options).toHaveLength(15)
    expect(apiErrorBodySchema.safeParse({ error: { code: 'NOPE', message: 'x' } }).success).toBe(false)
  })
})

describe('auth', () => {
  const valid = { username: 'ana_01', email: 'ana@kurio.dev', password: 'Kurio@2026', confirmPassword: 'Kurio@2026' }

  it('accepts a valid registration', () => {
    expect(registerInputSchema.safeParse(valid).success).toBe(true)
  })

  it('fails on confirmPassword mismatch with that path', () => {
    const r = registerInputSchema.safeParse({ ...valid, confirmPassword: 'Other@2026' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path).toEqual(['confirmPassword'])
    expect(r.error?.issues[0].message).toBe('As senhas não coincidem')
  })

  it('validates username rules', () => {
    expect(registerInputSchema.safeParse({ ...valid, username: 'Ab' }).success).toBe(false)
    expect(registerInputSchema.safeParse({ ...valid, username: 'UPPER' }).success).toBe(false)
    expect(registerInputSchema.safeParse({ ...valid, username: 'a'.repeat(21) }).success).toBe(false)
  })

  it.each(['Sh1!', 'kurio@2026', 'Kurio@abcd', 'Kurio2026x'])('rejects weak password %s', (password) => {
    expect(registerInputSchema.safeParse({ ...valid, password, confirmPassword: password }).success).toBe(false)
  })

  it('login and session', () => {
    expect(loginInputSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false)
    expect(loginInputSchema.safeParse({ email: 'ana@kurio.dev', password: 'x' }).success).toBe(true)
    expect(
      sessionSchema.safeParse({
        token: 't',
        expiresAt: NOW,
        user: { id: '1', username: 'ana', email: 'ana@kurio.dev', displayName: 'Ana', avatarUrl: null },
      }).success,
    ).toBe(true)
  })
})

describe('nft', () => {
  it('edition labels', () => {
    expect(editionSchema.safeParse(edition).success).toBe(true)
    expect(editionSchema.safeParse({ ...edition, label: '1/2' }).success).toBe(false)
    expect(editionSchema.safeParse({ ...edition, maxPerOrder: 0 }).success).toBe(false)
  })

  it('summary and detail', () => {
    expect(nftSummarySchema.safeParse(summary).success).toBe(true)
    expect(nftSummarySchema.safeParse({ ...summary, price: 'abc' }).success).toBe(false)
    const detail = {
      ...summary,
      description: 'd',
      longDescription: 'ld',
      attributes: ['a'],
      contractAddress: evmAddress,
      rating: 4.5,
      reviewCount: 3,
      editions: [edition],
      gallery: ['emerald', 'ivory'],
      reviews: [{ id: 'r1', author: 'Ana', rating: 5, comment: 'ótimo', createdAt: NOW }],
    }
    expect(nftDetailSchema.safeParse(detail).success).toBe(true)
    const withoutReviews: Record<string, unknown> = { ...detail }
    delete withoutReviews.reviews
    expect(nftDetailSchema.safeParse(withoutReviews).success).toBe(false)
  })

  it('catalogQuerySchema defaults', () => {
    expect(catalogQuerySchema.parse({})).toEqual({ tab: 'all', sort: 'recent', page: 1 })
  })

  it('catalogQuerySchema normalizes arrays and coerces page', () => {
    const r = catalogQuerySchema.parse({ categories: 'arte', networks: ['ethereum', 'solana'], page: '2', minPrice: '0.5' })
    expect(r.categories).toEqual(['arte'])
    expect(r.networks).toEqual(['ethereum', 'solana'])
    expect(r.page).toBe(2)
    expect(r.minPrice).toBe('0.5')
    expect(catalogQuerySchema.safeParse({ page: '0' }).success).toBe(false)
    expect(catalogQuerySchema.safeParse({ networks: 'bitcoin' }).success).toBe(false)
  })

  it('catalogQuerySchema pageSize is optional, coerced and bounded', () => {
    expect(catalogQuerySchema.parse({ pageSize: '12' }).pageSize).toBe(12)
    expect(catalogQuerySchema.safeParse({ pageSize: '0' }).success).toBe(false)
    expect(catalogQuerySchema.safeParse({ pageSize: '49' }).success).toBe(false)
  })

  it('catalogQuerySchema input type is precise for router validateSearch', () => {
    type Input = z.input<typeof catalogQuerySchema>
    expectTypeOf<Input['networks']>().toEqualTypeOf<Network | Network[] | undefined>()
    expectTypeOf<Input['categories']>().toEqualTypeOf<string | string[] | undefined>()
  })

  it('catalogResponseSchema', () => {
    expect(
      catalogResponseSchema.safeParse({
        items: [summary],
        page: 1,
        pageSize: 12,
        total: 1,
        totalPages: 1,
        facets: {
          categories: [{ id: 'arte', label: 'Arte', count: 1 }],
          networks: [{ id: 'ethereum', count: 1 }],
          priceRange: { min: '0.1', max: '9' },
        },
      }).success,
    ).toBe(true)
  })
})

describe('cart and quote', () => {
  const line = { lineId: 'l1', nftId: 'nft-1', editionId: 'e1', quantity: 2, nft: summary, edition }

  it('cartSchema', () => {
    expect(cartSchema.safeParse({ id: 'c1', owner: { type: 'guest', id: 'g1' }, lines: [line], version: 1 }).success).toBe(true)
    expect(cartSchema.safeParse({ id: 'c1', owner: { type: 'admin', id: 'g1' }, lines: [], version: 1 }).success).toBe(false)
  })

  it('addCartItemInputSchema requires integer quantity >= 1', () => {
    expect(addCartItemInputSchema.safeParse({ nftId: 'n', editionId: 'e', quantity: 1 }).success).toBe(true)
    expect(addCartItemInputSchema.safeParse({ nftId: 'n', editionId: 'e', quantity: 1.5 }).success).toBe(false)
  })

  it('quoteSchema', () => {
    const quote = {
      quoteId: 'q1',
      lines: [{ lineId: 'l1', nftId: 'n', editionId: 'e', unitPrice: '1.5', quantity: 2, lineTotal: '3', available: 5 }],
      subtotal: '3',
      discount: '0.3',
      networkFee: '0.016',
      total: '2.716',
      coupon: { code: 'KURIO10', percent: 10 },
      network: 'ethereum',
      expiresAt: NOW,
      fingerprint: 'abc',
    }
    expect(quoteSchema.safeParse(quote).success).toBe(true)
    expect(quoteSchema.safeParse({ ...quote, coupon: null }).success).toBe(true)
    expect(quoteSchema.safeParse({ ...quote, total: 'x' }).success).toBe(false)
  })
})

describe('orders', () => {
  it('orderSchema', () => {
    expect(orderSchema.safeParse(order).success).toBe(true)
    expect(orderSchema.safeParse({ ...order, status: 'done' }).success).toBe(false)
    expect(orderSchema.safeParse({ ...order, explorerUrl: 'javascript:alert(1)' }).success).toBe(false)
    expect(orderSchema.safeParse({ ...order, explorerUrl: 'ftp://etherscan.io/tx/0xabc' }).success).toBe(false)
    expect(orderSchema.safeParse({ ...order, explorerUrl: 'tx/0xabc' }).success).toBe(false)
  })

  it('createOrderInputSchema', () => {
    const payer = {
      displayName: 'Ana',
      username: 'ana',
      profileName: 'Ana',
      email: 'ana@kurio.dev',
      referralCode: 'R',
      walletAddress: evmAddress,
    }
    const base = { quoteId: 'q', connector: 'coinbase', walletId: null, network: 'polygon' }
    expect(createOrderInputSchema.safeParse({ ...base, payer }).success).toBe(true)
    expect(createOrderInputSchema.safeParse({ ...base, connector: 'phantom', payer }).success).toBe(false)
    expect(createOrderInputSchema.safeParse({ ...base, payer: { ...payer, email: 'x' } }).success).toBe(false)
  })
})

describe('profile', () => {
  it('changePasswordInputSchema checks match and strength', () => {
    const ok = { currentPassword: 'Old@2026x', newPassword: 'New@2026x', confirmPassword: 'New@2026x' }
    expect(changePasswordInputSchema.safeParse(ok).success).toBe(true)
    const bad = changePasswordInputSchema.safeParse({ ...ok, confirmPassword: 'zzz' })
    expect(bad.error?.issues[0].path).toEqual(['confirmPassword'])
    expect(changePasswordInputSchema.safeParse({ ...ok, newPassword: 'weak', confirmPassword: 'weak' }).success).toBe(false)
  })

  it('avatarInputSchema restricts mime and size', () => {
    expect(avatarInputSchema.safeParse({ dataUrl: 'data:image/png;base64,AAAA' }).success).toBe(true)
    expect(avatarInputSchema.safeParse({ dataUrl: 'data:image/gif;base64,AAAA' }).success).toBe(false)
    expect(avatarInputSchema.safeParse({ dataUrl: `data:image/png;base64,${'A'.repeat(400_000)}` }).success).toBe(false)
  })
})

describe('wallets', () => {
  it('accepts valid EVM and solana wallets', () => {
    expect(walletSchema.safeParse(wallet).success).toBe(true)
    expect(walletSchema.safeParse({ ...wallet, network: 'solana', address: solAddress }).success).toBe(true)
  })

  it('solana wallet with 0x address fails on address', () => {
    const r = walletSchema.safeParse({ ...wallet, network: 'solana' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path).toEqual(['address'])
  })

  it('EVM wallet with base58 address fails', () => {
    expect(walletSchema.safeParse({ ...wallet, address: solAddress }).success).toBe(false)
  })

  it('validates secondaryAddress against the network too', () => {
    const r = walletSchema.safeParse({ ...wallet, secondaryAddress: solAddress })
    expect(r.error?.issues[0].path).toEqual(['secondaryAddress'])
  })

  it('walletInputSchema omits id and slot but keeps the rule', () => {
    const input: Record<string, unknown> = { ...wallet }
    delete input.id
    delete input.slot
    expect(walletInputSchema.safeParse(input).success).toBe(true)
    const r = walletInputSchema.safeParse({ ...input, network: 'solana' })
    expect(r.error?.issues[0].path).toEqual(['address'])
  })

  it('walletsResponseSchema allows nulls', () => {
    expect(walletsResponseSchema.safeParse({ primary: wallet, secondary: null }).success).toBe(true)
  })
})

describe('events', () => {
  it('eventEnvelopeSchema', () => {
    const env = {
      eventId: 'ev1',
      type: 'nft.updated',
      resource: { type: 'nft', id: 'nft-1' },
      version: 2,
      occurredAt: NOW,
      userId: null,
      data: { anything: true },
    }
    expect(eventEnvelopeSchema.safeParse(env).success).toBe(true)
    expect(eventEnvelopeSchema.safeParse({ ...env, type: 'other' }).success).toBe(false)
  })

  it('event data payloads', () => {
    expect(
      nftUpdatedDataSchema.safeParse({ price: '2', previousPrice: '1.5', editions: [{ id: 'e1', available: 0 }] }).success,
    ).toBe(true)
    expect(orderUpdatedDataSchema.safeParse({ status: 'confirmed', order }).success).toBe(true)
  })
})
