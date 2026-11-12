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
  orderUpdatedDataSchema,
  quoteSchema,
  type Cart,
  type Network,
  type Profile,
  type Quote,
  type WalletsResponse,
} from '@/shared/contracts'
import { Breadcrumbs } from '@/shared/layout/Breadcrumbs'
import { formatEth } from '@/shared/lib/format'
import { clearAttempt } from '@/shared/lib/idempotency'
import { useMediaQuery } from '@/shared/lib/use-media-query'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent } from '@/shared/ui/dialog'
import { useAnnounce } from '@/shared/ui/LiveRegion'
import { Skeleton } from '@/shared/ui/Skeleton'
import { readAttempt, startAttempt, type AttemptDisplay, type StoredAttempt } from '../attempt'
import { clearCheckoutDraft, loadCheckoutDraft, MANUAL_WALLET, saveCheckoutDraft, type Connector } from '../draft'
import {
  checkoutFormSchema,
  CONNECTOR_LABELS,
  connectTarget,
  FIELD_ORDER,
  initialValues,
  isUnchangedQuote,
  NETWORK_LABELS,
  registeredWallets,
  shortAddress,
  toOrderInput,
  walletFields,
  walletTitle,
  type CheckoutFormValues,
} from '../form'
import { hashPayload } from '../payload-hash'
import { rememberPendingOrder } from '@/features/orders/pending-order'
import { orderOutcomeText } from '@/features/orders/queries'
import { isUncertainOrderError, useCreateOrder, type CreateOrderVariables } from '../queries'
import { CheckoutForm } from './CheckoutForm'
import { CheckoutSummary } from './CheckoutSummary'
import { ConnectorPicker } from './ConnectorPicker'
import { ConnectWalletDialog, type ConnectStatus } from './ConnectWalletDialog'
import { PendingOrderDialog } from './PendingOrderDialog'
import { QuoteChangedDialog } from './QuoteChangedDialog'
import { ReviewDialog } from './ReviewDialog'
import { WalletPicker } from './WalletPicker'
import { useDocumentTitle } from '@/shared/lib/use-document-title'

type Flow =
  | { step: 'idle' }
  | { step: 'connect'; status: ConnectStatus }
  | { step: 'review'; quote: Quote; error?: string; replay?: StoredAttempt }
  | { step: 'stale'; previous: Quote; next: Quote }

const DRAFT_DEBOUNCE_MS = 300
const STOCK_NOTICE_ID = 'pagamento-aviso-estoque'
const SEND_ERROR = 'Não foi possível enviar o pedido. Tente novamente.'
const REPLAY_ENDED = 'O pedido anterior não foi registrado. Revise os dados atuais e envie o pedido novamente.'

