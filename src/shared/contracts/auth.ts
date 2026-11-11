import { z } from 'zod'
import { emailSchema, isoDateTimeSchema, requiredStringSchema } from './common'

export const usernameSchema = z
  .string()
  .regex(/^[a-z0-9_]{3,20}$/, 'Use 3 a 20 caracteres: letras minúsculas, números ou _')

export const passwordSchema = z
  .string()
  .min(1, 'Campo obrigatório')
  .regex(
    /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
    'A senha precisa de 8+ caracteres, uma maiúscula, um número e um símbolo',
  )

export const registerInputSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: requiredStringSchema,
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'As senhas não coincidem' })
    }
  })
export type RegisterInput = z.infer<typeof registerInputSchema>

export const loginInputSchema = z.object({
  email: emailSchema,
  password: requiredStringSchema,
})
export type LoginInput = z.infer<typeof loginInputSchema>

export const sessionSchema = z.object({
  token: z.string(),
  expiresAt: isoDateTimeSchema,
  user: z.object({
    id: z.string(),
    username: z.string(),
    email: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
})
export type Session = z.infer<typeof sessionSchema>
