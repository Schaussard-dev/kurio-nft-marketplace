import type { Edition, Network, NftDetail } from '@/shared/contracts'
import { createRng } from '../db/prng'
import { averageRating, buildReviews, EMERALD_APE_RATINGS } from './reviews'

type ArtKey = NftDetail['art']

/** Fixed "now" of the seed; every createdAt is relative to it. */
export const SEED_NOW = '2026-11-01T12:00:00.000Z'
const SEED_NOW_MS = Date.parse(SEED_NOW)
const DAY_MS = 86_400_000

export const CATEGORIES = [
  { id: 'arte-digital', label: 'Arte digital' },
  { id: 'fotografia', label: 'Fotografia' },
  { id: 'musica', label: 'Música' },
  { id: 'arte-3d', label: 'Arte 3D' },
  { id: 'colecionaveis', label: 'Colecionáveis' },
  { id: 'generativa', label: 'Generativa' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'assinaturas', label: 'Assinaturas' },
  { id: 'utilidade', label: 'Utilidade' },
] as const

const NETWORKS: Network[] = ['ethereum', 'polygon', 'solana']
const ARTS: ArtKey[] = ['emerald', 'sage', 'ivory', 'golden']
const COLLECTIONS = [
  'Kurio Apes', 'Genesis Lab', 'Pixel Garden', 'Neon Atlas', 'Sonic Realm',
  'Vault Sessions', 'Prisma Studio', 'Orbit Club', 'Atelier Norte',
]
const EDITION_LABELS: Edition['label'][] = ['1/1', '1/10', '1/50', 'ABERTA']
const EDITION_CAPS = [1, 10, 50, 99]

interface FigmaSeed {
  name: string
  tokenNumber: number
  price: string
  previousPrice: string | null
  rare: boolean
  art: ArtKey
  category: string
  network: Network
  daysAgo: number
  trendingScore: number
}

// Order matters: these are the first 9 catalog entries, as drawn in the Figma frames.
const FIGMA_NFTS: FigmaSeed[] = [
  { name: 'Emerald Ape', tokenNumber: 42, price: '1.19', previousPrice: null, rare: true, art: 'emerald', category: 'arte-digital', network: 'ethereum', daysAgo: 6, trendingScore: 97 },
  { name: 'Sage Nomad', tokenNumber: 9, price: '1.69', previousPrice: null, rare: false, art: 'sage', category: 'arte-digital', network: 'ethereum', daysAgo: 12, trendingScore: 88 },
  { name: 'Neon Vessel', tokenNumber: 552, price: '1.99', previousPrice: '2.29', rare: true, art: 'ivory', category: 'arte-digital', network: 'polygon', daysAgo: 3, trendingScore: 93 },
  { name: 'Cosmic Bloom', tokenNumber: 118, price: '1.29', previousPrice: null, rare: false, art: 'sage', category: 'colecionaveis', network: 'ethereum', daysAgo: 20, trendingScore: 71 },
  { name: 'Violet Nomad', tokenNumber: 314, price: '1.39', previousPrice: null, rare: false, art: 'sage', category: 'colecionaveis', network: 'solana', daysAgo: 28, trendingScore: 64 },
  { name: 'Ivory Baron', tokenNumber: 88, price: '1.79', previousPrice: null, rare: false, art: 'ivory', category: 'arte-3d', network: 'polygon', daysAgo: 45, trendingScore: 58 },
  { name: 'Golden Beat', tokenNumber: 207, price: '0.99', previousPrice: null, rare: false, art: 'golden', category: 'musica', network: 'solana', daysAgo: 60, trendingScore: 76 },
  { name: 'Golden Frequency', tokenNumber: 71, price: '0.59', previousPrice: null, rare: false, art: 'sage', category: 'musica', network: 'polygon', daysAgo: 75, trendingScore: 52 },
  { name: 'Golden Signal', tokenNumber: 160, price: '0.39', previousPrice: null, rare: false, art: 'golden', category: 'musica', network: 'ethereum', daysAgo: 90, trendingScore: 47 },
]

const EMERALD_APE_DESCRIPTION =
  'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.'

const EMERALD_APE_LONG_DESCRIPTION = [
  'Emerald Ape #042 é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na Ethereum. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.',
  'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
  'Rede:\nCunhado na Ethereum com procedência imutável e metadados armazenados no IPFS.',
  'Contrato:\nDireitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.',
  'Direitos autorais:\n0x7A42...19E8 • Contrato inteligente ERC-721 verificado.',
].join('\n\n')

