import { z } from 'zod'
import {
  artKeySchema,
  ethStringSchema,
  isoDateTimeSchema,
  networkSchema,
  paginatedSchema,
} from './common'

export const editionSchema = z.object({
  id: z.string(),
  label: z.enum(['1/1', '1/10', '1/50', 'ABERTA']),
  available: z.number().int().min(0),
  maxPerOrder: z.number().int().min(1),
})
export type Edition = z.infer<typeof editionSchema>

export const nftSummarySchema = z.object({
  id: z.string(),
  tokenNumber: z.number().int(),
  name: z.string(),
  art: artKeySchema,
  price: ethStringSchema,
  previousPrice: ethStringSchema.nullable(),
  rare: z.boolean(),
  category: z.string(),
  network: networkSchema,
  collection: z.string(),
  createdAt: isoDateTimeSchema,
  trendingScore: z.number(),
  version: z.number().int(),
})
export type NftSummary = z.infer<typeof nftSummarySchema>

export const nftDetailSchema = nftSummarySchema.extend({
  description: z.string(),
  longDescription: z.string(),
  attributes: z.array(z.string()),
  contractAddress: z.string(),
  rating: z.number(),
  reviewCount: z.number().int().min(0),
  editions: z.array(editionSchema),
  gallery: z.array(artKeySchema),
})
export type NftDetail = z.infer<typeof nftDetailSchema>

// Query-string values arrive as a single string or string[]; normalize to an array.
const toArray = (value: unknown) => (value === undefined || Array.isArray(value) ? value : [value])

export const catalogQuerySchema = z.object({
  q: z.string().optional(),
  categories: z.preprocess(toArray, z.array(z.string()).optional()),
  networks: z.preprocess(toArray, z.array(networkSchema).optional()),
  minPrice: ethStringSchema.optional(),
  maxPrice: ethStringSchema.optional(),
  tab: z.enum(['all', 'new', 'trending']).default('all'),
  sort: z.enum(['recent', 'price-asc', 'price-desc', 'name']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
})
export type CatalogQuery = z.infer<typeof catalogQuerySchema>

export const catalogResponseSchema = paginatedSchema(nftSummarySchema).extend({
  facets: z.object({
    categories: z.array(z.object({ id: z.string(), label: z.string(), count: z.number().int().min(0) })),
    networks: z.array(z.object({ id: networkSchema, count: z.number().int().min(0) })),
    priceRange: z.object({ min: ethStringSchema, max: ethStringSchema }),
  }),
})
export type CatalogResponse = z.infer<typeof catalogResponseSchema>

export const reviewSchema = z.object({
  id: z.string(),
  author: z.string(),
  rating: z.number().min(0).max(5),
  comment: z.string(),
  createdAt: isoDateTimeSchema,
})
export type Review = z.infer<typeof reviewSchema>
