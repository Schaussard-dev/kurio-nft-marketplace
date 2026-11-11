import { z } from 'zod'
import { request } from '@/shared/api/http'
import {
  profileSchema,
  type ChangePasswordRequest,
  type Profile,
  type UpdateProfileInput,
} from '@/shared/contracts'

export function fetchProfile(signal?: AbortSignal): Promise<Profile> {
  return request({ url: '/me', signal }, profileSchema)
}

export function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  return request({ method: 'PATCH', url: '/me', data: input }, profileSchema)
}

export function uploadAvatar(dataUrl: string): Promise<Profile> {
  return request({ method: 'PUT', url: '/me/avatar', data: { dataUrl } }, profileSchema)
}

export function deleteAvatar(): Promise<Profile> {
  return request({ method: 'DELETE', url: '/me/avatar' }, profileSchema)
}

export async function changePassword(input: ChangePasswordRequest): Promise<void> {
  await request({ method: 'POST', url: '/me/password', data: input }, z.unknown())
}
