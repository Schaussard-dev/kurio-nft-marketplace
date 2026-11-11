import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import { queryKeys } from '@/app/query-client'
import { useSession } from '@/features/auth/queries'
import type { FavoritesResponse, NftSummary } from '@/shared/contracts'
import { fetchFavorites, setFavorite } from './api'
import { applyFavorite, type FavoriteChange } from './cache'

export const FAVORITE_ERROR = 'Não foi possível atualizar seus favoritos. Tente novamente.'
const TOGGLE_KEY = ['favorites', 'toggle'] as const

export function favoritesQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.user(userId).favorites(),
    queryFn: ({ signal }) => fetchFavorites(signal),
  })
}

/** The signed-in user's favorites; idle (no request) for guests. */
export function useFavorites() {
  const session = useSession()
  const userId = session?.user.id ?? ''
  return useQuery({ ...favoritesQueryOptions(userId), enabled: Boolean(session) })
}

interface ToggleContext {
  key: readonly unknown[]
  snapshot: FavoritesResponse | undefined
}

/**
 * Optimistic toggle (spec §8): cancel the favorites query, snapshot it, write the new set; on error
 * restore the snapshot and tell the user; when the last pending toggle settles, refetch.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const session = useSession()
  return useMutation({
    mutationKey: TOGGLE_KEY,
    mutationFn: ({ nftId, favorite }: FavoriteChange) => setFavorite(nftId, favorite),
    onMutate: async (change): Promise<ToggleContext | undefined> => {
      if (!session) return undefined
      const key = queryKeys.user(session.user.id).favorites()
      await queryClient.cancelQueries({ queryKey: key })
      const snapshot = queryClient.getQueryData<FavoritesResponse>(key)
      queryClient.setQueryData<FavoritesResponse>(key, (data) => applyFavorite(data, change))
      return { key, snapshot }
    },
    onError: (_error, _change, context) => {
      if (context) queryClient.setQueryData(context.key, context.snapshot)
      toast.error(FAVORITE_ERROR)
    },
    onSettled: async (_data, _error, _change, context) => {
      // Rapid toggles: refetching while another one is in flight would flash the older server state.
      if (context && queryClient.isMutating({ mutationKey: TOGGLE_KEY }) === 1) {
        await queryClient.invalidateQueries({ queryKey: context.key })
      }
    },
  })
}

/**
 * Favorite state and toggle for any NFT. Guests are sent to /entrar and come back to the current page
 * (spec §9: "Favoritar exige login, voltando depois ao NFT").
 */
export function useFavoriteToggle() {
  const session = useSession()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const navigate = useNavigate()
  const href = useRouterState({ select: (state) => state.location.href })
  const ids = favorites.data?.nftIds

  const isFavorite = (nftId: string) => ids?.includes(nftId) ?? false
  const toggleFavorite = (nftId: string, summary?: NftSummary) => {
    if (!session) {
      void navigate({ to: '/entrar', search: { redirect: href } })
      return
    }
    toggle.mutate({ nftId, favorite: !isFavorite(nftId), summary })
  }
  return { isFavorite, toggleFavorite, ready: !session || favorites.isSuccess }
}
