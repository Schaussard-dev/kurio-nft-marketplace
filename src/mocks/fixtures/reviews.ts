import type { Review } from '@/shared/contracts'

const AUTHORS = [
  'Marina C.', 'Rafael T.', 'Beatriz L.', 'Thiago M.', 'Camila R.', 'Lucas P.', 'Juliana F.',
  'Gustavo H.', 'Larissa B.', 'Felipe A.', 'Renata S.', 'Diego N.', 'Paula V.', 'Henrique O.',
  'Aline D.', 'Caio G.', 'Fernanda K.', 'Otávio J.', 'Vanessa Q.',
]

const COMMENTS: Record<number, string[]> = {
  5: [
    'Arte impecável, chegou exatamente como descrito e a procedência está toda registrada.',
    'Compra tranquila e a obra ficou ainda mais bonita na minha coleção.',
    'Detalhes finos e cores vivas. Recomendo para quem está começando a colecionar.',
    'Transação rápida e metadados verificados na rede. Experiência muito boa.',
    'Peça marcante, valorizou desde que comprei. Voltaria a comprar com certeza.',
  ],
  4: [
    'Muito bonito, só gostaria de mais opções de edição disponíveis.',
    'Boa obra e boa procedência. A confirmação demorou um pouco, mas deu tudo certo.',
    'Arte ótima, acabamento caprichado. Só faltou um pouco mais de informação do criador.',
  ],
  3: ['Obra interessante, mas esperava um pouco mais de detalhes na versão em alta resolução.'],
}

/** Builds deterministic PT-BR reviews; `ratings` fixes each review's score and defines the count. */
export function buildReviews(nftId: string, ratings: number[], nowMs: number, offset = 0): Review[] {
  return ratings.map((rating, index) => {
    const pool = COMMENTS[rating] ?? COMMENTS[5]!
    return {
      id: `rev_${nftId}_${index + 1}`,
      author: AUTHORS[(index + offset) % AUTHORS.length]!,
      rating,
      comment: pool[(index + offset) % pool.length]!,
      createdAt: new Date(nowMs - (index + 1) * 3 * 86_400_000 - offset * 3_600_000).toISOString(),
    }
  })
}

/** 15 five-star + 4 four-star reviews: average 4.79, shown as 4.8. */
export const EMERALD_APE_RATINGS = [5, 5, 4, 5, 5, 5, 4, 5, 5, 5, 5, 4, 5, 5, 5, 4, 5, 5, 5]

export function averageRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
  return Math.round((sum / reviews.length) * 10) / 10
}
