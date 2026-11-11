import type { ApiErrorCode } from '@/shared/contracts'
import type { MockDb } from './db/schema'

export type ScenarioName =
  | 'default'
  | 'empty'
  | 'slow'
  | 'jitter'
  | 'offline'
  | 'server-error'
  | 'favorite-fail'
  | 'session-expired'
  | 'signup-conflict'
  | 'price-change'
  | 'sold-out'
  | 'order-timeout'
  | 'payment-declined'
  | 'wallet-reject'

export interface RouteFault {
  /** HTTP method, or '*' for any. */
  method: string
  /** Pathname pattern; '*' matches any run of characters. */
  pathPattern: string
  status?: number
  error?: 'network' | 'timeout'
  code?: ApiErrorCode
}

export interface ScenarioFlags {
  sessionTtlRequests?: number
  orderOutcome?: 'confirmed' | 'declined'
  orderTimeout?: boolean
  walletReject?: boolean
  /** NFT id whose price changes between quote and order. */
  priceChangeOnQuote?: string
  /** NFT id that sells out when the order is placed. */
  soldOutOnOrder?: string
}

export interface ScenarioConfig {
  latency: { min: number; max: number }
  routeFaults?: RouteFault[]
  seedPatch?: (db: MockDb) => void
  flags?: ScenarioFlags
}

const DEFAULT_LATENCY = { min: 150, max: 400 }

export const SCENARIOS: Record<ScenarioName, ScenarioConfig> = {
  default: { latency: DEFAULT_LATENCY },
  empty: {
    latency: DEFAULT_LATENCY,
    seedPatch: (db) => {
      db.nfts = []
    },
  },
  slow: { latency: { min: 2500, max: 2500 } },
  jitter: { latency: { min: 50, max: 1500 } },
  offline: {
    latency: DEFAULT_LATENCY,
    routeFaults: [{ method: '*', pathPattern: '/api/*', error: 'network' }],
  },
  'server-error': {
    latency: DEFAULT_LATENCY,
    routeFaults: [{ method: '*', pathPattern: '/api/*', status: 503, code: 'TRANSIENT' }],
  },
  'favorite-fail': {
    latency: DEFAULT_LATENCY,
    routeFaults: [
      { method: 'PUT', pathPattern: '/api/favorites/*', status: 500, code: 'TRANSIENT' },
      { method: 'DELETE', pathPattern: '/api/favorites/*', status: 500, code: 'TRANSIENT' },
    ],
  },
  'session-expired': { latency: DEFAULT_LATENCY, flags: { sessionTtlRequests: 3 } },
  'signup-conflict': { latency: DEFAULT_LATENCY },
  'price-change': { latency: DEFAULT_LATENCY, flags: { priceChangeOnQuote: 'nft_001' } },
  'sold-out': { latency: DEFAULT_LATENCY, flags: { soldOutOnOrder: 'nft_001' } },
  'order-timeout': { latency: DEFAULT_LATENCY, flags: { orderTimeout: true } },
  'payment-declined': { latency: DEFAULT_LATENCY, flags: { orderOutcome: 'declined' } },
  'wallet-reject': { latency: DEFAULT_LATENCY, flags: { walletReject: true } },
}

export const SCENARIO_NAMES = Object.keys(SCENARIOS) as ScenarioName[]

export function isScenarioName(value: unknown): value is ScenarioName {
  return typeof value === 'string' && Object.hasOwn(SCENARIOS, value)
}
