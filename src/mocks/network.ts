import { HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/shared/contracts'
import { getMockConfig } from './config'
import { createRng } from './db/prng'
import { SCENARIOS, type RouteFault, type ScenarioName } from './scenarios'

const LATENCY_SEED = 0x4b555249 // "KURI"

function seedFor(scenario: ScenarioName): number {
  let hash = LATENCY_SEED
  for (const char of scenario) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
  return hash
}

let rngState: { scenario: ScenarioName; next: () => number } | null = null

/** Restarts the latency sequence of the active scenario (called on reset / scenario switch). */
export function resetLatencyRng(): void {
  rngState = null
}

/** Next latency in ms for the active scenario. Deterministic per scenario activation. */
export function nextLatency(): number {
  const { scenario, latencyOverride } = getMockConfig()
  if (latencyOverride !== null) return latencyOverride
  if (rngState?.scenario !== scenario) rngState = { scenario, next: createRng(seedFor(scenario)) }
  const { min, max } = SCENARIOS[scenario].latency
  return Math.round(min + rngState.next() * (max - min))
}

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): HttpResponse<ApiErrorBody> {
  const error: ApiErrorBody['error'] = { code, message }
  if (fieldErrors) error.fieldErrors = fieldErrors
  return HttpResponse.json({ error }, { status })
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done, { once: true })
  })
}

function patternToRegExp(pattern: string): RegExp {
  const source = pattern
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, (char) => `\\${char}`))
    .join('.*')
  return new RegExp(`^${source}$`)
}

function findFault(faults: RouteFault[] | undefined, method: string, pathname: string): RouteFault | undefined {
  return faults?.find(
    (fault) =>
      (fault.method === '*' || fault.method.toUpperCase() === method.toUpperCase()) &&
      patternToRegExp(fault.pathPattern).test(pathname),
  )
}

/** Wraps any msw http resolver with the active scenario latency and faults. Reads config on every request. */
export function withNetwork<
  Params extends PathParams = PathParams,
  RequestBody extends DefaultBodyType = DefaultBodyType,
  ResponseBody extends DefaultBodyType = undefined,
>(
  handler: HttpResponseResolver<Params, RequestBody, ResponseBody>,
): HttpResponseResolver<Params, RequestBody, ResponseBody> {
  return async (info) => {
    const { request } = info
    const config = getMockConfig()
    const latency = nextLatency()
    if (latency > 0) await wait(latency, request.signal)

    const { pathname } = new URL(request.url)
    if (config.offline) return HttpResponse.error() as never
    const fault = findFault(SCENARIOS[config.scenario].routeFaults, request.method, pathname)
    if (fault) {
      if (fault.error === 'network') return HttpResponse.error() as never
      if (fault.error === 'timeout') {
        // Never settles on its own; ends when the client gives up so nothing leaks.
        return new Promise((resolve) => {
          const end = () => resolve(HttpResponse.error() as never)
          if (request.signal.aborted) end()
          else request.signal.addEventListener('abort', end, { once: true })
        })
      }
      return apiError(
        fault.status ?? 500,
        fault.code ?? 'TRANSIENT',
        'Falha simulada pelo cenário de demonstração',
      ) as never
    }
    return handler(info)
  }
}
