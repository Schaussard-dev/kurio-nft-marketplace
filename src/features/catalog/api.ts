import { request } from '@/shared/api/http'
import { catalogResponseSchema, type CatalogQuery, type CatalogResponse } from '@/shared/contracts'

/** `GET /nfts`; arrays travel as repeated params (`networks=a&networks=b`). */
export function fetchCatalog(params: Partial<CatalogQuery>, signal?: AbortSignal): Promise<CatalogResponse> {
  return request(
    { url: '/nfts', method: 'GET', params, paramsSerializer: { indexes: null }, signal },
    catalogResponseSchema,
  )
}
