import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import type { CatalogQuery } from '@/shared/contracts'
import { fetchCatalog } from './api'

export function catalogQueryOptions(params: Partial<CatalogQuery>) {
  return queryOptions({
    queryKey: queryKeys.nfts(params),
    queryFn: ({ signal }) => fetchCatalog(params, signal),
    placeholderData: keepPreviousData,
  })
}
