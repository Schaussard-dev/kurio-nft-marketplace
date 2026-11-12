import { Link, useNavigate } from '@tanstack/react-router'
import { useRef, type ReactNode } from 'react'
import { HomeContent } from '@/features/catalog/components/HomeContent'
import { useMediaQuery } from '@/shared/lib/use-media-query'
import { cn } from '@/shared/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { safeRedirect } from '@/shared/lib/safe-redirect'
import type { AuthSearch } from '../auth-route'
import { isPrivatePath } from '../private-paths'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { useDocumentTitle } from '@/shared/lib/use-document-title'

export type AuthMode = 'login' | 'register'

const COPY: Record<AuthMode, { title: string; description: string; pageTitle: string }> = {
  login: {
    title: 'Entrar',
    description: 'Entre para gerenciar sua carteira, coleção e perfil de criador.',
    pageTitle: 'Entrar',
  },
  register: {
    title: 'Criar conta',
    description: 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.',
    pageTitle: 'Criar perfil de colecionador',
  },
}

/** Only the redirect travels between the tabs; the expiry notice belongs to the login it came with. */
const tabSearch = (search: AuthSearch) => (search.redirect ? { redirect: search.redirect } : {})

const TAB = 'text-title-22 font-bold text-foreground transition-colors hover:text-text-accent'

/** Where closing the dialog goes: the (internal) redirect target, or Início when that target needs a session. */
const closeTarget = (search: AuthSearch) => {
  const target = safeRedirect(search.redirect)
  return isPrivatePath(target) ? '/' : target
}

/**
 * What had the focus before the auth dialog opened (e.g. the header "Entrar" link). Opened by navigation,
 * the dialog has no Radix trigger to hand the focus back to. Module-level because switching
 * Entrar ⇄ Criar conta remounts the dialog: the new one must keep the original opener.
 */
let authDialogOpener: HTMLElement | null = null
const AUTH_DIALOG = '[data-auth-dialog]'

/** Desktop (≥768px): Figma's dialog over Início. Esc / close returns to the public redirect target or Início. */
export function AuthDialog({ mode, search, children }: { mode: AuthMode; search: AuthSearch; children: ReactNode }) {
  const navigate = useNavigate()
  const contentRef = useRef<HTMLDivElement>(null)
  const copy = COPY[mode]
  return (
    <Dialog open onOpenChange={(open) => !open && void navigate({ href: closeTarget(search) })}>
      <DialogContent
        ref={contentRef}
        data-auth-dialog=""
        onOpenAutoFocus={(event) => {
          // Still focused here: the opener, or (tab switch) the previous dialog's link or <body>; keep the original.
          const active = document.activeElement
          if (active instanceof HTMLElement && active !== document.body && !active.closest(AUTH_DIALOG)) {
            authDialogOpener = active
          }
          // Start on the first field, not on the tab links.
          event.preventDefault()
          contentRef.current?.querySelector<HTMLInputElement>('form input')?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          // A tab switch mounted the next auth dialog, which keeps the focus.
          if (document.querySelector(AUTH_DIALOG)) return
          if (authDialogOpener?.isConnected) authDialogOpener.focus()
          authDialogOpener = null
        }}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-none border-0 border-b-8 border-primary bg-surface p-0 sm:max-w-[505px] [&_[data-slot=dialog-close]]:text-text-accent [&_[data-slot=dialog-close]_svg]:size-5"
      >
        <div className="flex flex-col gap-8 px-[80px] pt-14 pb-14">
          <DialogTitle className="sr-only">{copy.title}</DialogTitle>
          <nav aria-label="Acesso à conta" className="flex items-center justify-center gap-2">
            <Link
              to="/entrar"
              search={tabSearch(search)}
              aria-current={mode === 'login' ? 'page' : undefined}
              className={cn(TAB, mode === 'login' && 'text-text-accent')}
            >
              Entrar
            </Link>
            <span className="h-6 w-px bg-primary" aria-hidden />
            <Link
              to="/cadastro"
              search={tabSearch(search)}
              aria-current={mode === 'register' ? 'page' : undefined}
              className={cn(TAB, mode === 'register' && 'text-text-accent')}
            >
              Criar conta
            </Link>
          </nav>
          <DialogDescription className="text-center text-caption-13 text-foreground">{copy.description}</DialogDescription>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Mobile (<768px): full page per the Mobile Login/Cadastro frames. */
function AuthPage({ mode, search, children }: { mode: AuthMode; search: AuthSearch; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[358px] flex-col pt-10 pb-6">
      <Link
        to="/"
        aria-label="Kurio, página inicial"
        className="self-center text-[44px] leading-none font-bold tracking-[0.08em] text-foreground"
      >
        KURIO
      </Link>
      <h1 className="mt-20 mb-10 text-center text-heading-24 text-foreground">{COPY[mode].pageTitle}</h1>
      {children}
      <p className="mt-12 text-center text-body-lg-17 text-text-secondary">
        {mode === 'login' ? 'Novo na Kurio? ' : 'Já tem uma conta? '}
        <Link
          to={mode === 'login' ? '/cadastro' : '/entrar'}
          search={tabSearch(search)}
          className="text-text-secondary underline-offset-4 hover:text-text-accent hover:underline"
        >
          {mode === 'login' ? 'Crie uma conta' : 'Entre'}
        </Link>
      </p>
    </div>
  )
}

/** /entrar and /cadastro: dialog over Início on ≥768px, full page below (spec §4). */
export function AuthScreen({ mode, search }: { mode: AuthMode; search: AuthSearch }) {
  useDocumentTitle(COPY[mode].title)
  const isDialog = useMediaQuery('(min-width: 768px)')
  const variant = isDialog ? 'dialog' : 'page'
  const form =
    mode === 'login' ? (
      <LoginForm variant={variant} redirect={search.redirect} expired={search.reason === 'expired'} />
    ) : (
      <RegisterForm variant={variant} redirect={search.redirect} />
    )
  if (!isDialog) {
    return (
      <AuthPage mode={mode} search={search}>
        {form}
      </AuthPage>
    )
  }
  return (
    <>
      <HomeContent />
      <AuthDialog mode={mode} search={search}>
        {form}
      </AuthDialog>
    </>
  )
}
