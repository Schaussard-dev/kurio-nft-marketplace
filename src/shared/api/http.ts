import axios, { isCancel, type AxiosRequestConfig } from 'axios'
import type { ZodType } from 'zod'
import { ApiError, toApiError } from './api-error'
import { getGuestCartId, sessionStore } from './session-storage'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** The caller handles its own 401 (session check, logout): the global expiry handler is not called. */
    skipSessionExpiry?: boolean
  }
}

export const http = axios.create({
  // Same-origin /api unless overridden (mock worker and real API share the path).
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10_000,
})

let sessionExpiredHandler: ((reason: 'expired') => void) | null = null

export function setSessionExpiredHandler(fn: ((reason: 'expired') => void) | null): void {
  sessionExpiredHandler = fn
}

http.interceptors.request.use((config) => {
  const session = sessionStore.get()
  if (session) config.headers.set('Authorization', `Bearer ${session.token}`)
  config.headers.set('X-Cart-Id', getGuestCartId())
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    // Cancellations must reach TanStack Query untouched.
    if (isCancel(error)) return Promise.reject(error)
    const apiError = toApiError(error)
    const sentAuth = axios.isAxiosError(error) ? error.config?.headers?.get('Authorization') : undefined
    const current = sessionStore.get()
    // A 401 for a token that is no longer the current one (replaced by a login here or in another
    // tab) must not end the newer session.
    const sentCurrentToken = current !== null && sentAuth === `Bearer ${current.token}`
    const skip = axios.isAxiosError(error) && error.config?.skipSessionExpiry === true
    if (
      sentCurrentToken &&
      !skip &&
      apiError.status === 401 &&
      (apiError.code === 'SESSION_EXPIRED' || apiError.code === 'UNAUTHENTICATED')
    ) {
      sessionExpiredHandler?.('expired')
    }
    return Promise.reject(apiError)
  },
)

export async function request<T>(config: AxiosRequestConfig, schema: ZodType<T>): Promise<T> {
  const response = await http.request<unknown>(config)
  const parsed = schema.safeParse(response.data)
  if (!parsed.success) {
    // Issue paths only: response payloads may carry user data.
    throw new ApiError({
      status: response.status,
      code: 'INVALID_RESPONSE',
      message: 'Resposta inesperada do servidor.',
      details: parsed.error.issues.map((issue) => issue.path.join('.')),
    })
  }
  return parsed.data
}
