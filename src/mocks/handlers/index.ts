import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { favoriteHandlers } from './favorites'
import { mockControlHandlers } from './mock-control'
import { nftHandlers } from './nfts'
import { profileHandlers } from './profile'
import { quoteHandlers } from './quote'
import { walletHandlers } from './wallets'

export const handlers = [
  ...mockControlHandlers,
  ...authHandlers,
  ...nftHandlers,
  ...favoriteHandlers,
  ...cartHandlers,
  ...quoteHandlers,
  ...profileHandlers,
  ...walletHandlers,
]
