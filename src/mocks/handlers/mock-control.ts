import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { setMockConfig, getMockConfig } from '../config'
import { mutate, resetDb } from '../db/store'
import { resetLatencyRng, apiError, withNetwork } from '../network'
import { SCENARIO_NAMES, type ScenarioName } from '../scenarios'

const scenarioSchema = z.enum(SCENARIO_NAMES as [ScenarioName, ...ScenarioName[]])

const resetBodySchema = z.object({ scenario: scenarioSchema.optional() })
const scenarioBodySchema = z.object({
  scenario: scenarioSchema,
  latencyOverride: z.number().min(0).nullable().optional(),
})

const emitBodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('nft:update'),
    nftId: z.string(),
    price: z.string().optional(),
    editions: z.number().int().optional(),
  }),
  z.object({ action: z.literal('session:expire') }),
  z.object({ action: z.literal('socket:drop'), seconds: z.number().positive().optional() }),
  z.object({ action: z.literal('socket:restore') }),
  z.object({ action: z.literal('wallet:disconnect') }),
  z.object({ action: z.literal('event:replay'), eventId: z.string() }),
  z.object({ action: z.literal('order:resolve'), orderId: z.string() }),
])
export type MockEmitBody = z.infer<typeof emitBodySchema>
export type MockActionName = MockEmitBody['action']
type MockActionPayload<A extends MockActionName> = Extract<MockEmitBody, { action: A }>
export type MockActionHandler<A extends MockActionName = MockActionName> = (
  payload: MockActionPayload<A>,
) => void | Promise<void>

const actionHandlers = new Map<MockActionName, MockActionHandler<never>>()

/** Later tasks register the effect of an `/__mock/emit` action (mutate DB + emit through the mock socket). */
export function registerMockAction<A extends MockActionName>(name: A, handler: MockActionHandler<A>): void {
  actionHandlers.set(name, handler as unknown as MockActionHandler<never>)
}

async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text()
    return text ? JSON.parse(text) : {}
  } catch {
    return undefined
  }
}

const invalidBody = () => apiError(422, 'VALIDATION_ERROR', 'Corpo da requisição inválido')

// Control routes deliberately bypass withNetwork: scenario faults and latency never apply to them.
export const mockControlHandlers = [
  http.post('/api/__mock/reset', async ({ request }) => {
    const parsed = resetBodySchema.safeParse(await readJson(request))
    if (!parsed.success) return invalidBody()
    const scenario = parsed.data.scenario ?? getMockConfig().scenario
    setMockConfig({ scenario })
    resetLatencyRng()
    await resetDb(scenario)
    return HttpResponse.json({ ok: true })
  }),

  http.post('/api/__mock/scenario', async ({ request }) => {
    const parsed = scenarioBodySchema.safeParse(await readJson(request))
    if (!parsed.success) return invalidBody()
    const { scenario, latencyOverride } = parsed.data
    setMockConfig({ scenario, ...(latencyOverride !== undefined && { latencyOverride }) })
    resetLatencyRng()
    mutate((db) => {
      db.scenario = scenario
    })
    return HttpResponse.json({ ok: true })
  }),

  http.post('/api/__mock/emit', async ({ request }) => {
    const parsed = emitBodySchema.safeParse(await readJson(request))
    if (!parsed.success) return invalidBody()
    const handler = actionHandlers.get(parsed.data.action) as MockActionHandler | undefined
    if (!handler) return apiError(501, 'TRANSIENT', 'Ação ainda não disponível')
    await handler(parsed.data)
    return HttpResponse.json({ ok: true })
  }),

  // Mock-only probe used by e2e tests: the one control-area route that DOES follow scenario faults.
  http.get('/api/__mock/ping', withNetwork(() => HttpResponse.json({ ok: true }))),
]
