import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronDown, ChevronLeft, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { useSession } from '@/features/auth/queries'
import { outOfStockMessage, stockIssues } from '@/features/cart/cache'
import { ChangeNotice } from '@/features/cart/components/ChangeNotice'
import { EmptyCart } from '@/features/cart/components/EmptyCart'
import { PriceChangeNotice } from '@/features/cart/components/PriceChangeNotice'
import { dismissPriceNotices } from '@/features/cart/price-notices'
import { CART_NETWORK, useCart, useQuote } from '@/features/cart/queries'
import { useProfile } from '@/features/profile/queries'
import { useRealtimeEvent } from '@/features/realtime/realtime-hub'
import { useConnectWallet, useWallets } from '@/features/wallets/queries'
import { toApiError } from '@/shared/api/api-error'
import {
  networkSchema,
  quoteSchema,
  type Cart,
  type Network,
  type Profile,
  type Quote,
  type WalletsResponse,
} from '@/shared/contracts'
import { Breadcrumbs } from '@/shared/layout/Breadcrumbs'
import { formatEth } from '@/shared/lib/format'
import { clearAttempt, getAttempt } from '@/shared/lib/idempotency'
import { useMediaQuery } from '@/shared/lib/use-media-query'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent } from '@/shared/ui/dialog'
import { useAnnounce } from '@/shared/ui/LiveRegion'
import { Skeleton } from '@/shared/ui/Skeleton'
import { clearCheckoutDraft, loadCheckoutDraft, MANUAL_WALLET, saveCheckoutDraft, type Connector } from '../draft'
import {
  checkoutFormSchema,
  CONNECTOR_LABELS,
  connectTarget,
  FIELD_ORDER,
  initialValues,
  NETWORK_LABELS,
  registeredWallets,
  shortAddress,
  toOrderInput,
  walletFields,
  walletTitle,
  type CheckoutFormValues,
} from '../form'
import { hashPayload } from '../payload-hash'
import { savePendingOrderId } from '../pending-order'
import { isUncertainOrderError, useCreateOrder, type CreateOrderVariables } from '../queries'
import { CheckoutForm } from './CheckoutForm'
import { CheckoutSummary } from './CheckoutSummary'
import { ConnectorPicker } from './ConnectorPicker'
import { ConnectWalletDialog, type ConnectStatus } from './ConnectWalletDialog'
import { PendingOrderDialog } from './PendingOrderDialog'
import { QuoteChangedDialog } from './QuoteChangedDialog'
import { ReviewDialog } from './ReviewDialog'
import { WalletPicker } from './WalletPicker'

type Flow =
  | { step: 'idle' }
  | { step: 'connect'; status: ConnectStatus }
  | { step: 'review'; quote: Quote; error?: string }
  | { step: 'stale'; previous: Quote; next: Quote }

const DRAFT_DEBOUNCE_MS = 300
const STOCK_NOTICE_ID = 'pagamento-aviso-estoque'
const SEND_ERROR = 'Não foi possível enviar o pedido. Tente novamente.'

// Element that receives the focus for each field (the first invalid one is focused on submit).
const FOCUS_IDS: Partial<Record<keyof CheckoutFormValues, string>> = {
  displayName: 'pagamento-nome',
  username: 'pagamento-usuario',
  network: 'pagamento-rede',
  profileName: 'pagamento-perfil',
  walletAddress: 'pagamento-endereco',
  secondaryAddress: 'pagamento-secundaria',
  referralCode: 'pagamento-indicacao',
  email: 'pagamento-email',
  ensName: 'pagamento-ens',
  note: 'pagamento-observacao',
}

// Server field errors (payer.* / top level) mapped onto the form fields.
const SERVER_FIELDS: Record<string, keyof CheckoutFormValues> = {
  walletAddress: 'walletAddress',
  secondaryAddress: 'secondaryAddress',
  network: 'network',
  walletId: 'walletChoice',
}

