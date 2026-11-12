import { isAxiosError, isCancel } from 'axios'
import { apiErrorBodySchema, type ApiErrorCode } from '@/shared/contracts'

// NETWORK, TIMEOUT and INVALID_RESPONSE are client-only; they never come from the server enum.
export type ApiErrorKind = ApiErrorCode | 'NETWORK' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'CANCELED'

export interface ApiErrorInit {
  status: number
  code: ApiErrorKind
  message: string
  fieldErrors?: Record<string, string[]>
  details?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorKind
  readonly fieldErrors?: Record<string, string[]>
  readonly details?: unknown
  readonly isTransient: boolean

  constructor(init: ApiErrorInit) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fieldErrors = init.fieldErrors
    this.details = init.details
    this.isTransient =
      init.code === 'NETWORK' || init.code === 'TIMEOUT' || init.code === 'TRANSIENT' || init.status >= 500
  }
}

// Used when the server answered without a contract-shaped error body (proxy pages, etc.).
function fallbackCode(status: number): ApiErrorKind {
  if (status >= 500 || status === 408 || status === 429) return 'TRANSIENT'
  if (status === 401) return 'UNAUTHENTICATED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  return 'VALIDATION_ERROR'
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e

  // Cancellations are never transient so they are not retried.
  if (isCancel(e)) return new ApiError({ status: 0, code: 'CANCELED', message: 'Requisição cancelada.' })

  if (isAxiosError(e)) {
    if (!e.response) {
      const timedOut = e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT'
      return new ApiError({
        status: 0,
        code: timedOut ? 'TIMEOUT' : 'NETWORK',
        message: timedOut ? 'A requisição demorou demais.' : 'Não foi possível conectar ao servidor.',
      })
    }
    const { status, data } = e.response
    const parsed = apiErrorBodySchema.safeParse(data)
    if (parsed.success) {
      const { code, message, fieldErrors, details } = parsed.data.error
      return new ApiError({ status, code, message, fieldErrors, details })
    }
    return new ApiError({
      status,
      code: fallbackCode(status),
      message: e.message,
    })
  }

  return new ApiError({
    status: 0,
    code: 'INVALID_RESPONSE',
    message: e instanceof Error ? e.message : 'Erro desconhecido.',
  })
}

/** Second line of a load-error state: the connection only when the request never reached the server. */
export function loadErrorHint(e: unknown): string {
  const { code } = toApiError(e)
  return code === 'NETWORK' || code === 'TIMEOUT'
    ? 'Verifique sua conexão e tente novamente.'
    : 'O serviço está instável no momento. Tente novamente em instantes.'
}
