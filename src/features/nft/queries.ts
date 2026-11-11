import { queryOptions } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { fetchNft } from './api'

/** Detail policy (spec §8): staleTime 30 s, gcTime 5 min. */
export function nftQueryOptions(nftId: string) {
  return queryOptions({
    queryKey: queryKeys.nft(nftId),
    queryFn: ({ signal }) => fetchNft(nftId, signal),
    staleTime: 30_000,
    gcTime: 300_000,
  })
}
