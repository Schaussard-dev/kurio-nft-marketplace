import { z } from 'zod'
import { isEthString } from '@/shared/lib/money'

export const ethStringSchema = z.string().refine(isEthString, 'Valor ETH inválido')

export const networkSchema = z.enum(['ethereum', 'polygon', 'solana'])
export type Network = z.infer<typeof networkSchema>

// Keep in sync with ArtKey in features/catalog/art.ts (asserted in contracts.test.ts).
export const artKeySchema = z.enum(['emerald', 'sage', 'ivory', 'golden'])

export const isoDateTimeSchema = z.iso.datetime()

export const requiredStringSchema = z.string().min(1, 'Campo obrigatório')

export const emailSchema = z.email('E-mail inválido')

export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
export type Paginated<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}
