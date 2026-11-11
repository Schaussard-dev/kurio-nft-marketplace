import { z } from 'zod'
import { passwordSchema } from './auth'
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

export const avatarInputSchema = z.object({
  dataUrl: z
    .string()
    .max(400_000, 'Imagem muito grande')
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Formato de imagem inválido'),
})
export type AvatarInput = z.infer<typeof avatarInputSchema>
