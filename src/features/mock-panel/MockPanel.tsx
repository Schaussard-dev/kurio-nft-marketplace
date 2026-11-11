import { FlaskConical } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
// Type-only: no mock runtime code enters the app bundle.
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

/** Survives the reload after a reseed: the active scenario and the confirmation to show once. */
const PANEL_STATE_KEY = 'kurio-mock-panel'
interface PanelState {
  scenario: ScenarioName
  flash?: string
}

function readPanelState(): PanelState | null {
  try {
    const raw = sessionStorage.getItem(PANEL_STATE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<PanelState>) : null
    if (!parsed || typeof parsed.scenario !== 'string' || !(parsed.scenario in SCENARIO_LABELS)) return null
    return { scenario: parsed.scenario, flash: typeof parsed.flash === 'string' ? parsed.flash : undefined }
  } catch {
    return null
  }
}

function writePanelState(state: PanelState): void {
  try {
    sessionStorage.setItem(PANEL_STATE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable: the reload still applies the reseed, only the confirmation is lost.
  }
}

export default function MockPanel() {
  const [initial] = useState(readPanelState)
  const [open, setOpen] = useState(Boolean(initial?.flash))
  const [scenario, setScenario] = useState<ScenarioName>(initial?.scenario ?? 'default')
  const [latency, setLatency] = useState('')
  const [nftId, setNftId] = useState('')
  const [price, setPrice] = useState('')
  const [eventId, setEventId] = useState('')

  // After a reseed the page reloads with the panel open; confirm the action here (id dedupes StrictMode).
  useEffect(() => {
    if (!initial?.flash) return
    toast.success(initial.flash, { id: 'mock-panel-flash' })
    writePanelState({ scenario: initial.scenario })
  }, [initial])

  /** `reseed` = the request rewound the mock DB to that scenario: the page reloads afterwards. */
  async function run(
    request: () => Promise<Response>,
    successMessage: string,
    reseed?: { scenario: ScenarioName },
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
        writePanelState({ scenario: reseed.scenario, flash: successMessage })
        window.location.reload()
        return true
      }
      toast.success(successMessage)
      return true
    } catch {
      toast.error('Não foi possível falar com a simulação')
      return false
    }
  }

  const emit = (body: EmitBody, message: string) => run(() => post('emit', body), message)

  // /scenario alone would not apply seed patches, so a scenario change always goes through a reseed.
  const applyScenario = async (next: ScenarioName) => {
    if (await run(() => post('reset', { scenario: next }), 'Cenário aplicado', { scenario: next })) setScenario(next)
  }

  const needNft = (action: () => void) => {
    if (!nftId.trim()) toast.error('Informe o ID do NFT')
    else action()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mock-panel-trigger fixed bottom-24 left-3 z-50 border border-border-strong lg:bottom-4"
        >
          <FlaskConical aria-hidden />
          Simulação
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
            onClick={() => void run(() => post('reset', { scenario }), 'Dados reiniciados', { scenario })}
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
