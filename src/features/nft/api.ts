import { request } from '@/shared/api/http'
import { nftDetailSchema, type NftDetail } from '@/shared/contracts'

/** `GET /nfts/:id` → detail with editions and reviews; 404 NOT_FOUND for an unknown id. */
export function fetchNft(nftId: string, signal?: AbortSignal): Promise<NftDetail> {
  return request({ url: `/nfts/${encodeURIComponent(nftId)}`, method: 'GET', signal }, nftDetailSchema)
}