const EMERALD_APE_CONTRACT = '0x7A42c1D8e3B9f0A5726d4C8eB1a3F9d6054e19E8'

const ADJECTIVES = [
  'Amber', 'Crimson', 'Silent', 'Lunar', 'Velvet', 'Solar', 'Frozen', 'Electric', 'Wild', 'Quiet',
  'Cobalt', 'Gilded', 'Hollow', 'Rusty', 'Pale', 'Neon', 'Mystic', 'Burning', 'Twilight', 'Coral',
]
const NOUNS = [
  'Harbor', 'Echo', 'Drifter', 'Orchid', 'Relic', 'Beacon', 'Mirage', 'Pulse', 'Totem', 'Canyon',
  'Lantern', 'Atlas', 'Voyager', 'Ember', 'Prism', 'Garden', 'Signal', 'Tide', 'Cipher', 'Monolith',
]
const ATTRIBUTE_POOL = [
  'Óculos', 'Esmeralda', 'Chapéu', 'Dourado', 'Fone', 'Jaqueta', 'Brilho', 'Capuz', 'Ouro', 'Colar',
  'Marfim', 'Sálvia', 'Neon', 'Clássico', 'Raro',
]

function formatCents(cents: number): string {
  const whole = Math.floor(cents / 100)
  const frac = String(cents % 100).padStart(2, '0')
  return `${whole}.${frac}`
}

function isoDaysAgo(days: number, extraHours = 0): string {
  return new Date(SEED_NOW_MS - days * DAY_MS - extraHours * 3_600_000).toISOString()
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!
}

function hexFragment(rng: () => number, length: number): string {
  return Array.from({ length }, () => Math.floor(rng() * 16).toString(16)).join('')
}

function buildEditions(
  nftId: string,
  availability: [number, number, number, number],
): Edition[] {
  return EDITION_LABELS.map((label, index) => {
    const available = availability[index]!
    const cap = EDITION_CAPS[index]!
    return {
      id: `${nftId}_e${index + 1}`,
      label,
      available,
      maxPerOrder: Math.max(1, Math.min(cap, available)),
    }
  })
}

function nftId(tokenNumber: number): string {
  return `nft_${String(tokenNumber).padStart(3, '0')}`
}

function genericCopy(name: string, collection: string, network: Network) {
  const networkLabel = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }[network]
  return {
    description: `Um colecionável digital da coleção ${collection}, verificado na ${networkLabel}, com arte em alta resolução e acesso para colecionadores.`,
    longDescription: [
      `${name} é uma obra digital da coleção ${collection}. Cada atributo fica armazenado nos metadados do token e verificado na ${networkLabel}.`,
      'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede.',
      `Rede:\nCunhado na ${networkLabel} com procedência imutável e metadados armazenados no IPFS.`,
      'Contrato:\nDireitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.',
    ].join('\n\n'),
  }
}

// Generated NFTs per category; with the 9 Figma NFTs, totals are 10 for arte-digital,
// musica and colecionaveis (two pages at pageSize 9) and 5 for the other categories.
const GENERATED_CATEGORY_COUNTS: Record<string, number> = {
  'arte-digital': 7,
  musica: 7,
  colecionaveis: 8,
  'arte-3d': 4,
  fotografia: 5,
  generativa: 5,
  jogos: 5,
  assinaturas: 5,
  utilidade: 5,
}

/** Deterministic, shuffled category plan for the 51 generated NFTs. */
function planGeneratedCategories(): string[] {
  const plan = Object.entries(GENERATED_CATEGORY_COUNTS).flatMap(([id, count]) =>
    Array.from({ length: count }, () => id),
  )
  const shuffleRng = createRng(77)
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(shuffleRng() * (i + 1))
    ;[plan[i], plan[j]] = [plan[j]!, plan[i]!]
  }
  return plan
}

/** Price tiers (in cents) so prices spread over the whole 0.02-12.30 slider range. */
function tieredCents(rng: () => number, tier: number): number {
  const ranges: [number, number][] = [
    [5, 150],
    [150, 400],
    [310, 800],
    [600, 1229],
  ]
  const [min, max] = ranges[tier]!
  return min + Math.floor(rng() * (max - min + 1))
}

