import { FlaskConical } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
// The panel itself is only loaded in demo builds (lazy, behind VITE_ENABLE_MOCKS): the production bundle
// never reaches these mock modules (scripts/check-prod-bundle.mjs).
import { getMockConfig } from '@/mocks/config'
import type { ScenarioName } from '@/mocks/scenarios'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/ui/sheet'

/**
 * Demo tooling. Talks to the mock control endpoints with plain `fetch` on purpose: it is the only
 * non-axios network call and is never part of the production build (see ARCHITECTURE).
 */
const SCENARIO_LABELS: Record<ScenarioName, string> = {
  default: 'Padrão',
  empty: 'Catálogo vazio',
  slow: 'Rede lenta',
  jitter: 'Latência variável',
  offline: 'Sem rede',
  'server-error': 'Erro de servidor',
  'favorite-fail': 'Falha ao favoritar',
  'session-expired': 'Sessão expirada',
  'signup-conflict': 'Conflito no cadastro',
  'price-change': 'Preço alterado',
  'sold-out': 'Esgotado',
  'order-timeout': 'Pedido demora a confirmar',
  'payment-declined': 'Pagamento recusado',
  'wallet-reject': 'Carteira rejeita',
}
const SCENARIOS = Object.keys(SCENARIO_LABELS) as ScenarioName[]

