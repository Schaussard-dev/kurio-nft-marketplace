import { Link } from '@tanstack/react-router'
import type { ArtKey } from '../art'
import { ArtImage } from './ArtImage'

const POSTS: { art: ArtKey; meta: string; title: string; text: string }[] = [
  {
    art: 'ivory',
    meta: '12 de setembro  |  Leitura de 6 min',
    title: 'Como funciona a propriedade de NFTs',
    text: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
  },
  {
    art: 'emerald',
    meta: '13 de setembro  |  Leitura de 2 min',
    title: '10 artistas digitais para acompanhar',
    text: 'Conheça criadores que moldam a cultura digital.',
  },
  {
    art: 'sage',
    meta: '15 de setembro  |  Leitura de 3 min',
    title: 'Raridade, atributos e procedência',
    text: 'Entenda raridade, procedência, direitos autorais e utilidade.',
  },
  {
    art: 'golden',
    meta: '15 de setembro  |  Leitura de 2 min',
    title: 'Como proteger sua carteira',
    text: 'Proteja sua carteira, seus ativos e sua identidade.',
  },
]

/** "Diário da Cunhagem": editorial posts; reading them is out of scope (/em-breve). */
export function JournalSection() {
  return (
    <section aria-labelledby="diario-titulo" className="flex flex-col items-center">
      <h2 id="diario-titulo" className="text-center text-heading-24 text-foreground md:text-heading-28">
        Diário da Cunhagem
      </h2>
      <p className="mt-3 text-center text-body-14 text-text-secondary">
        Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
      </p>
      <ul className="mt-10 grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <li key={post.title}>
            <article className="flex h-full flex-col overflow-hidden rounded-lg bg-surface">
              <ArtImage art={post.art} sizes="(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw" alt="" className="h-[195px] w-full object-cover" />
              <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-5">
                <p className="text-caption-12 font-medium whitespace-pre-wrap text-text-secondary">{post.meta}</p>
                <h3 className="text-body-lg-16 leading-[21px] font-bold text-foreground">{post.title}</h3>
                <p className="text-caption-12 font-medium text-text-secondary">{post.text}</p>
                <Link
                  to="/em-breve"
                  search={{ secao: 'diario' }}
                  className="mt-auto pt-1 text-caption-12 font-bold text-text-accent hover:underline"
                >
                  Ler mais <span aria-hidden className="font-normal">→</span>
                  <span className="sr-only">: {post.title}</span>
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
