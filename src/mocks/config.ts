import { isScenarioName, type ScenarioName } from './scenarios'

export const CONFIG_KEY = 'kurio-mock-config'

export interface MockConfig {
  scenario: ScenarioName
  /** Fixed latency in ms replacing the scenario latency; null keeps the scenario value. */
  latencyOverride: number | null
  offline: boolean
}

const DEFAULT_CONFIG: MockConfig = { scenario: 'default', latencyOverride: null, offline: false }

let memoryConfig: MockConfig | null = null

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

function sanitize(raw: unknown): MockConfig {
  const value = (raw ?? {}) as Partial<MockConfig>
  return {
    scenario: isScenarioName(value.scenario) ? value.scenario : DEFAULT_CONFIG.scenario,
    latencyOverride:
      typeof value.latencyOverride === 'number' && value.latencyOverride >= 0 ? value.latencyOverride : null,
    offline: value.offline === true,
  }
}

export function getMockConfig(): MockConfig {
  const store = sessionStore()
  if (!store) return memoryConfig ?? { ...DEFAULT_CONFIG }
  try {
    const raw = store.getItem(CONFIG_KEY)
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_CONFIG }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

/** Merges a partial update (invalid fields are ignored) and persists it. Returns the new config. */
export function setMockConfig(partial: Partial<MockConfig>): MockConfig {
  const current = getMockConfig()
  const next: MockConfig = { ...current }
  if (partial.scenario !== undefined && isScenarioName(partial.scenario)) next.scenario = partial.scenario
  if (partial.latencyOverride !== undefined) {
    next.latencyOverride =
      typeof partial.latencyOverride === 'number' && partial.latencyOverride >= 0 ? partial.latencyOverride : null
  }
  if (typeof partial.offline === 'boolean') next.offline = partial.offline
  memoryConfig = next
  try {
    sessionStore()?.setItem(CONFIG_KEY, JSON.stringify(next))
  } catch {
    // Storage may be unavailable; the in-memory copy still applies.
  }
  return next
}

export function resetMockConfig(): void {
  memoryConfig = null
  try {
    sessionStore()?.removeItem(CONFIG_KEY)
  } catch {
    // ignore
  }
}

/**
 * Reads `?scenario=` and `?reset=1` once at boot, applies the scenario to the config
 * and strips both params from the URL (other params are kept).
 */
export function consumeBootParams(): { reset: boolean } {
  if (typeof location === 'undefined') return { reset: false }
  const url = new URL(location.href)
  const scenario = url.searchParams.get('scenario')
  const reset = url.searchParams.get('reset') === '1'
  if (scenario === null && !url.searchParams.has('reset')) return { reset: false }
  if (isScenarioName(scenario)) setMockConfig({ scenario })
  url.searchParams.delete('scenario')
  url.searchParams.delete('reset')
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
  return { reset }
}
