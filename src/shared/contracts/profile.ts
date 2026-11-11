import { z } from 'zod'
import { passwordSchema, usernameSchema } from './auth'
import { emailSchema, requiredStringSchema } from './common'

export const profileSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  displayName: z.string(),
  walletNickname: z.string(),
  ensName: z.string(),
  avatarUrl: z.string().nullable(),
})
export type Profile = z.infer<typeof profileSchema>

export const updateProfileInputSchema = z.object({
  displayName: requiredStringSchema,
  username: usernameSchema,
  email: emailSchema,
  walletNickname: z.string(),
  ensName: z.string(),
})
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>

export const changePasswordInputSchema = z
  .object({
    currentPassword: requiredStringSchema,
    newPassword: passwordSchema,
    confirmPassword: requiredStringSchema,
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'As senhas não coincidem' })
    }
  })
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>

/** What goes over the wire: the confirmation field is client-only. */
export const changePasswordRequestSchema = z.object({
  currentPassword: requiredStringSchema,
  newPassword: passwordSchema,
})
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>

export const avatarInputSchema = z.object({
  dataUrl: z
    .string()
    .max(400_000, 'Imagem muito grande')
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Formato de imagem inválido'),
})
export type AvatarInput = z.infer<typeof avatarInputSchema>
