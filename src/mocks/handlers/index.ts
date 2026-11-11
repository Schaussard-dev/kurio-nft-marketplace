import { mockControlHandlers } from './mock-control'
import { nftHandlers } from './nfts'

export const handlers = [...mockControlHandlers, ...nftHandlers]