/** Coupon rejections of the quote (shown on the coupon field); other errors are summary errors. */
function couponErrorOf(error: unknown): string | undefined {
  if (!error) return undefined
  const apiError = toApiError(error)
  if (apiError.code !== 'COUPON_INVALID' && apiError.code !== 'COUPON_EXPIRED') return undefined
  return apiError.fieldErrors?.coupon?.[0] ?? apiError.message
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-lg bg-surface px-6 py-12 text-center">
      <TriangleAlert aria-hidden className="size-8 text-danger" />
      <p className="text-body-lg-17 font-bold text-foreground">{message}</p>
      <Button onClick={onRetry}>Tentar novamente</Button>
    </div>
  )
}

function PageHeader({ desktop }: { desktop: boolean }) {
  if (desktop) {
    return (
      <>
        <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: 'Pagamento' }]} />
        <h1 className="sr-only">Pagamento</h1>
      </>
    )
  }
  return (
    <div className="flex items-center gap-4">
      <Link
        to="/carrinho"
        aria-label="Voltar ao carrinho"
        className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-text-accent hover:bg-surface-2"
      >
        <ChevronLeft aria-hidden className="size-6" />
      </Link>
      <h1 className="flex-1 text-title-22 font-bold text-foreground">Pagamento com carteira</h1>
    </div>
  )
}

/**
 * /pagamento: loads profile, wallets and cart, then the checkout flow (form → wallet approval →
 * review → idempotent order). `cupom` is the URL coupon, re-validated by the quote.
 */
