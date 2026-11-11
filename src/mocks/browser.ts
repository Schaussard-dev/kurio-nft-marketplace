import { setupWorker } from 'msw/browser'
import { consumeBootParams, getMockConfig } from './config'
import { initDb, resetDb } from './db/store'
import { handlers } from './handlers'

export async function startMocks(): Promise<void> {
  const { reset } = consumeBootParams()
  await initDb()
  if (reset) await resetDb(getMockConfig().scenario)
  await setupWorker(...handlers).start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
    quiet: true,
  })
}