export function buildNfts(): NftDetail[] {
  const rng = createRng(2026)
  const usedTokens = new Set(FIGMA_NFTS.map((n) => n.tokenNumber))
  const nfts: NftDetail[] = []

  FIGMA_NFTS.forEach((seed, index) => {
    const id = nftId(seed.tokenNumber)
    const isHero = seed.tokenNumber === 42
    const name = `${seed.name} #${String(seed.tokenNumber).padStart(3, '0')}`
    const collection = 'Kurio Apes'
    const ratings = isHero ? EMERALD_APE_RATINGS : [5, 4, 5, 5, 4].slice(0, 3 + (index % 3))
    const reviews = buildReviews(id, ratings, SEED_NOW_MS, index)
    const copy = isHero
      ? { description: EMERALD_APE_DESCRIPTION, longDescription: EMERALD_APE_LONG_DESCRIPTION }
      : genericCopy(name, collection, seed.network)
    nfts.push({
      id,
      tokenNumber: seed.tokenNumber,
      name,
      art: seed.art,
      price: seed.price,
      previousPrice: seed.previousPrice,
      rare: seed.rare,
      category: seed.category,
      network: seed.network,
      collection,
      createdAt: isoDaysAgo(seed.daysAgo),
      trendingScore: seed.trendingScore,
      version: 1,
      ...copy,
      attributes: isHero ? ['Óculos', 'Esmeralda', 'Raro'] : [ATTRIBUTE_POOL[index]!, ATTRIBUTE_POOL[index + 3]!],
      contractAddress: isHero ? EMERALD_APE_CONTRACT : `0x${hexFragment(rng, 40)}`,
      rating: isHero ? 4.8 : averageRating(reviews),
      reviewCount: reviews.length,
      // 042's 1/1 is sold out; every Figma NFT keeps >= 3 on 1/50 and ABERTA.
      editions: buildEditions(id, [isHero ? 0 : 1, 4 + index, 12 + index * 3, 99]),
      gallery: [seed.art, seed.art, seed.art, seed.art],
      reviews,
    })
  })

  const generatedCategories = planGeneratedCategories()
  const seenPerCategory = new Map<string, number>()

  for (let i = 0; i < 51; i++) {
    let tokenNumber = 1 + Math.floor(rng() * 999)
    while (usedTokens.has(tokenNumber)) tokenNumber = (tokenNumber % 999) + 1
    usedTokens.add(tokenNumber)

    const id = nftId(tokenNumber)
    const name = `${pick(rng, ADJECTIVES)} ${pick(rng, NOUNS)} #${String(tokenNumber).padStart(3, '0')}`
    const collection = pick(rng, COLLECTIONS)
    const category = generatedCategories[i]!
    // Networks cycle per category so every category covers all three networks evenly.
    const occurrence = seenPerCategory.get(category) ?? 0
    seenPerCategory.set(category, occurrence + 1)
    const network = NETWORKS[(occurrence + CATEGORIES.findIndex((c) => c.id === category)) % 3]!
    const art = pick(rng, ARTS)

    // Force the extremes of the price slider drawn in Figma (0,02 - 12,30).
    const cents = i === 0 ? 2 : i === 1 ? 1230 : tieredCents(rng, i % 4)
    const hasPrevious = rng() < 0.2
    const previousPrice = hasPrevious ? formatCents(Math.min(1230, cents + 5 + Math.floor(rng() * 40))) : null
    const rare = rng() < 0.15

    const reviewTotal = Math.floor(rng() * 7)
    const ratings = Array.from({ length: reviewTotal }, () => 3 + Math.floor(rng() * 3))
    const reviews = buildReviews(id, ratings, SEED_NOW_MS, i + 9)
    const copy = genericCopy(name, collection, network)

    nfts.push({
      id,
      tokenNumber,
      name,
      art,
      price: formatCents(cents),
      previousPrice: previousPrice === formatCents(cents) ? null : previousPrice,
      rare,
      category,
      network,
      collection,
      createdAt: isoDaysAgo(Math.floor(rng() * 180), Math.floor(rng() * 24)),
      trendingScore: Math.floor(rng() * 101),
      version: 1,
      ...copy,
      attributes: [pick(rng, ATTRIBUTE_POOL), pick(rng, ATTRIBUTE_POOL)].filter((a, k, all) => all.indexOf(a) === k),
      contractAddress: `0x${hexFragment(rng, 40)}`,
      rating: averageRating(reviews),
      reviewCount: reviews.length,
      editions: buildEditions(id, [
        rng() < 0.4 ? 0 : 1,
        2 + Math.floor(rng() * 9),
        3 + Math.floor(rng() * 48),
        3 + Math.floor(rng() * 97),
      ]),
      gallery: [art, art, art, art],
      reviews,
    })
  }

  return nfts
}
