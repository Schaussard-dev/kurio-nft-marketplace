import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { queryKeys } from '@/app/query-client'
import { nftQueryOptions } from '@/features/nft/queries'
import { defaultEdition } from '@/features/nft/quantity'
import { toApiError } from '@/shared/api/api-error'
import type { AddCartItemInput, Cart, Network, NftSummary } from '@/shared/contracts'
import { addCartItem, fetchCart, fetchQuote, removeCartLine, updateCartLine } from './api'
import { cartItemCount, outOfStockMessage, setLineQuantity } from './cache'
import { cartQueryKey, cartScopeId, useCartScope, useSessionVerified, type CartScope } from './cart-scope'

export const ADDED_MESSAGE = 'Adicionado ao carrinho'
export const ADD_ERROR = 'Não foi possível adicionar ao carrinho. Tente novamente.'
export const UPDATE_ERROR = 'Não foi possível atualizar a quantidade. Tente novamente.'
export const REMOVE_ERROR = 'Não foi possível remover o item. Tente novamente.'

/** Network the cart is quoted on; checkout lets the collector pick another one. */
export const CART_NETWORK: Network = 'ethereum'

export const CART_MUTATION_KEY = ['cart', 'mutation'] as const

/** Carts and quotes are always revalidated (spec §8: staleTime 0, gcTime 5 min, refetch on focus). */
export function cartQueryOptions(scope: CartScope) {
  return queryOptions({
    queryKey: cartQueryKey(scope),
    queryFn: ({ signal }) => fetchCart(signal),
    staleTime: 0,
    gcTime: 300_000,
    refetchOnWindowFocus: true,
  })
}

export function useCart() {
  const verified = useSessionVerified()
  return useQuery({ ...cartQueryOptions(useCartScope()), enabled: verified })
}

/** Badge count for the header and tab bar. */
export function useCartCount(): number {
  return cartItemCount(useCart().data)
}

/** Message for an add/update refused by the API (stock limit or generic). */
function cartErrorMessage(error: unknown, fallback: string): string {
  const apiError = toApiError(error)
  if (apiError.code === 'OUT_OF_STOCK') {
    const max = (apiError.details as { max?: unknown } | undefined)?.max
    return typeof max === 'number' ? outOfStockMessage(max) : apiError.message
  }
  return fallback
}

/** Settles the cart after the last pending cart mutation, so in-flight optimistic values never flash back. */
function useSettleCart() {
  const queryClient = useQueryClient()
  return async (key: readonly unknown[]) => {
    if (queryClient.isMutating({ mutationKey: CART_MUTATION_KEY }) <= 1) await queryClient.invalidateQueries({ queryKey: key })
  }
}

/** Adds an NFT edition. Errors (e.g. "Apenas N disponíveis") are toasted here; callers handle success. */
export function useAddToCart() {
  const queryClient = useQueryClient()
  const scope = useCartScope()
  const key = cartQueryKey(scope)
  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    mutationFn: (input: AddCartItemInput) => addCartItem(input),
    onSuccess: (cart) => queryClient.setQueryData<Cart>(key, cart),
    onError: (error) => toast.error(cartErrorMessage(error, ADD_ERROR)),
  })
}

/**
 * Runs at most one task per key at a time. The guard is a ref, so even two clicks in the same frame
 * (double click, before React re-renders) start one task; `isPending` drives aria-busy.
 */
function useInFlightKeys() {
  const running = useRef(new Set<string>())
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set())
  const sync = () => setPending(new Set(running.current))
  const run = async (key: string, task: () => Promise<unknown>): Promise<boolean> => {
    if (running.current.has(key)) return false
    running.current.add(key)
    sync()
    try {
      await task()
      return true
    } catch {
      return false // the task reports its own errors
    } finally {
      running.current.delete(key)
      sync()
    }
  }
  return { run, isPending: (key: string) => pending.has(key) }
}

/**
 * Add with a per-NFT in-flight guard: repeated clicks while a request runs add once. `add` resolves to
 * true when the item was added (errors are toasted by useAddToCart).
 */
