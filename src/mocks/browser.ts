import { setupWorker } from 'msw/browser'
import { consumeBootParams, getMockConfig } from './config'
import { initDb, resetDb } from './db/store'
import { handlers } from './handlers'
import { registerRealtimeMockActions } from './realtime/actions'
import { createSocketHandler } from './realtime/server'

export async function startMocks(): Promise<void> {
  const { reset } = consumeBootParams()
  await initDb()
  if (reset) await resetDb(getMockConfig().scenario)
  registerRealtimeMockActions()
  await setupWorker(...handlers, createSocketHandler()).start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
    quiet: true,
  })
}
