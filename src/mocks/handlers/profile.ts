import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import {
  avatarInputSchema,
  changePasswordRequestSchema,
  updateProfileInputSchema,
  type Profile,
} from '@/shared/contracts'
import { getDb, mutate } from '../db/store'
import { hashPassword, verifyPassword } from '../db/password'
import type { UserRecord } from '../db/schema'
import { apiError, withNetwork } from '../network'
import { requireUser } from './auth'

function toProfile(user: UserRecord): Profile {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    walletNickname: user.walletNickname,
    ensName: user.ensName,
    avatarUrl: user.avatarUrl,
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

function validationError(error: z.ZodError) {
  const { fieldErrors } = z.flattenError(error)
  return apiError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados', fieldErrors as Record<string, string[]>)
}

export const profileHandlers = [
  http.get(
    '/api/me',
    withNetwork(({ request }) => {
      const user = requireUser(request)
      if (user instanceof Response) return user
      return HttpResponse.json(toProfile(user))
    }),
  ),

  http.patch(
    '/api/me',
    withNetwork(async ({ request }) => {
      const user = requireUser(request)
      if (user instanceof Response) return user
      const parsed = updateProfileInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return validationError(parsed.error)
      const input = parsed.data
      const email = input.email.trim().toLowerCase()

      const others = getDb().users.filter((u) => u.id !== user.id)
      const fieldErrors: Record<string, string[]> = {}
      if (others.some((u) => u.email.toLowerCase() === email)) fieldErrors.email = ['E-mail já cadastrado']
      if (others.some((u) => u.username.toLowerCase() === input.username.toLowerCase())) {
        fieldErrors.username = ['Nome de usuário indisponível']
      }
      if (fieldErrors.email || fieldErrors.username) {
        const code = fieldErrors.email ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN'
        return apiError(409, code, 'Já existe uma conta com esses dados', fieldErrors)
      }

      mutate(() => {
        user.displayName = input.displayName.trim()
        user.username = input.username
        user.email = email
        user.walletNickname = input.walletNickname.trim()
        user.ensName = input.ensName.trim()
      })
      return HttpResponse.json(toProfile(user))
    }),
  ),

  http.put(
    '/api/me/avatar',
    withNetwork(async ({ request }) => {
      const user = requireUser(request)
      if (user instanceof Response) return user
      const parsed = avatarInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return validationError(parsed.error)
      mutate(() => {
        user.avatarUrl = parsed.data.dataUrl
      })
      return HttpResponse.json(toProfile(user))
    }),
  ),

  http.delete(
    '/api/me/avatar',
    withNetwork(({ request }) => {
      const user = requireUser(request)
      if (user instanceof Response) return user
      mutate(() => {
        user.avatarUrl = null
      })
      return HttpResponse.json(toProfile(user))
    }),
  ),

  http.post(
    '/api/me/password',
    withNetwork(async ({ request }) => {
      const user = requireUser(request)
      if (user instanceof Response) return user
      const parsed = changePasswordRequestSchema.safeParse(await readJson(request))
      if (!parsed.success) return validationError(parsed.error)
      if (!(await verifyPassword(parsed.data.currentPassword, user.passwordRecord))) {
        return apiError(422, 'INVALID_PASSWORD', 'Senha atual incorreta', {
          currentPassword: ['Senha atual incorreta'],
        })
      }
      const passwordRecord = await hashPassword(parsed.data.newPassword)
      mutate(() => {
        user.passwordRecord = passwordRecord
      })
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
