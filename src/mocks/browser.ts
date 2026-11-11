import { setupWorker } from 'msw/browser'
import { consumeBootParams, getMockConfig } from './config'
import { initDb, resetDb } from './db/store'
import { handlers } from './handlers'
import { registerAuthMockActions } from './handlers/auth'
import { registerRealtimeMockActions } from './realtime/actions'
import { bootScheduler } from './realtime/order-scheduler'
import { createSocketHandler } from './realtime/server'

export async function startMocks(): Promise<void> {
  const { reset } = consumeBootParams()
  await initDb()
  if (reset) await resetDb(getMockConfig().scenario)
  registerRealtimeMockActions()
  registerAuthMockActions()
  await setupWorker(...handlers, createSocketHandler()).start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
    quiet: true,
  })
  // After the worker is up: resolving emits through the socket server, and due orders resolve at once.
  bootScheduler()
}