export function useGuardedAddToCart() {
  const add = useAddToCart()
  const { run, isPending } = useInFlightKeys()
  return {
    add: (input: AddCartItemInput) => run(input.nftId, () => add.mutateAsync(input)),
    isAdding: isPending,
  }
}

/**
 * Catalog card action: the card only knows the summary, so the detail (editions) is read from the
 * API to pick the default edition, then one unit is added. The page stays where it is; a second
 * click while the first is in flight is ignored (one item, one toast).
 */
export function useQuickAddToCart() {
  const queryClient = useQueryClient()
  const add = useAddToCart()
  const { run, isPending } = useInFlightKeys()

  const quickAdd = (nft: NftSummary) =>
    run(nft.id, async () => {
      let editionId: string | undefined
      try {
        const detail = await queryClient.fetchQuery(nftQueryOptions(nft.id))
        const edition = defaultEdition(detail.editions)
        editionId = edition && edition.available > 0 ? edition.id : undefined
      } catch {
        toast.error(ADD_ERROR)
        return
      }
      if (!editionId) {
        toast.error(`${nft.name} está esgotado`)
        return
      }
      await add.mutateAsync({ nftId: nft.id, editionId, quantity: 1 })
      toast.success(ADDED_MESSAGE)
    })

  return { quickAdd, isAdding: (nft: NftSummary) => isPending(nft.id) }
}

interface LineChange {
  lineId: string
  quantity: number
}

/**
 * Optimistic quantity change (spec §8). Changes of one line run in order (mutation scope); a failure
 * reverts only that line (other lines may be changing meanwhile) and keeps the reason in `error`.
 */
export function useUpdateCartLine(lineId: string) {
  const queryClient = useQueryClient()
  const key = cartQueryKey(useCartScope())
  const settle = useSettleCart()
  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    scope: { id: `cart-line:${lineId}` },
    mutationFn: ({ quantity }: LineChange) => updateCartLine(lineId, quantity),
    onMutate: async ({ quantity }: LineChange) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Cart>(key)?.lines.find((line) => line.lineId === lineId)?.quantity
      queryClient.setQueryData<Cart>(key, (cart) => setLineQuantity(cart, lineId, quantity))
      return { previous }
    },
    onError: (_error, { quantity }, context) => {
      const previous = context?.previous
      // Only undo if nothing newer replaced the optimistic value.
      queryClient.setQueryData<Cart>(key, (cart) => {
        const current = cart?.lines.find((line) => line.lineId === lineId)?.quantity
        return previous !== undefined && current === quantity ? setLineQuantity(cart, lineId, previous) : cart
      })
    },
    onSettled: () => settle(key),
  })
}

export function updateErrorMessage(error: unknown): string {
  return cartErrorMessage(error, UPDATE_ERROR)
}

export function useRemoveCartLine() {
  const queryClient = useQueryClient()
  const key = cartQueryKey(useCartScope())
  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    mutationFn: (lineId: string) => removeCartLine(lineId),
    onSuccess: async (cart) => {
      await queryClient.cancelQueries({ queryKey: key })
      queryClient.setQueryData<Cart>(key, cart)
    },
    onError: () => toast.error(REMOVE_ERROR),
  })
}

export interface QuoteParams {
  coupon?: string
  network: Network
}

/**
 * Summary of the current cart from `POST /quote` (all money strings come from the API). The key carries
 * the cart version, so any cart change asks for a new quote; the previous one stays on screen meanwhile.
 */
export function useQuote({ coupon, network }: QuoteParams, { enabled = true }: { enabled?: boolean } = {}) {
  const scope = useCartScope()
  const cart = useCart().data
  const input = { coupon: coupon || undefined, network }
  return useQuery({
    queryKey: queryKeys.quote(cartScopeId(scope), { ...input, version: cart?.version }),
    queryFn: ({ signal }) => fetchQuote(input, signal),
    enabled: enabled && Boolean(cart && cart.lines.length > 0),
    staleTime: 0,
    gcTime: 300_000,
    placeholderData: keepPreviousData,
  })
}