/** Names the replayed attempt by what was reviewed for it (not by the current screen). */
function replayNoticeText(display: AttemptDisplay): string {
  return `Vamos reenviar o pedido anterior, que ainda aguarda confirmação: ${display.walletLabel} via ${display.connectorLabel} · Rede ${display.networkLabel} · total ${formatEth(display.quote.total)}. Nenhuma compra nova será criada.`
}

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
      <h1 className="flex-1 text-title-20 font-bold text-foreground">Pagamento com carteira</h1>
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

  useDocumentTitle('Pagamento')

  let content
  if (profile.isError || wallets.isError) {
    content = (
      <LoadError
        message="Não foi possível carregar seus dados de pagamento."
        // One click retries everything that failed (the cart too), not just the first error shown.
        onRetry={() => {
          void profile.refetch()
          void wallets.refetch()
          if (cart.isError) void cart.refetch()
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
  const knownWalletIds = registered.map((wallet) => wallet.id).join(',')
  const flushDraft = () => {
    if (draftDone.current) return
    saveCheckoutDraft(userId, { ...getValues(), knownWalletIds: knownWalletIds.split(',').filter(Boolean) })
  }
  const watched = useWatch({ control })
  useEffect(() => {
    const timer = setTimeout(() => {
      if (draftDone.current) return
      saveCheckoutDraft(userId, { ...getValues(), knownWalletIds: knownWalletIds.split(',').filter(Boolean) })
    }, DRAFT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [watched, userId, getValues, knownWalletIds])

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
  // Latest values for callbacks that outlive the render that created them (mutation results).
  const connectedRef = useRef(connectedTarget)
  const targetRef = useRef(targetKey)
  useEffect(() => {
    connectedRef.current = connectedTarget
    targetRef.current = targetKey
  }, [connectedTarget, targetKey])
  const [flowNotice, setFlowNotice] = useState<string | null>(null)
  const connect = useConnectWallet()
  const createOrder = useCreateOrder()
  const sending = useRef(false)
  const autoRenewed = useRef(false)
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

  // The unresolved order attempt (outcome unknown), shown as a banner while no dialog is open.
  const [pendingAttempt, setPendingAttempt] = useState<StoredAttempt | null>(() => readAttempt(userId))
  const forgetAttempt = () => {
    clearAttempt(userId)
    setPendingAttempt(null)
  }
  // A banner present at mount is not announced by a role="status" region: say it once per attempt.
  const announcedAttempt = useRef<string | null>(null)
  const attemptBannerShown = pendingAttempt !== null && flow.step === 'idle'
  useEffect(() => {
    if (!attemptBannerShown || !pendingAttempt || announcedAttempt.current === pendingAttempt.key) return
    announcedAttempt.current = pendingAttempt.key
    announce('Um pedido anterior ficou sem confirmação. Verifique-o antes de continuar.')
  }, [attemptBannerShown, pendingAttempt, announce])

  /** Review of the current quote, or, while an attempt is unresolved, of exactly what that attempt sent. */
  function openReview() {
    createOrder.reset()
    const stored = readAttempt(userId)
    setPendingAttempt(stored)
    if (stored) {
      setFlow({ step: 'review', quote: stored.display.quote, replay: stored })
      return
    }
    const current = latestQuote.current
    if (!current) {
      setFlow({ step: 'idle' })
      toast.error('O total ainda está sendo calculado. Tente novamente em instantes.')
      return
    }
    setFlow({ step: 'review', quote: current })
  }

  /** Back to a normal review of the current form and quote, after a replay ended without an order. */
  function restartReview(error: string) {
    const current = latestQuote.current
    // A review of the current data is only allowed once the wallet approved it (same rule as "Confirmar
    // compra"): otherwise back to the form, where "Confirmar compra" asks the wallet first.
    if (!current || connectedRef.current !== targetRef.current) {
      setFlow({ step: 'idle' })
      setFlowNotice(error)
      return
    }
    setFlow({ step: 'review', quote: current, error })
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
        setFlowNotice(null)
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

  /** 4xx other than 401/408/429: the server decided, so the attempt is over and a new key may be minted. */
  function isDefinitive(status: number): boolean {
    return status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429
  }

  function submit(variables: CreateOrderVariables, replay: boolean) {
    sending.current = true
    createOrder.mutate(variables, {
      onSuccess: (order) => {
        draftDone.current = true
        rememberPendingOrder(userId, order.id)
        forgetAttempt()
        clearCheckoutDraft(userId)
        dismissPriceNotices()
        void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id } })
      },
      onError: (error) => {
        const apiError = toApiError(error)
        // Uncertain outcomes keep the attempt: only the same payload + key may be sent again.
        if (isDefinitive(apiError.status)) forgetAttempt()
        const current = flowRef.current
        if (current.step !== 'review') return
        if (apiError.status === 401 || isUncertainOrderError(error)) return
        if (apiError.code === 'OUT_OF_STOCK') {
          setFlow({ step: 'idle' })
          setBlockingError('Alguns itens não têm mais estoque suficiente. Ajuste o carrinho para continuar.')
          void queryClient.invalidateQueries({ queryKey: ['quote'] })
          void queryClient.invalidateQueries({ queryKey: ['user', userId, 'cart'] })
          return
        }
        if (replay) {
          // The earlier order was never created (stale quote, data no longer valid…): nothing of that
          // old payload is mapped onto the current screen; the normal review of the current data starts.
          if (apiError.code === 'QUOTE_STALE') void queryClient.invalidateQueries({ queryKey: ['quote'] })
          restartReview(REPLAY_ENDED)
          return
        }
        if (apiError.code === 'QUOTE_STALE') {
          const next = quoteSchema.safeParse((apiError.details as { quote?: unknown } | undefined)?.quote)
          void queryClient.invalidateQueries({ queryKey: ['quote'] })
          if (!next.success) return setFlow({ ...current, error: SEND_ERROR })
          if (isUnchangedQuote(current.quote, next.data) && !autoRenewed.current) {
            // Same value under a renewed quote (e.g. expired): never ask to confirm an unchanged value.
            autoRenewed.current = true
            setFlow({ step: 'review', quote: next.data })
            sending.current = false
            setTimeout(() => void sendRef.current(), 0)
            return
          }
          setFlow({ step: 'stale', previous: current.quote, next: next.data })
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
        setFlow({ ...current, error: apiError.message && apiError.code !== 'INVALID_RESPONSE' ? apiError.message : SEND_ERROR })
      },
      onSettled: () => {
        sending.current = false
      },
    })
  }

  /**
   * "Enviar pedido". A replay review re-sends its stored payload and key unchanged; otherwise the
   * current data becomes a new attempt (payload + review snapshot) stored before the request.
   */
  async function send() {
    const current = flowRef.current
    if (current.step !== 'review' || sending.current) return
    sending.current = true
    let submitted = false
    try {
      if (current.replay) {
        setFlow({ ...current, error: undefined })
        submit({ input: current.replay.payload, idempotencyKey: current.replay.key }, true)
        submitted = true
        return
      }
      setFlow({ step: 'review', quote: current.quote })
      const input = toOrderInput(getValues(), current.quote.quoteId)
      const display = {
        quote: current.quote,
        walletLabel,
        connectorLabel,
        networkLabel: NETWORK_LABELS[current.quote.network],
      }
      const attempt = startAttempt(userId, await hashPayload(input), input, display)
      setPendingAttempt(attempt)
      if (attempt.reused) {
        // Another send left an unresolved attempt meanwhile: that one is what goes out, and what is shown.
        setFlow({ step: 'review', quote: attempt.display.quote, replay: attempt })
      }
      submit({ input: attempt.payload, idempotencyKey: attempt.key }, attempt.reused)
      submitted = true
    } catch {
      setFlow({ ...current, error: SEND_ERROR })
    } finally {
      if (!submitted) sending.current = false
    }
  }
  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  })

  /** "Verificar pedido" (pending dialog or page banner): the stored attempt, unchanged. */
  function verifyOrder() {
    const stored = readAttempt(userId)
    setPendingAttempt(stored)
    if (!stored || sending.current) return
    const current = flowRef.current
    if (current.step !== 'review' || !current.replay) {
      createOrder.reset()
      setFlow({ step: 'review', quote: stored.display.quote, replay: stored })
    }
    submit({ input: stored.payload, idempotencyKey: stored.key }, true)
  }

  function closeFlow() {
    if (createOrder.isPending) return
    connect.reset()
    createOrder.reset()
    setPendingAttempt(readAttempt(userId))
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
      setPendingAttempt(readAttempt(userId))
      setFlow({ step: 'idle' })
    }
    toast.warning('Carteira desconectada. Conecte novamente.')
  })

  // The unresolved attempt's order reached its outcome although its answer was lost (spec §9 step 6):
  // the attempt is over (the orders feature already cleared it); from an open dialog, go to the result.
  useRealtimeEvent('order.updated', (envelope) => {
    const parsed = orderUpdatedDataSchema.safeParse(envelope.data)
    if (!parsed.success || parsed.data.order.status === 'pending') return
    const { order } = parsed.data
    if (!pendingAttempt || pendingAttempt.key !== order.idempotencyKey) return
    setPendingAttempt(null)
    // The orders feature leaves this outcome to the checkout: exactly one feedback, here.
    if (flowRef.current.step === 'idle') {
      toast(orderOutcomeText(order))
      return
    }
    announce(orderOutcomeText(order))
    // A request still in flight answers with this same order and navigates by itself.
    if (createOrder.isPending) return
    draftDone.current = true
    connect.reset()
    createOrder.reset()
    setFlow({ step: 'idle' })
    void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id } })
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
    const shown = flow.replay?.display
    dialog = (
      <ReviewDialog
        quote={flow.quote}
        names={names}
        walletLabel={shown ? shown.walletLabel : walletLabel}
        connectorLabel={shown ? shown.connectorLabel : connectorLabel}
        networkLabel={shown ? shown.networkLabel : NETWORK_LABELS[flow.quote.network]}
        submitting={createOrder.isPending}
        error={flow.error}
        replayNotice={shown && replayNoticeText(shown)}
        onSend={() => {
          autoRenewed.current = false
          void send()
        }}
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
      {pendingAttempt && flow.step === 'idle' && (
        <section
          aria-label="Pedido anterior sem confirmação"
          data-testid="pending-attempt"
          className="flex flex-col gap-3 rounded-sm border border-primary/60 bg-primary/10 px-4 py-3"
        >
          <p className="text-body-15 text-foreground">
            Um pedido anterior ficou sem confirmação ({pendingAttempt.display.walletLabel} · Rede{' '}
            {pendingAttempt.display.networkLabel} · total {formatEth(pendingAttempt.display.quote.total)}). Verifique-o
            antes de continuar: a verificação nunca cria uma segunda compra.
          </p>
          <Button type="button" variant="outline" className="h-11 self-start" onClick={verifyOrder}>
            Verificar pedido
          </Button>
        </section>
      )}
      <PriceChangeNotice nftIds={lines.map((line) => line.nftId)} />
      {issues.length > 0 && (
        <ChangeNotice
          id={STOCK_NOTICE_ID}
          title="Ajuste as quantidades no carrinho para continuar"
          items={issues.map((issue) => `${issue.name}: ${outOfStockMessage(issue.available)}`)}
        />
      )}
      {flowNotice && flow.step === 'idle' && (
        <p role="alert" className="rounded-sm border border-danger/60 bg-danger/10 px-4 py-3 text-body-15 text-foreground">
          {flowNotice}
        </p>
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
          ? 'h-10 rounded-[3px] text-body-15'
          : 'h-16 rounded-full bg-gradient-to-r from-primary-light to-primary-dark text-body-15',
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
              <h2 id="perfil-colecionador-titulo" className="text-body-lg-17 font-bold text-foreground">
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
                <h2 id="carteira-rede-titulo" className="text-center text-body-lg-17 font-bold text-foreground">
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
                <h2 id="carteira-conectada-titulo" className="text-body-lg-16 font-bold text-foreground">
                  Carteira conectada
                </h2>
                <Link {...manageHref} className="text-body-14 font-bold whitespace-nowrap text-text-accent">
                  Trocar carteira
                </Link>
              </div>
              <WalletPicker wallets={registered} registration={walletRegistration} manageHref={manageHref} variant="cards" />
            </section>
            <section aria-labelledby="carteira-rede-titulo" className="flex flex-col gap-6">
              <h2 id="carteira-rede-titulo" className="text-body-lg-16 font-bold text-foreground">
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
            <p className="flex items-baseline justify-end gap-8 text-body-lg-16 font-bold text-foreground">
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
