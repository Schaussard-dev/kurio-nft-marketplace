import { useIsMutating } from '@tanstack/react-query'
import { createFileRoute, Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import { ChevronLeft, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { outOfStockMessage, stockIssues } from '@/features/cart/cache'
import { AlsoViewed } from '@/features/cart/components/AlsoViewed'
import { CartTable } from '@/features/cart/components/CartTable'
import { ChangeNotice } from '@/features/cart/components/ChangeNotice'
import { parseCouponParam } from '@/features/cart/coupon-param'
import { CouponForm } from '@/features/cart/components/CouponForm'
import { EmptyCart } from '@/features/cart/components/EmptyCart'
import { OrderSummary } from '@/features/cart/components/OrderSummary'
import { OrderSummarySkeleton } from '@/features/cart/components/OrderSummarySkeleton'
import { PriceChangeNotice } from '@/features/cart/components/PriceChangeNotice'
import { CART_MUTATION_KEY, CART_NETWORK, useCart, useQuote, useRemoveCartLine } from '@/features/cart/queries'
import { toApiError } from '@/shared/api/api-error'
import type { CartLine } from '@/shared/contracts'
import { Breadcrumbs } from '@/shared/layout/Breadcrumbs'
import { useMediaQuery } from '@/shared/lib/use-media-query'
import { cn } from '@/shared/lib/utils'
import { Button, buttonVariants } from '@/shared/ui/button'
import { useAnnounce } from '@/shared/ui/LiveRegion'
import { useDocumentTitle } from '@/shared/lib/use-document-title'

interface CartSearch {
  /** Coupon code; validated by the API quote, carried to /pagamento when accepted. */
  cupom?: string
}

export const Route = createFileRoute('/carrinho')({
  validateSearch: (search: Record<string, unknown>): CartSearch => {
    // Always set the key: an omitted key would let the raw (unvalidated) root search value through.
    return { cupom: parseCouponParam(search.cupom) }
  },
  component: CartPage,
})

const STOCK_NOTICE_ID = 'carrinho-aviso-estoque'

/** Coupon rejections of the quote (shown on the coupon field); other errors are summary errors. */
function couponErrorOf(error: unknown): string | undefined {
  if (!error) return undefined
  const apiError = toApiError(error)
  if (apiError.code !== 'COUPON_INVALID' && apiError.code !== 'COUPON_EXPIRED') return undefined
  return apiError.fieldErrors?.coupon?.[0] ?? apiError.message
}

function BackButton() {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const className =
    'inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-foreground hover:bg-surface-2'
  if (!canGoBack) {
    return (
      <Link to="/" aria-label="Voltar ao início" className={className}>
        <ChevronLeft aria-hidden className="size-6" />
      </Link>
    )
  }
  return (
    <button type="button" aria-label="Voltar" onClick={() => router.history.back()} className={className}>
      <ChevronLeft aria-hidden className="size-6" />
    </button>
  )
}

function LoadError({ message, onRetry, busy }: { message: string; onRetry: () => void; busy: boolean }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-lg bg-surface px-6 py-12 text-center">
      <TriangleAlert aria-hidden className="size-8 text-danger" />
      <p className="text-body-lg-17 font-bold text-foreground">{message}</p>
      <Button onClick={onRetry} disabled={busy}>
        Tentar novamente
      </Button>
    </div>
  )
}

function CartPage() {
  const { cupom } = Route.useSearch()
  const navigate = Route.useNavigate()
  const desktop = useMediaQuery('(min-width: 768px)')
  const announce = useAnnounce()

  const cart = useCart()
  const lines = cart.data?.lines
  const quote = useQuote({ coupon: cupom, network: CART_NETWORK })
  const couponError = couponErrorOf(quote.error)
  // A rejected coupon must not blank the summary: show the quote without it meanwhile.
  const fallback = useQuote({ network: CART_NETWORK }, { enabled: Boolean(couponError) })
  const active = couponError ? fallback : quote
  const shownQuote = active.data
  const cartMutating = useIsMutating({ mutationKey: CART_MUTATION_KEY }) > 0
  const remove = useRemoveCartLine()
  const issues = stockIssues(cart.data)

  useDocumentTitle('Carrinho')

  const setCoupon = (code: string | undefined) =>
    void navigate({ search: code ? { cupom: code } : {}, replace: true, resetScroll: false })

  // Announce the outcome of the collector's own apply (error assertive, success polite), once per attempt.
  const awaitingCoupon = useRef<string | null>(null)
  const [applyAttempt, setApplyAttempt] = useState(0)
  const applyCoupon = (code: string) => {
    awaitingCoupon.current = code
    setApplyAttempt((n) => n + 1)
    setCoupon(code)
  }
  const removeCoupon = () => {
    awaitingCoupon.current = null
    setCoupon(undefined)
    announce('Cupom removido')
  }
  const appliedCode = shownQuote?.coupon?.code
  useEffect(() => {
    const code = awaitingCoupon.current
    if (!code || code !== cupom) return
    if (couponError) {
      awaitingCoupon.current = null
      announce(couponError, 'assertive')
    } else if (appliedCode === code) {
      awaitingCoupon.current = null
      announce(`Cupom ${code} aplicado`)
    }
  }, [couponError, appliedCode, cupom, applyAttempt, announce])

  const onRemove = (line: CartLine) =>
    remove.mutate(line.lineId, {
      onSuccess: () => {
        announce(`${line.nft.name} removido do carrinho`)
        // Keep keyboard focus in the cart: next remove button, or the empty-cart heading.
        requestAnimationFrame(() => {
          const next = document.querySelector<HTMLElement>('[data-cart-remove]') ?? document.getElementById('carrinho-vazio-titulo')
          next?.focus()
        })
      },
    })

  const empty = lines?.length === 0
  const appliedCoupon = shownQuote?.coupon ?? null
  const checkoutBlocked = issues.length > 0 || !shownQuote
  const updating = active.isPlaceholderData || active.isFetching || cartMutating

  let content
  if (cart.isError && !cart.data) {
    content = (
      <LoadError message="Não foi possível carregar seu carrinho." onRetry={() => void cart.refetch()} busy={cart.isFetching} />
    )
  } else if (empty) {
    content = <EmptyCart />
  } else {
    content = (
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_332px] lg:items-start lg:gap-20">
        <div className="flex min-w-0 flex-col gap-4">
          <PriceChangeNotice nftIds={lines?.map((line) => line.nftId) ?? []} />
          {issues.length > 0 && (
            <ChangeNotice
              id={STOCK_NOTICE_ID}
              title="Ajuste as quantidades para continuar"
              items={issues.map((issue) => `${issue.name}: ${outOfStockMessage(issue.available)}`)}
            />
          )}
          <CartTable
            lines={lines}
            quote={shownQuote}
            layout={desktop ? 'table' : 'cards'}
            onRemove={onRemove}
            removingId={remove.isPending ? remove.variables : undefined}
          />
        </div>

        <section
          aria-labelledby="resumo-titulo"
          className="flex flex-col gap-6 max-md:-mx-4 max-md:rounded-t-[40px] max-md:bg-surface max-md:px-6 max-md:pt-8 max-md:pb-10 md:max-lg:ml-auto md:max-lg:w-full md:max-lg:max-w-md"
        >
          <h2
            id="resumo-titulo"
            className="border-b border-border-strong pb-3 text-body-lg-18 font-bold text-foreground max-md:sr-only"
          >
            Resumo da carteira
          </h2>
          <CouponForm
            key={cupom ?? ''}
            code={cupom}
            applied={appliedCoupon}
            error={couponError}
            checking={Boolean(cupom) && quote.isFetching}
            onApply={applyCoupon}
            onRemove={removeCoupon}
            variant={desktop ? 'desktop' : 'mobile'}
          />
          {active.isError && !shownQuote ? (
            <LoadError
              message="Não foi possível calcular o resumo."
              onRetry={() => void active.refetch()}
              busy={active.isFetching}
            />
          ) : shownQuote ? (
            <OrderSummary quote={shownQuote} updating={updating} />
          ) : (
            <OrderSummarySkeleton />
          )}

          <div className="flex flex-col items-center gap-4">
            {checkoutBlocked ? (
              <button
                type="button"
                disabled
                aria-describedby={issues.length > 0 ? STOCK_NOTICE_ID : undefined}
                className={cn(
                  buttonVariants(),
                  'w-full',
                  desktop ? 'h-12 rounded-xs text-body-15' : 'h-16 rounded-full text-body-lg-16',
                )}
              >
                Conectar e finalizar
              </button>
            ) : (
              <Link
                to="/pagamento"
                search={appliedCoupon ? { cupom: appliedCoupon.code } : {}}
                className={cn(
                  buttonVariants(),
                  'w-full',
                  desktop
                    ? 'h-12 rounded-xs text-body-15'
                    : 'h-16 rounded-full bg-gradient-to-r from-primary-light to-primary-dark text-body-lg-16',
                )}
              >
                Conectar e finalizar
              </Link>
            )}
            <Link to="/" hash="catalogo" activeOptions={{ includeHash: true }} className="text-body-15 text-text-accent underline-offset-4 hover:underline">
              Continuar explorando
            </Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 md:gap-4">
      {desktop ? (
        <>
          <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: 'Carrinho' }]} />
          <h1 className="sr-only">Carrinho de NFTs</h1>
        </>
      ) : (
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="flex-1 pr-12 text-center text-title-20 font-bold text-foreground">Carrinho de NFTs</h1>
        </div>
      )}
      {content}
      <div className="mt-10 md:mt-20">
        <AlsoViewed excludeIds={lines?.map((line) => line.nftId) ?? []} />
      </div>
    </div>
  )
}
