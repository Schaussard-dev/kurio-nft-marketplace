import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/app/query-client'
import { getGuestCartId, peekGuestCartId } from '@/shared/api/session-storage'
import type { Cart, MergeCartResult, Session } from '@/shared/contracts'

const mergeGuestCart = vi.fn<(guestCartId: string) => Promise<MergeCartResult>>()
vi.mock('./api', () => ({ mergeGuestCart: (id: string) => mergeGuestCart(id) }))
const toast = vi.hoisted(() => Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const { describeAdjustments, mergeGuestCartAfterSignIn } = await import('./merge')

const session = (token: string): Session => ({
  token,
  expiresAt: '2026-11-11T13:00:00.000Z',
  user: { id: 'usr_ana', username: 'ana', email: 'ana@kurio.dev', displayName: 'Ana Souza', avatarUrl: null },
})

const userCart: Cart = { id: 'crt_usr_ana', owner: { type: 'user', id: 'usr_ana' }, lines: [], version: 2 }

describe('mergeGuestCartAfterSignIn', () => {
  beforeEach(() => {
    mergeGuestCart.mockReset()
    toast.warning.mockReset()
    toast.error.mockReset()
  })

  it('merges once per sign-in, stores the user cart, drops the guest cart and resets the guest id', async () => {
    const qc = new QueryClient()
    const guestId = getGuestCartId()
    qc.setQueryData(queryKeys.guestCart(guestId), { ...userCart, owner: { type: 'guest', id: guestId } })
    mergeGuestCart.mockResolvedValue({ cart: userCart, adjustments: [] })

    await mergeGuestCartAfterSignIn(qc, session('tok-1'))
    await mergeGuestCartAfterSignIn(qc, session('tok-1'))

    expect(mergeGuestCart).toHaveBeenCalledTimes(1)
    expect(mergeGuestCart).toHaveBeenCalledWith(guestId)
    expect(qc.getQueryData(queryKeys.user('usr_ana').cart())).toEqual(userCart)
    expect(qc.getQueryData(queryKeys.guestCart(guestId))).toBeUndefined()
    expect(peekGuestCartId()).toBeNull()
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('lists stock adjustments in a toast', async () => {
    const qc = new QueryClient()
    getGuestCartId()
    mergeGuestCart.mockResolvedValue({
      cart: userCart,
      adjustments: [{ lineId: 'ln_1', nftId: 'nft_042', name: 'Emerald Ape #042', requested: 10, applied: 3, reason: 'stock' }],
    })
    await mergeGuestCartAfterSignIn(qc, session('tok-2'))
    expect(toast.warning).toHaveBeenCalledTimes(1)
    const [title, options] = toast.warning.mock.calls[0]!
    expect(title).toBe('Carrinho ajustado ao estoque disponível')
    expect(options.description).toBe('Emerald Ape #042: 10 → 3')
  })

  it('keeps the guest id and reports when the merge fails', async () => {
    const qc = new QueryClient()
    const guestId = getGuestCartId()
    mergeGuestCart.mockRejectedValue(new Error('boom'))
    await mergeGuestCartAfterSignIn(qc, session('tok-3'))
    expect(peekGuestCartId()).toBe(guestId)
    expect(toast.error).toHaveBeenCalled()
  })

  it('does nothing without a guest cart id', async () => {
    const qc = new QueryClient()
    getGuestCartId()
    mergeGuestCart.mockResolvedValue({ cart: userCart, adjustments: [] })
    await mergeGuestCartAfterSignIn(qc, session('tok-4'))
    mergeGuestCart.mockClear()
    await mergeGuestCartAfterSignIn(qc, session('tok-5'))
    expect(mergeGuestCart).not.toHaveBeenCalled()
  })
})

describe('describeAdjustments', () => {
  it('says when a line was removed because it sold out', () => {
    expect(
      describeAdjustments([
        { lineId: 'a', nftId: 'n1', name: 'Sage Nomad #009', requested: 2, applied: 0, reason: 'stock' },
        { lineId: 'b', nftId: 'n2', name: 'Emerald Ape #042', requested: 5, applied: 4, reason: 'stock' },
      ]),
    ).toBe('Sage Nomad #009: esgotado, removido · Emerald Ape #042: 5 → 4')
  })
})