export function CheckoutPage({ cupom, onCouponChange }: { cupom?: string; onCouponChange: (code?: string) => void }) {
  const desktop = useMediaQuery('(min-width: 768px)')
  const session = useSession()
  const profile = useProfile()
  const wallets = useWallets()
  const cart = useCart()

  useEffect(() => {
    const previous = document.title
    document.title = 'Pagamento · Kurio'
    return () => {
      document.title = previous
    }
  }, [])

  let content
  if (profile.isError || wallets.isError) {
    content = (
      <LoadError
        message="Não foi possível carregar seus dados de pagamento."
        onRetry={() => {
          void profile.refetch()
          void wallets.refetch()
        }}
      />
    )
  } else if (cart.isError && !cart.data) {
    content = <LoadError message="Não foi possível carregar seu carrinho." onRetry={() => void cart.refetch()} />
  } else if (!session || !profile.data || !wallets.data || !cart.data) {
    content = (
      <div aria-busy className="flex flex-col gap-4">
        <span className="sr-only">Carregando pagamento…</span>
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  } else if (cart.data.lines.length === 0) {
    content = <EmptyCart />
  } else {
    content = (
      <CheckoutFlow
        key={session.user.id}
        userId={session.user.id}
        profile={profile.data}
        wallets={wallets.data}
        cart={cart.data}
        cupom={cupom}
        onCouponChange={onCouponChange}
        desktop={desktop}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHeader desktop={desktop} />
      {content}
    </div>
  )
}

function CheckoutFlow({
  userId,
  profile,
  wallets,
  cart,
  cupom,
  onCouponChange,
  desktop,
}: {
  userId: string
  profile: Profile
  wallets: WalletsResponse
  cart: Cart
  cupom?: string
  onCouponChange: (code?: string) => void
  desktop: boolean
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const registered = registeredWallets(wallets)
  // Draft first (restored after a session expiry), else profile + primary wallet.
  const [defaults] = useState(() => initialValues(profile, wallets, loadCheckoutDraft(userId)))
  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: defaults,
    // Some fields live outside the form grid (wallet, connector), so focus follows the DOM order by hand.
    shouldFocusError: false,
  })
  const { register, setValue, trigger, getValues, getFieldState, setError, clearErrors, control } = form
  const [network, walletChoice, connector] = useWatch({ control, name: ['network', 'walletChoice', 'connector'] })
  const locked = walletChoice !== MANUAL_WALLET
  const selectedWallet = registered.find((wallet) => wallet.id === walletChoice)
  const [payerOpen, setPayerOpen] = useState(defaults.walletChoice === MANUAL_WALLET)

  // Debounced draft (no secrets) per user; stops once the order exists.
  const draftDone = useRef(false)
  const flushDraft = () => {
    if (!draftDone.current) saveCheckoutDraft(userId, getValues())
  }
  const watched = useWatch({ control })
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!draftDone.current) saveCheckoutDraft(userId, getValues())
    }, DRAFT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [watched, userId, getValues])

  // Quote on the network of the chosen wallet; coupon errors fall back to the coupon-less quote.
  const parsedNetwork = networkSchema.safeParse(network)
  const quoteNetwork: Network = parsedNetwork.success ? parsedNetwork.data : CART_NETWORK
  const quote = useQuote({ coupon: cupom, network: quoteNetwork })
  const couponError = couponErrorOf(quote.error)
  const fallback = useQuote({ network: quoteNetwork }, { enabled: Boolean(couponError) })
  const active = couponError ? fallback : quote
  const shownQuote = active.data
  const reviewableQuote =
    shownQuote && !active.isPlaceholderData && shownQuote.network === quoteNetwork ? shownQuote : undefined
  const latestQuote = useRef(reviewableQuote)
  useEffect(() => {
    latestQuote.current = reviewableQuote
  }, [reviewableQuote])

  const { lines } = cart
  const issues = stockIssues(cart)
  const [blockingError, setBlockingError] = useState<string | null>(null)
  const names = useMemo(() => Object.fromEntries(lines.map((line) => [line.lineId, line.nft.name])), [lines])

  // Flow state (+ refs for async callbacks and realtime handlers).
  const [flow, setFlowState] = useState<Flow>({ step: 'idle' })
  const flowRef = useRef(flow)
  const setFlow = (next: Flow) => {
    flowRef.current = next
    setFlowState(next)
  }
  const [connectedTarget, setConnectedTarget] = useState<string | null>(null)
  const targetKey = `${walletChoice}|${connector}`
  const connect = useConnectWallet()
  const createOrder = useCreateOrder()
  const sending = useRef(false)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const walletLabel = selectedWallet
    ? `${walletTitle(selectedWallet)} · ${shortAddress(selectedWallet.address)}`
    : getValues('walletAddress')
      ? shortAddress(getValues('walletAddress').trim())
      : 'carteira informada'
  const connectorLabel = connector ? CONNECTOR_LABELS[connector as Connector] : ''

  function applyWallet(choice: string) {
    const wallet = registered.find((w) => w.id === choice)
    if (wallet) {
      const fields = walletFields(wallet)
      for (const [name, value] of Object.entries(fields)) {
        setValue(name as keyof typeof fields, value, { shouldDirty: true })
      }
      clearErrors(['network', 'walletAddress', 'secondaryAddress', 'connector', 'ensName'])
    } else if (!desktop) {
      setPayerOpen(true)
    }
  }

  // Network-specific rules: changing the network re-checks the address fields that hold a value.
  const revalidateAddresses = () => {
    const fields = (['walletAddress', 'secondaryAddress'] as const).filter((field) => getValues(field))
    const toCheck: (keyof CheckoutFormValues)[] = [...fields]
    if (getFieldState('ensName').error) toCheck.push('ensName')
    if (toCheck.length > 0) void trigger(toCheck)
  }

  function focusField(name: keyof CheckoutFormValues) {
    if (!desktop && name !== 'walletChoice' && name !== 'connector') setPayerOpen(true)
    requestAnimationFrame(() => {
      let element: HTMLElement | null = null
      if (name === 'walletChoice') element = document.querySelector('[data-field="walletChoice"] input')
      else if (name === 'connector') {
        element = desktop
          ? document.getElementById('pagamento-tipo')
          : document.querySelector('[data-field="connector"] input')
      } else element = document.getElementById(FOCUS_IDS[name] ?? '')
      element?.focus()
    })
  }

  function openReview() {
    const current = latestQuote.current
    if (!current) {
      setFlow({ step: 'idle' })
      toast.error('O total ainda está sendo calculado. Tente novamente em instantes.')
      return
    }
    createOrder.reset()
    setFlow({ step: 'review', quote: current })
  }

  function startConnect() {
    setFlow({ step: 'connect', status: 'pending' })
    const key = targetKey
    connect.mutate(connectTarget(getValues()), {
      onSuccess: () => {
        // The collector may have cancelled, or the wallet disconnected, meanwhile.
        if (flowRef.current.step !== 'connect') return
        setConnectedTarget(key)
        openReview()
      },
      onError: (error) => {
        if (flowRef.current.step !== 'connect') return
        const apiError = toApiError(error)
        // An expired session is handled globally (redirect to /entrar, draft kept).
        if (apiError.status === 401 || apiError.code === 'CANCELED') return
        setFlow({ step: 'connect', status: apiError.code === 'WALLET_REJECTED' ? 'rejected' : 'error' })
      },
    })
  }

  const onConfirm = (event: React.FormEvent<HTMLFormElement>) =>
    void form.handleSubmit(
    () => {
      flushDraft()
      setBlockingError(null)
      if (connectedTarget === targetKey) openReview()
      else startConnect()
    },
    (invalid) => {
      flushDraft()
      const first = FIELD_ORDER.find((field) => invalid[field])
      if (first) focusField(first)
      announce('Verifique os campos destacados', 'assertive')
    },
  )(event)

  function submit(variables: CreateOrderVariables) {
    sending.current = true
    createOrder.mutate(variables, {
      onSuccess: (order) => {
        draftDone.current = true
        savePendingOrderId(userId, order.id)
        clearAttempt(userId)
        clearCheckoutDraft(userId)
        dismissPriceNotices()
        void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id } })
      },
      onError: (error) => {
        const current = flowRef.current
        if (current.step !== 'review') return
        const apiError = toApiError(error)
        if (apiError.status === 401 || isUncertainOrderError(error)) return
        if (apiError.code === 'QUOTE_STALE') {
          const next = quoteSchema.safeParse((apiError.details as { quote?: unknown } | undefined)?.quote)
          void queryClient.invalidateQueries({ queryKey: ['quote'] })
          if (next.success) setFlow({ step: 'stale', previous: current.quote, next: next.data })
          else setFlow({ ...current, error: SEND_ERROR })
          return
        }
        if (apiError.code === 'OUT_OF_STOCK') {
          setFlow({ step: 'idle' })
          setBlockingError('Alguns itens não têm mais estoque suficiente. Ajuste o carrinho para continuar.')
          void queryClient.invalidateQueries({ queryKey: ['quote'] })
          void queryClient.invalidateQueries({ queryKey: ['user', userId, 'cart'] })
          return
        }
        const fields = Object.entries(apiError.fieldErrors ?? {}).filter(([name]) => SERVER_FIELDS[name])
        if (apiError.code === 'VALIDATION_ERROR' && fields.length > 0) {
          setFlow({ step: 'idle' })
          fields.forEach(([name, messages]) => setError(SERVER_FIELDS[name], { message: messages[0] }))
          focusField(SERVER_FIELDS[fields[0][0]])
          announce('Verifique os campos destacados', 'assertive')
          return
        }
        if (apiError.code === 'IDEMPOTENCY_CONFLICT') clearAttempt(userId)
        setFlow({ ...current, error: apiError.message && apiError.code !== 'INVALID_RESPONSE' ? apiError.message : SEND_ERROR })
      },
      onSettled: () => {
        sending.current = false
      },
    })
  }

  async function send() {
    const current = flowRef.current
    if (current.step !== 'review' || sending.current || createOrder.isPending) return
    sending.current = true
    setFlow({ step: 'review', quote: current.quote })
    const input = toOrderInput(getValues(), current.quote.quoteId)
    // Same payload → same stored key: a resend can never create a second order.
    const attempt = getAttempt(userId, await hashPayload(input))
    submit({ input, idempotencyKey: attempt.key })
  }

  function verifyOrder() {
    if (createOrder.variables && !createOrder.isPending) submit(createOrder.variables)
  }

  function closeFlow() {
    if (createOrder.isPending) return
    connect.reset()
    createOrder.reset()
    setFlow({ step: 'idle' })
  }

  // Wallet connection lost (steps 2–4): back to step 2 with the form intact. An order already in
  // flight is not abandoned: its answer still decides the outcome.
  useRealtimeEvent('wallet.disconnected', () => {
    const wasActive = connectedTarget !== null || flowRef.current.step !== 'idle'
    setConnectedTarget(null)
    if (!wasActive) return
    if (!createOrder.isPending) {
      connect.reset()
      createOrder.reset()
      setFlow({ step: 'idle' })
    }
    toast.warning('Carteira desconectada. Conecte novamente.')
  })

  const uncertain =
    flow.step === 'review' &&
    ((createOrder.isPending && createOrder.failureCount > 0) ||
      (createOrder.isError && isUncertainOrderError(createOrder.error)))

  let dialog = null
  if (flow.step === 'connect') {
    dialog = (
      <ConnectWalletDialog
        walletLabel={`${walletLabel} via ${connectorLabel}`}
        status={flow.status}
        onRetry={startConnect}
        onCancel={closeFlow}
      />
    )
  } else if (flow.step === 'review' && uncertain) {
    dialog = <PendingOrderDialog checking={createOrder.isPending} onVerify={verifyOrder} onClose={closeFlow} />
  } else if (flow.step === 'review') {
    dialog = (
      <ReviewDialog
        quote={flow.quote}
        names={names}
        walletLabel={walletLabel}
        connectorLabel={connectorLabel}
        networkLabel={NETWORK_LABELS[flow.quote.network]}
        submitting={createOrder.isPending}
        error={flow.error}
        onSend={() => void send()}
        onBack={closeFlow}
      />
    )
  } else if (flow.step === 'stale') {
    dialog = (
      <QuoteChangedDialog
        previous={flow.previous}
        next={flow.next}
        names={names}
        onConfirm={() => {
          createOrder.reset()
          setFlow({ step: 'review', quote: flow.next })
        }}
        onCancel={closeFlow}
      />
    )
  }

  const blocked = issues.length > 0
  const confirmDisabled = blocked || !reviewableQuote
  const walletRegistration = register('walletChoice', { onChange: (event) => applyWallet(event.target.value) })
  const manageHref = {
    to: '/perfil/carteiras' as const,
    search: { redirect: `/pagamento${cupom ? `?cupom=${cupom}` : ''}` },
  }

  const notices = (
    <>
      <PriceChangeNotice nftIds={lines.map((line) => line.nftId)} />
      {issues.length > 0 && (
        <ChangeNotice
          id={STOCK_NOTICE_ID}
          title="Ajuste as quantidades no carrinho para continuar"
          items={issues.map((issue) => `${issue.name}: ${outOfStockMessage(issue.available)}`)}
        />
      )}
      {blockingError && (
        <div role="alert" className="flex flex-col gap-2 rounded-sm border border-danger/60 bg-danger/10 px-4 py-3">
          <p className="text-body-15 text-foreground">{blockingError}</p>
          <Link to="/carrinho" className="text-body-15 text-text-accent underline underline-offset-4">
            Voltar ao carrinho
          </Link>
        </div>
      )}
    </>
  )

  const confirm = (
    <Button
      ref={confirmRef}
      type="submit"
      disabled={confirmDisabled}
      aria-describedby={blocked ? STOCK_NOTICE_ID : undefined}
      className={cn(
        'w-full',
        desktop
          ? 'h-14 rounded-sm text-body-lg-17'
          : 'h-16 rounded-full bg-gradient-to-r from-primary-light to-primary-dark text-body-lg-18',
      )}
    >
      Confirmar compra
    </Button>
  )

  const coupon = {
    code: cupom,
    applied: shownQuote?.coupon ?? null,
    error: couponError,
    checking: Boolean(cupom) && quote.isFetching,
    onApply: (code: string) => onCouponChange(code),
    onRemove: () => {
      onCouponChange(undefined)
      announce('Cupom removido')
    },
  }

  const formFields = (children?: React.ReactNode) => (
    <CheckoutForm form={form} locked={locked} onNetworkChange={revalidateAddresses}>
      {children}
    </CheckoutForm>
  )

  return (
    <>
      <form noValidate aria-label="Pagamento" onSubmit={onConfirm}>
        {desktop ? (
          <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_489px] lg:items-start lg:gap-10">
            <section aria-labelledby="perfil-colecionador-titulo" className="flex min-w-0 flex-col gap-4">
              <h2 id="perfil-colecionador-titulo" className="text-title-20 font-bold text-foreground">
                Perfil do colecionador
              </h2>
              {formFields(
                <WalletPicker wallets={registered} registration={walletRegistration} manageHref={manageHref} variant="rows" />,
              )}
            </section>
            <div className="flex min-w-0 flex-col gap-6">
              {notices}
              <CheckoutSummary
                lines={lines}
                quote={shownQuote}
                updating={active.isPlaceholderData || active.isFetching}
                coupon={coupon}
              />
              <section aria-labelledby="carteira-rede-titulo" className="flex flex-col gap-5">
                <h2 id="carteira-rede-titulo" className="text-center text-title-20 font-bold text-foreground">
                  Carteira e rede
                </h2>
                <ConnectorPicker
                  registration={register('connector')}
                  titleId="carteira-rede-titulo"
                  variant="rows"
                />
              </section>
              {confirm}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <section aria-labelledby="carteira-conectada-titulo" className="flex flex-col gap-6">
              <div className="flex items-center justify-between gap-4">
                <h2 id="carteira-conectada-titulo" className="text-title-20 font-bold text-foreground">
                  Carteira conectada
                </h2>
                <Link {...manageHref} className="text-body-lg-17 font-bold whitespace-nowrap text-text-accent">
                  Trocar carteira
                </Link>
              </div>
              <WalletPicker wallets={registered} registration={walletRegistration} manageHref={manageHref} variant="cards" />
            </section>
            <section aria-labelledby="carteira-rede-titulo" className="flex flex-col gap-6">
              <h2 id="carteira-rede-titulo" className="text-title-20 font-bold text-foreground">
                Carteira e rede
              </h2>
              <ConnectorPicker
                registration={register('connector')}
                titleId="carteira-rede-titulo"
                error={form.formState.errors.connector?.message}
                variant="cards"
              />
            </section>
            {notices}
            <section className="flex flex-col gap-4">
              <button
                type="button"
                aria-expanded={payerOpen}
                aria-controls="dados-colecionador"
                onClick={() => setPayerOpen((open) => !open)}
                className="flex items-center justify-between rounded-[20px] bg-surface px-6 py-4 text-left text-body-lg-17 font-bold text-foreground"
              >
                Dados do colecionador
                <ChevronDown aria-hidden className={cn('size-5 transition-transform', payerOpen && 'rotate-180')} />
              </button>
              <div id="dados-colecionador" hidden={!payerOpen}>
                {formFields()}
              </div>
            </section>
            <p className="flex items-baseline justify-end gap-8 text-title-22 font-bold text-foreground">
              Total:
              <span data-testid="checkout-total" aria-busy={active.isFetching} className="text-[28px] text-text-accent">
                {shownQuote ? formatEth(shownQuote.total) : '…'}
              </span>
            </p>
            {confirm}
          </div>
        )}
      </form>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && closeFlow()}>
        <DialogContent
          showCloseButton={false}
          aria-busy={createOrder.isPending || undefined}
          onEscapeKeyDown={(event) => {
            if (createOrder.isPending) event.preventDefault()
          }}
          onInteractOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            confirmRef.current?.focus()
          }}
          className="max-w-[calc(100%-2rem)] gap-5 border-border-strong bg-surface sm:max-w-lg"
        >
          {dialog}
        </DialogContent>
      </Dialog>
    </>
  )
}
