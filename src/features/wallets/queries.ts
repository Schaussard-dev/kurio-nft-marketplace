import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { useSession } from '@/features/auth/queries'
import type { SameAsPrimaryInput, WalletInput, WalletsResponse } from '@/shared/contracts'
import { connectWallet, fetchWallets, saveWallet, type WalletSlot } from './api'

export function walletsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.user(userId).wallets(),
    queryFn: ({ signal }) => fetchWallets(signal),
  })
}

/** The signed-in user's primary/secondary wallets; idle (no request) for guests. */
export function useWallets() {
  const session = useSession()
  return useQuery({
    ...walletsQueryOptions(session?.user.id ?? ''),
    enabled: Boolean(session),
  })
}

export function useSaveWallet() {
  const queryClient = useQueryClient()
  const userId = useSession()?.user.id ?? ''
  return useMutation({
    mutationFn: ({ slot, input }: { slot: WalletSlot; input: WalletInput | SameAsPrimaryInput }) =>
      saveWallet(slot, input),
    onSuccess: (wallet) => {
      const key = queryKeys.user(userId).wallets()
      queryClient.setQueryData<WalletsResponse>(key, (old) => ({
        primary: old?.primary ?? null,
        secondary: old?.secondary ?? null,
        [wallet.slot]: wallet,
      }))
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/** Connect approval used by checkout (Task 17). */
export function useConnectWallet() {
  return useMutation({ mutationFn: connectWallet })
}
