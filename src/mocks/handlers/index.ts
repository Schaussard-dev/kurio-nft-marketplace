import { authHandlers } from './auth'
import { favoriteHandlers } from './favorites'
import { mockControlHandlers } from './mock-control'
import { nftHandlers } from './nfts'

export const handlers = [...mockControlHandlers, ...authHandlers, ...nftHandlers, ...favoriteHandlers]