type EmitBody =
  | { action: 'session:expire' | 'socket:restore' | 'wallet:disconnect' }
  | { action: 'socket:drop'; seconds?: number }
  | { action: 'nft:update'; nftId: string; price?: string; editions?: number }
  | { action: 'event:replay'; eventId: string }

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`/api/__mock/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Survives the reload after a reseed: the confirmation to show once. */
const PANEL_STATE_KEY = 'kurio-mock-panel'
interface PanelState {
  flash: string
}

function readPanelState(): PanelState | null {
  try {
    const raw = sessionStorage.getItem(PANEL_STATE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<PanelState>) : null
    return parsed && typeof parsed.flash === 'string' ? { flash: parsed.flash } : null
  } catch {
    return null
  }
}

function writePanelState(state: PanelState | null): void {
  try {
    if (state) sessionStorage.setItem(PANEL_STATE_KEY, JSON.stringify(state))
    else sessionStorage.removeItem(PANEL_STATE_KEY)
  } catch {
    // Storage unavailable: the reload still applies the reseed, only the confirmation is lost.
  }
}

export default function MockPanel() {
  const [initial] = useState(readPanelState)
  const [open, setOpen] = useState(Boolean(initial?.flash))
  // The mock config is the source of truth: `?scenario=`, the control API and this panel all write it.
  const [scenario, setScenario] = useState<ScenarioName>(() => getMockConfig().scenario)
  // The fixed latency survives reloads (session config): show it instead of an empty "scenario latency" field.
  const [latency, setLatency] = useState(() => String(getMockConfig().latencyOverride ?? ''))
  const [nftId, setNftId] = useState('')
  const [price, setPrice] = useState('')
  const [eventId, setEventId] = useState('')

  // After a reseed the page reloads with the panel open; confirm the action here (id dedupes StrictMode).
  useEffect(() => {
    if (!initial?.flash) return
    toast.success(initial.flash, { id: 'mock-panel-flash' })
    writePanelState(null)
  }, [initial])

  /** `reseed` = the request rewound the mock DB: the page reloads afterwards. */
  async function run(
    request: () => Promise<Response>,
    successMessage: string,
    reseed = false,
    onOk?: (res: Response) => Promise<void>,
  ): Promise<boolean> {
    try {
      const res = await request()
      if (res.status === 501) {
        toast.error('Ação ainda não disponível')
        return false
      }
      if (!res.ok) {
        toast.error('A simulação recusou a ação')
        return false
      }
      if (reseed) {
        // A reseed rewinds the mock DB (versions, sessions, carts): only a fresh page load drops every
        // client-side trace of the old data (query cache, realtime version barrier, socket room).
        writePanelState({ flash: successMessage })
        window.location.reload()
        return true
      }
      await onOk?.(res)
      toast.success(successMessage)
      return true
    } catch {
      toast.error('Não foi possível falar com a simulação')
      return false
    }
  }

  // A price/stock change answers with its event id: keep it so "Reenviar último evento" can replay it.
  const emit = (body: EmitBody, message: string) =>
    run(() => post('emit', body), message, false, async (res) => {
      if (body.action !== 'nft:update') return
      const data = (await res.json().catch(() => null)) as { eventId?: unknown } | null
      if (typeof data?.eventId === 'string') setEventId(data.eventId)
    })

  // /scenario alone would not apply seed patches, so a scenario change always goes through a reseed.
  const applyScenario = async (next: ScenarioName) => {
    if (await run(() => post('reset', { scenario: next }), 'Cenário aplicado', true)) setScenario(next)
  }

  const needNft = (action: () => void) => {
    if (!nftId.trim()) toast.error('Informe o ID do NFT')
    else action()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Re-read on open: the scenario may have changed through the control API since the last render.
        if (next) setScenario(getMockConfig().scenario)
        setOpen(next)
      }}
    >
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          // Phones get an icon-only 40px button (it floats over content); the label stays as its accessible name.
          className="mock-panel-trigger fixed bottom-24 left-3 z-50 border border-border-strong max-lg:size-10 max-lg:rounded-full max-lg:p-0 lg:bottom-4"
        >
          <FlaskConical aria-hidden />
          <span className="max-lg:sr-only">Simulação</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[340px] max-w-full gap-0 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Simulação</SheetTitle>
          <SheetDescription>Ferramentas de demonstração: cenários e eventos simulados.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="mock-scenario">Cenário</Label>
            <Select value={scenario} onValueChange={(v) => void applyScenario(v as ScenarioName)}>
              <SelectTrigger id="mock-scenario" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENARIOS.map((name) => (
                  <SelectItem key={name} value={name}>
                    {SCENARIO_LABELS[name]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="mock-latency">Latência (ms)</Label>
            <div className="flex gap-2">
              <Input
                id="mock-latency"
                type="number"
                min={0}
                inputMode="numeric"
                value={latency}
                onChange={(e) => setLatency(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const ms = latency === '' ? null : Number(latency)
                  if (ms !== null && (!Number.isFinite(ms) || ms < 0)) {
                    toast.error('Latência inválida')
                    return
                  }
                  void run(() => post('scenario', { scenario, latencyOverride: ms }), 'Latência aplicada')
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void run(() => post('reset', { scenario }), 'Dados reiniciados', true)}
          >
            Reset
          </Button>

          <div className="grid gap-2">
            <Button type="button" variant="secondary" onClick={() => void emit({ action: 'session:expire' }, 'Sessão expirada')}>
              Expirar sessão
            </Button>
            <Button type="button" variant="secondary" onClick={() => void emit({ action: 'socket:drop' }, 'Conexão derrubada')}>
              Derrubar conexão
            </Button>
            <Button type="button" variant="secondary" onClick={() => void emit({ action: 'socket:restore' }, 'Conexão restaurada')}>
              Restaurar conexão
            </Button>
            <Button type="button" variant="secondary" onClick={() => void emit({ action: 'wallet:disconnect' }, 'Carteira desconectada')}>
              Desconectar carteira
            </Button>
          </div>

          <fieldset className="flex flex-col gap-2 border-t border-border pt-4">
            <legend className="sr-only">NFT alvo</legend>
            <Label htmlFor="mock-nft-id">ID do NFT</Label>
            <Input id="mock-nft-id" value={nftId} onChange={(e) => setNftId(e.target.value)} />
            <Label htmlFor="mock-price">Novo preço (ETH)</Label>
            <Input id="mock-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                needNft(() => {
                  if (!price.trim()) toast.error('Informe o novo preço')
                  else void emit({ action: 'nft:update', nftId: nftId.trim(), price: price.trim() }, 'Preço alterado')
                })
              }
            >
              Alterar preço de NFT do carrinho
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => needNft(() => void emit({ action: 'nft:update', nftId: nftId.trim(), editions: 0 }, 'Edição esgotada'))}
            >
              Esgotar edição
            </Button>
          </fieldset>

          <fieldset className="flex flex-col gap-2 border-t border-border pt-4">
            <legend className="sr-only">Evento</legend>
            <Label htmlFor="mock-event-id">ID do evento</Label>
            <Input id="mock-event-id" value={eventId} onChange={(e) => setEventId(e.target.value)} />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!eventId.trim()) toast.error('Informe o ID do evento')
                else void emit({ action: 'event:replay', eventId: eventId.trim() }, 'Evento reenviado')
              }}
            >
              Reenviar último evento
            </Button>
          </fieldset>
        </div>
      </SheetContent>
    </Sheet>
  )
}
