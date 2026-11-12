import { Link } from '@tanstack/react-router'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/shared/ui/button'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

function Soon({ secao, children }: { secao: string; children: ReactNode }) {
  return (
    <Link to="/em-breve" search={{ secao }} className="hover:text-text-accent">
      {children}
    </Link>
  )
}

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com/', icon: '/icons/social-facebook.svg' },
  { label: 'Instagram', href: 'https://www.instagram.com/', icon: '/icons/social-instagram.svg' },
  { label: 'Twitter', href: 'https://twitter.com/', icon: '/icons/social-twitter.svg' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/', icon: null },
  { label: 'YouTube', href: 'https://www.youtube.com/', icon: null },
] as const

function SocialGlyph({ name }: { name: 'LinkedIn' | 'YouTube' }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {name === 'LinkedIn' ? (
        <>
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </>
      ) : (
        <>
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
          <polygon points="9.75 15.02 15.75 11.75 9.75 8.48 9.75 15.02" />
        </>
      )}
    </svg>
  )
}

const COLUMN_TITLE = 'mb-3 text-body-lg-18 leading-6 font-bold text-foreground'
const COLUMN_LIST = 'flex flex-col gap-2.5 text-body-15 text-foreground'

function Newsletter() {
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 lg:pl-6">
      <h2 className="text-body-lg-18 leading-6 font-bold text-foreground">Antecipe-se ao próximo lançamento</h2>
      <div className="flex">
        <label htmlFor="newsletter-email" className="sr-only">
          E-mail
        </label>
        <input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          placeholder="digite seu e-mail..."
          className="h-10 min-w-0 flex-1 rounded-l-md bg-band px-3 text-caption-13 text-foreground placeholder:text-muted"
        />
        <Button type="submit" className="h-10 rounded-l-none px-4 text-body-lg-18">
          Enviar
        </Button>
      </div>
      <p className="text-caption-13 text-text-secondary">
        Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
      </p>
      <p role="status" className="text-body-14 text-text-accent">
        {submitted ? 'Newsletter indisponível nesta demonstração.' : ''}
      </p>
    </form>
  )
}

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-[1232px] px-4 pb-6">
      <div className="bg-surface">
        <div className="grid gap-8 p-6 lg:grid-cols-[1fr_1fr_1fr_1.25fr] lg:gap-0 lg:px-10 lg:pt-8 lg:pb-9">
          {FEATURES.map((f) => (
            <section key={f.letter} className="flex flex-col gap-2 lg:border-r lg:border-primary lg:px-6">
              <span
                aria-hidden
                className="mb-2 flex size-[74px] items-center justify-center rounded-full bg-primary text-heading-24 font-bold text-ink"
              >
                {f.letter}
              </span>
              <h2 className="text-body-lg-17 leading-6 font-bold text-foreground">{f.title}</h2>
              <p className="text-body-14 leading-5 text-text-secondary">{f.text}</p>
            </section>
          ))}
          <Newsletter />
        </div>

        <div className="grid gap-3 bg-band px-6 py-6 text-body-14 text-foreground sm:grid-cols-2 lg:grid-cols-4 lg:items-center lg:px-8">
          <span className="font-bold tracking-[1.4px]">KURIO</span>
          <span>Feito para colecionadores, criadores e cultura</span>
          <a href="mailto:contato@email.com" className="hover:text-text-accent">
            contato@email.com
          </a>
          <a href="tel:+551140028922" className="hover:text-text-accent">
            +55 11 4002 8922
          </a>
        </div>

        <div className="grid gap-8 px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <nav aria-label="Meu perfil">
            <h2 className={COLUMN_TITLE}>Meu perfil</h2>
            <ul className={COLUMN_LIST}>
              <li>
                <Link to="/perfil" activeOptions={{ exact: true }} className="hover:text-text-accent">
                  Meu perfil
                </Link>
              </li>
              <li>
                <Soon secao="colecao">Minha coleção</Soon>
              </li>
              <li>
                <Soon secao="atividade">Atividade</Soon>
              </li>
              <li>
                <Soon secao="estudio">Estúdio do criador</Soon>
              </li>
              <li>
                <Link to="/perfil/favoritos" className="hover:text-text-accent">
                  Lista de interesse
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="Central de ajuda">
            <h2 className={COLUMN_TITLE}>Central de ajuda</h2>
            <ul className={COLUMN_LIST}>
              <li>
                <Soon secao="ajuda">Central de ajuda</Soon>
              </li>
              <li>
                <Soon secao="como-comprar">Como comprar NFTs</Soon>
              </li>
              <li>
                <Soon secao="carteira-seguranca">Carteira e segurança</Soon>
              </li>
              <li>
                <Soon secao="politica">Política do mercado</Soon>
              </li>
              <li>
                <Soon secao="denunciar">Denunciar item</Soon>
              </li>
            </ul>
          </nav>
          <nav aria-label="Coleções">
            <h2 className={COLUMN_TITLE}>Coleções</h2>
            <ul className={COLUMN_LIST}>
              <li>
                <Soon secao="arte-digital">Arte digital</Soon>
              </li>
              <li>
                <Soon secao="fotografia">Fotografia</Soon>
              </li>
              <li>
                <Soon secao="musica">Música</Soon>
              </li>
              <li>
                <Soon secao="arte-3d">Arte 3D</Soon>
              </li>
              <li>
                <Soon secao="utilidade">Utilidade</Soon>
              </li>
            </ul>
          </nav>
          <div>
            <h2 className={COLUMN_TITLE}>Redes sociais</h2>
            <ul className="mb-6 flex flex-wrap gap-2">
              {SOCIAL.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="flex size-8 items-center justify-center rounded-md border border-primary text-primary hover:bg-primary/10"
                  >
                    {s.icon ? <img src={s.icon} alt="" className="size-4" /> : <SocialGlyph name={s.label} />}
                  </a>
                </li>
              ))}
            </ul>
            <h2 className={COLUMN_TITLE}>Carteiras compatíveis</h2>
            <p className="inline-block rounded-md border border-border-strong bg-band px-3 py-2 text-tiny-9 font-bold tracking-wider text-text-accent">
              METAMASK <span aria-hidden>•</span> WALLETCONNECT <span aria-hidden>•</span> COINBASE
            </p>
          </div>
        </div>
      </div>
      <p className="py-4 text-center text-body-14 text-foreground">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
