import type { ReactNode } from 'react'
import { Footer } from './Footer'
import { Header } from './Header'
import { MobileTabBar } from './MobileTabBar'

const MAIN = 'mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 outline-none'

/**
 * App frame: skip link, header, `<main id="conteudo">`, footer and the mobile tab bar.
 * `bare` renders only `<main>` (mobile sign-in/sign-up are standalone screens in Figma).
 */
export function PageShell({
  children,
  cartCount = 0,
  bare = false,
}: {
  children: ReactNode
  cartCount?: number
  bare?: boolean
}) {
  if (bare) {
    return (
      <div className="flex min-h-dvh flex-col">
        <main id="conteudo" tabIndex={-1} className={MAIN}>
          {children}
        </main>
      </div>
    )
  }
  return (
    <div className="flex min-h-dvh flex-col pb-24 lg:pb-0">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-body-15 focus:font-bold focus:text-ink"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('conteudo')?.focus()
        }}
      >
        Pular para o conteúdo
      </a>
      <Header cartCount={cartCount} />
      <main id="conteudo" tabIndex={-1} className={MAIN}>
        {children}
      </main>
      <Footer />
      <MobileTabBar cartCount={cartCount} />
    </div>
  )
}
