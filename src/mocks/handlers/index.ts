import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { favoriteHandlers } from './favorites'
import { mockControlHandlers } from './mock-control'
import { nftHandlers } from './nfts'
import { quoteHandlers } from './quote'

export const handlers = [
  ...mockControlHandlers,
  ...authHandlers,
  ...nftHandlers,
  ...favoriteHandlers,
  ...cartHandlers,
  ...quoteHandlers,
]
