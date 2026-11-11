# Kurio NFT Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Kurio NFT marketplace (Jungle Gaming frontend challenge) with full purchase/account flows on a stateful MSW-simulated REST + Socket.IO backend, Playwright E2E/visual tests, Lighthouse audits and a Vercel deploy.

**Architecture:** Vite SPA. Feature folders own their Axios calls, TanStack Query hooks and components; Zod contracts in `src/shared/contracts` are shared by the client and the MSW handlers. All "server" behavior (state, scenarios, network faults, Socket.IO events) lives in `src/mocks`, activated by `VITE_ENABLE_MOCKS`; app code never knows it is mocked.

**Tech Stack:** vite 8.3.8, react 19.3.1, typescript 5.9.3, @tanstack/react-router 1.170.46 + @tanstack/router-plugin 1.169.0, @tanstack/react-query 5.107.1, axios 1.21.1, socket.io-client 4.8.4, tailwindcss 4.3.5 (+ @tailwindcss/vite), shadcn/ui (Radix), msw **2.15.0** (binding peer is `^2.10.2` — do NOT use msw 3), @mswjs/socket.io-binding 0.2.0, zod 4.6.7, react-hook-form 7.91.0 + @hookform/resolvers 7.0.5, big.js 7.0.1, sonner 2.0.8, @fontsource/roboto-mono 5.3.0, sharp 0.35.5 (dev), vitest 5.1.0, @playwright/test 1.65.0, @axe-core/playwright, lighthouse 13.6.0, eslint 9 + typescript-eslint 8.72.2. Package manager: npm.

**Spec:** `docs/superpowers/specs/2026-11-11-kurio-nft-marketplace-design.md` (section refs `Spec §N`). Challenge README refs are `README §N` (`gh repo view junglegaming/frontend-challenge`). Figma PNG exports: `Frontend Challenge/Desktop/*.png`, `Frontend Challenge/Mobile/*.png`. Figma API file key `Ff0SksUi7UFtPWUO8kyNtw`, token in `.env.local` as a raw token line (the file may contain only the token, with or without `FIGMA_TOKEN=` prefix) — never print it, never commit it.

## Global Constraints

- All UI copy in Brazilian Portuguese, matching Figma text verbatim where drawn; code identifiers, comments in code, and commit messages in English.
- Naming: camelCase vars/functions, PascalCase components/types (component files `PascalCase.tsx`), kebab-case module files, UPPER_SNAKE_CASE constants, kebab-case CSS classes, REST JSON keys camelCase.
- ETH values are decimal **strings** end to end; all arithmetic through `src/shared/lib/money.ts` (big.js). Never `Number()` a price for math. Quantities are integers.
- Components, hooks and the Axios client contain no fake data or mock-only branches (README §6). Only `src/mocks/**` and `main.tsx`'s conditional import know about mocks.
- Realtime events reach the app only through `socket.io-client` (README §6). Mock panel/tests trigger events by calling `/__mock/*`, which mutates the mock DB and emits through the mock socket server.
- Every REST call goes through `src/shared/api/http.ts` (Axios instance) and every server-state read/write through TanStack Query.
- Fonts and images served locally from the build (no third-party CDN at runtime).
- Out-of-scope actions must never look successful (README §3): route to `/em-breve` or show "Indisponível nesta demonstração".
- Viewports evaluated: 390, 768, 1440 (README §8). Playwright projects: `chromium-desktop` 1440×900, `chromium-mobile` 390×844 (isMobile, hasTouch), `chromium-tablet` 768×1024 (visual only).
- Fictional users: `ana@kurio.dev` / `Kurio@2026`, `bruno@kurio.dev` / `Kurio@2026`. Coupons: `KURIO10` (10%), `GENESIS5` (5%), `LANCAMENTO24` (expired). Network fees: ethereum `0.016`, polygon `0.002`, solana `0.001`.
- Commit after every task (user authorized commits + push to `origin main` of `Schaussard-dev/kurio-nft-marketplace`). End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Unit tests: Vitest (`npm run test:unit`). E2E: Playwright against `vite preview` of the demo build (`npm run test:e2e`).

## Review Focus

- Cart line quantity exceeding availability after guest→user merge or after an `nft.updated` that lowers stock → line clamps/marks and checkout is blocked with an explanation (test in Task 13 + Task 14).
- Decimal edge cases (`0.1 + 0.2`, `26.83 + 0.016`, discount on `8.92`, trailing zeros like `00.00` display) → exact string results (Task 2).
- Typing fast in search / clicking filters rapidly under `jitter` scenario → the grid always shows results for the latest URL params, never a stale response (Task 8).
- Session expiring while on `/pagamento` with a filled form → after re-login the user lands back on `/pagamento` with non-sensitive fields restored (Task 17).
- Logout of user A then login as user B in the same tab → no A favorites/cart/orders in cache, no A socket events applied (Task 11 + Task 18).

---

## File Structure

```
index.html  vite.config.ts  tsconfig*.json  eslint.config.js  playwright.config.ts  vitest.config.ts  vercel.json  components.json
.env.example  .github/workflows/e2e.yml
public/  mockServiceWorker.js  nfts/<art>-<w>.{avif,webp}  icons/*.svg  favicon.svg
scripts/  figma-tokens.mjs  optimize-images.mjs  lighthouse.mjs
lighthouse/  config.mjs  reports/  summary.md
src/
  main.tsx                         # conditional mock bootstrap, render
  styles/globals.css               # Tailwind @theme tokens, typography utilities, shimmer, focus
  app/  router.tsx  query-client.ts  providers.tsx
  routes/                          # TanStack file routes (see Task 7)
  shared/
    contracts/  common.ts errors.ts auth.ts nft.ts favorites.ts cart.ts quote.ts orders.ts profile.ts wallets.ts events.ts index.ts
    api/  http.ts  api-error.ts  session-storage.ts
    lib/  money.ts  format.ts  safe-redirect.ts  idempotency.ts
    ui/   (shadcn components, restyled)  Skeleton.tsx  LiveRegion.tsx
    layout/  Header.tsx  Footer.tsx  MobileTabBar.tsx  Breadcrumbs.tsx  PageShell.tsx
  features/
    auth/ catalog/ nft/ favorites/ cart/ checkout/ orders/ profile/ wallets/ realtime/ mock-panel/
      api.ts  queries.ts  components/*.tsx  (+ *.test.ts for pure logic)
  mocks/
    browser.ts  config.ts
    db/  schema.ts  store.ts  seed.ts  password.ts  prng.ts
    fixtures/  nfts.ts  users.ts  reviews.ts
    network.ts  scenarios.ts
    handlers/  index.ts auth.ts nfts.ts favorites.ts cart.ts quote.ts orders.ts profile.ts wallets.ts mock-control.ts
    realtime/  server.ts  commit.ts  order-scheduler.ts
tests/
  e2e/  fixtures.ts  01-catalog.spec.ts … 12-loading-failures.spec.ts  realtime-spike.spec.ts
  visual/  pages.visual.spec.ts
```

---

### Task 1: Scaffold, tooling and deploy config

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`, `vitest.config.ts`, `playwright.config.ts`, `vercel.json`, `.env.example`, `components.json`, `src/main.tsx`, `src/app/router.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/shared/lib/smoke.test.ts`, `tests/e2e/smoke.spec.ts`
- Modify: `.gitignore` (add `lighthouse/.tmp/`, `/src/routeTree.gen.ts` stays committed)
- Move: `Frontend Challenge/` → `design/figma-exports/` (keep in repo as reference; README §12 asks for assets)

**Interfaces:**
- Produces npm scripts: `dev` (`vite`, mocks on), `build` (`tsc -b && vite build`), `build:demo` (`VITE_ENABLE_MOCKS=true vite build` via `cross-env`), `preview` (`vite preview --port 4173 --strictPort`), `typecheck` (`tsc -b --noEmit`), `lint` (`eslint .`), `test:unit` (`vitest run`), `test:e2e` (`playwright test`), `test:e2e:update` (`playwright test --update-snapshots`), `lighthouse` (`node scripts/lighthouse.mjs`).
- `vite.config.ts`: plugins order `tanstackRouter({ target: 'react', autoCodeSplitting: true })`, `react()`, `tailwindcss()`; alias `@` → `src`.
- `playwright.config.ts`: `webServer: { command: 'npm run build:demo && npm run preview', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI }`, `use.baseURL`, `trace: 'retain-on-failure'`, `reporter: [['html', { open: 'never' }], ['list']]`, projects per Global Constraints; `chromium-tablet` has `testMatch: /visual/`.
- `vercel.json`: `{ "rewrites": [{ "source": "/((?!assets/|nfts/|icons/|fonts/|mockServiceWorker\\.js).*)", "destination": "/index.html" }], "buildCommand": "npm run build:demo", "outputDirectory": "dist" }`.
- `.env.example`: `VITE_ENABLE_MOCKS=true`, `VITE_API_BASE_URL=/api`, `VITE_SOCKET_URL=http://localhost:4173`, `FIGMA_TOKEN=` (scripts only).

- [ ] **Step 1:** `npm create vite@latest . -- --template react-ts` into a temp dir and copy files in (dir is non-empty); install pinned versions from Tech Stack; `npx shadcn@latest init` (style new-york, base color neutral, CSS vars on, alias `@/shared/ui` for ui).
- [ ] **Step 2: Write failing tests** — `src/shared/lib/smoke.test.ts`: `expect(1 + 1).toBe(2)` placeholder replaced by `import { APP_NAME } from '@/app/router'; expect(APP_NAME).toBe('Kurio')`. `tests/e2e/smoke.spec.ts`: `await page.goto('/'); await expect(page).toHaveTitle(/Kurio/)`; `await page.goto('/rota/inexistente'); await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()`.
- [ ] **Step 3:** Run `npm run test:unit` → FAIL (`APP_NAME` missing).
- [ ] **Step 4:** Implement `export const APP_NAME = 'Kurio'` and a minimal router (`createRouter({ routeTree, defaultNotFoundComponent })`), `<title>Kurio — Marketplace de NFTs</title>`, `lang="pt-BR"`, meta description.
- [ ] **Step 5:** Run `npm run typecheck && npm run lint && npm run test:unit && npx playwright install chromium && npm run test:e2e -- --project=chromium-desktop tests/e2e/smoke.spec.ts` → all PASS.
- [ ] **Step 6:** Commit `chore: scaffold vite app with router, tooling and deploy config` and push.

### Task 2: Money and formatting utilities

**Files:** Create `src/shared/lib/money.ts`, `src/shared/lib/format.ts`, `src/shared/lib/money.test.ts`, `src/shared/lib/format.test.ts`

**Interfaces:**
- Produces: `type EthString = string` (branded via zod later); `add(a, b)`, `sub(a, b)`, `mul(a: EthString, qty: number)`, `percentOf(a, pct: number)`, `compare(a, b): -1|0|1`, `sum(values: EthString[])`, `isEthString(s): boolean` (regex `^\d+(\.\d{1,18})?$`) — all return canonical strings (no exponent, trailing zeros stripped).
- `formatEth(value: EthString, opts?: { minDecimals?: number }): string` → `"2.38 ETH"`; default minDecimals 2 (`"1.5"` → `"1.50 ETH"`, `"0.016"` → `"0.016 ETH"`, `"26.846"` → `"26.846 ETH"`). `formatDiscount(value)` → `"(-) 00.00"` when zero (Figma copy), `"(-) 0.89 ETH"` otherwise. `formatDate(iso)` → `"29 Jul, 2026"`. `shortHash("0xA91F…E82C")` → first 6 + `…` + last 4.

- [ ] **Step 1: Write failing tests**: `add('0.1','0.2') === '0.3'`; `sum(['2.38','8.34','16.11']) === '26.83'`; `add('26.83','0.016') === '26.846'`; `mul('1.19', 2) === '2.38'`; `percentOf('8.92', 10) === '0.892'`; `compare('1.10','1.1') === 0`; `isEthString('1e3') === false`; `formatEth('1.5') === '1.50 ETH'`; `formatEth('26.846') === '26.846 ETH'`; `formatDiscount('0') === '(-) 00.00'`; `formatDate('2026-07-29T12:00:00Z') === '29 Jul, 2026'`; `shortHash('0xa91f0000000000000000000000000000000ee82c')` → `'0xA91F…E82C'` (uppercase hex body).
- [ ] **Step 2:** `npm run test:unit -- money format` → FAIL.
- [ ] **Step 3:** Implement with `Big` (`Big.DP = 18`, `Big.RM = Big.roundHalfUp`); `toFixed()` then strip trailing zeros.
- [ ] **Step 4:** Tests PASS. **Step 5:** Commit `feat: add decimal-safe ETH money utilities`.

### Task 3: Design tokens, fonts, assets and base UI primitives

**Files:** Create `scripts/figma-tokens.mjs`, `scripts/optimize-images.mjs`, `src/styles/globals.css`, `src/styles/tokens.generated.css`, `src/shared/ui/Skeleton.tsx`, `src/shared/ui/button.tsx` (+ restyle shadcn `input`, `label`, `select`, `dialog`, `sheet`, `tabs`, `radio-group`, `checkbox`, `slider`, `sonner`, `tooltip`), `src/shared/ui/contrast.test.ts`, `public/nfts/*`, `public/icons/*.svg`, `src/features/catalog/art.ts`

**Interfaces:**
- `scripts/figma-tokens.mjs`: reads token from `.env.local`, fetches `GET /v1/files/Ff0SksUi7UFtPWUO8kyNtw` (+ `/images` for fills, `/images?ids=…&format=svg` for icon nodes), writes `src/styles/tokens.generated.css` (`@theme { --color-ink: #140d0a; … --text-display: 43px; --text-display--line-height: 70px; … }`) and downloads raw art to `design/raw/` (gitignored); the generated CSS **is committed** so builds don't need the token.
- Color tokens (Spec §3): `ink #140D0A`, `surface #241612`, `surface-2 #2F1D15`, `band #38220F`, `primary #D28A4C`, `text-accent #E89B55`, `text-secondary #CFB28C`, `muted #B39463`, `foreground #F5F1EB`, `border #3F2319`, `border-strong #55321F`, `danger #F0805F`. Typography utilities named after Figma text styles (`text-display`, `text-heading-*`, `text-body-lg`, `text-body`, `text-caption`, `text-tiny`) with exact size/weight/line-height/letter-spacing from the JSON.
- `art.ts`: `type ArtKey = 'emerald' | 'sage' | 'ivory' | 'golden'`; `artSources(key): { avif: string; webp: string; srcSet: { avif: string; webp: string } }` for widths 320/640/1024. Identify which Figma image ref is which ape by viewing the downloaded files.
- `Skeleton`: `<Skeleton className>` renders `aria-hidden` block with `.shimmer` (linear-gradient sweep, 1.4s); under `@media (prefers-reduced-motion: reduce)` animation none.
- Focus style: `:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px }`.

- [ ] **Step 1: Write failing test** `contrast.test.ts`: computes WCAG ratio for text pairs actually used on small text — `foreground/ink`, `foreground/surface`, `text-secondary/ink`, `text-secondary/surface`, `muted/surface`, `text-accent/ink`, `ink/primary` (button label) — each `>= 4.5`. Reads values from `tokens.generated.css`.
- [ ] **Step 2:** Run → FAIL (file missing).
- [ ] **Step 3:** Run scripts, wire `globals.css` (`@import "tailwindcss"; @import "./tokens.generated.css"; @import "@fontsource/roboto-mono/400.css"` …500, 700). If a pair fails contrast, adjust that token in a `globals.css` override layer and record the original → adjusted value in a `// a11y-deviation` comment (collected into ARCHITECTURE.md in Task 21).
- [ ] **Step 4:** Test PASS; `npm run build` passes; open `/` shows Roboto Mono on ink background.
- [ ] **Step 5:** Commit `feat: add Figma design tokens, fonts, optimized art and base UI`.

### Task 4: Contracts (Zod)

**Files:** Create `src/shared/contracts/{common,errors,auth,nft,favorites,cart,quote,orders,profile,wallets,events,index}.ts`, `src/shared/contracts/contracts.test.ts`

**Interfaces (exact names; all exported schemas `xSchema` + `type X = z.infer`):**
- `common`: `ethStringSchema`, `networkSchema = z.enum(['ethereum','polygon','solana'])`, `paginatedSchema(item)` → `{ items, page, pageSize, total, totalPages }`.
- `errors`: `apiErrorCodeSchema` enum `VALIDATION_ERROR | UNAUTHENTICATED | SESSION_EXPIRED | FORBIDDEN | NOT_FOUND | EMAIL_TAKEN | USERNAME_TAKEN | OUT_OF_STOCK | QUOTE_STALE | IDEMPOTENCY_CONFLICT | COUPON_INVALID | COUPON_EXPIRED | INVALID_PASSWORD | WALLET_REJECTED | TRANSIENT`; `apiErrorBodySchema = { error: { code, message, fieldErrors?: Record<string,string[]>, details?: unknown } }`.
- `auth`: `registerInputSchema {username (3–20, [a-z0-9_]), email, password (≥8, 1 upper, 1 digit, 1 symbol), confirmPassword}` with refine match; `loginInputSchema {email, password}`; `sessionSchema {token, expiresAt, user: { id, username, email, displayName, avatarUrl: string|null }}`.
- `nft`: `editionSchema {id, label: '1/1'|'1/10'|'1/50'|'ABERTA', available: int≥0, maxPerOrder: int≥1}`; `nftSummarySchema {id, tokenNumber, name, art: ArtKey, price, previousPrice: eth|null, rare: boolean, category, network, collection, createdAt, trendingScore, version}`; `nftDetailSchema` = summary + `{description, longDescription, attributes: string[], contractAddress, rating: number, reviewCount, editions, gallery: ArtKey[]}`; `catalogQuerySchema {q?, categories?: string[], networks?: Network[], minPrice?, maxPrice?, tab: 'all'|'new'|'trending' = 'all', sort: 'recent'|'price-asc'|'price-desc'|'name' = 'recent', page: int≥1 = 1}`; `catalogResponseSchema` = paginated(nftSummary) + `facets {categories: {id,label,count}[], networks: {id,count}[], priceRange: {min,max}}`; `reviewSchema`.
- `cart`: `cartLineSchema {lineId, nftId, editionId, quantity, nft: nftSummary, edition: editionSchema}`; `cartSchema {id, owner: {type:'guest'|'user', id}, lines, version}`; `addCartItemInputSchema`, `updateCartItemInputSchema`, `mergeCartResultSchema {cart, adjustments: {lineId, requested, applied, reason:'stock'}[]}`.
- `quote`: `quoteInputSchema {coupon?: string, network}`; `quoteSchema {quoteId, lines: {lineId, nftId, editionId, unitPrice, quantity, lineTotal, available}[], subtotal, discount, networkFee, total, coupon: {code, percent}|null, network, expiresAt, fingerprint}`.
- `orders`: `payerSchema {displayName, username, profileName, email, ensName?, referralCode, walletAddress, secondaryAddress?}`; `createOrderInputSchema {quoteId, walletId: string|null, network, payer, note?}`; `orderStatusSchema = z.enum(['pending','confirmed','declined'])`; `orderSchema {id, status, version, createdAt, resolvedAt: string|null, declineReason: string|null, txHash, explorerUrl, snapshot: {lines:[{nftId, name, art, tokenNumber, editionLabel, unitPrice, quantity, lineTotal}], subtotal, discount, networkFee, total, walletLabel, network}}`.
- `profile`: `profileSchema {id, username, email, displayName, walletNickname, ensName, avatarUrl}`; `updateProfileInputSchema`; `changePasswordInputSchema {currentPassword, newPassword, confirmPassword}`; `avatarInputSchema {dataUrl: /^data:image\/(png|jpeg|webp);base64,/ , ≤ 400_000 chars}`.
- `wallets`: `walletSchema {id, slot:'primary'|'secondary', displayName, nickname, network, profileName, address, secondaryAddress?, walletType:'metamask'|'walletconnect'|'coinbase', referralCode, email, ensName, sameAsPrimary: boolean}` with `superRefine` address rule (EVM `^0x[0-9a-fA-F]{40}$` for ethereum/polygon, base58 `^[1-9A-HJ-NP-Za-km-z]{32,44}$` for solana); `walletsResponseSchema {primary: Wallet|null, secondary: Wallet|null}`; `walletInputSchema` (wallet minus id/slot).
- `events`: `eventEnvelopeSchema {eventId, type: 'nft.updated'|'order.updated'|'wallet.disconnected', resource: {type, id}, version: int, occurredAt, userId: string|null, data}`; `nftUpdatedDataSchema {price, previousPrice, editions: {id, available}[]}`; `orderUpdatedDataSchema {status, order: orderSchema}`.

- [ ] **Step 1: Write failing tests**: valid/invalid samples per schema — e.g. solana wallet with `0x…` address fails with path `['address']`; `registerInputSchema` mismatch confirm fails on `confirmPassword`; `catalogQuerySchema.parse({})` gives `{ tab:'all', sort:'recent', page:1 }`; `apiErrorBodySchema` accepts `fieldErrors`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS + typecheck. **Step 5:** Commit `feat: add typed Zod contracts shared by client and mocks`.

### Task 5: Mock database, fixtures, persistence and password hashing

**Files:** Create `src/mocks/db/{schema,store,seed,password,prng}.ts`, `src/mocks/fixtures/{nfts,users,reviews}.ts`, `src/mocks/db/store.test.ts`, `src/mocks/db/password.test.ts`

**Interfaces:**
- `prng.ts`: `createRng(seed: number): () => number` (mulberry32).
- `password.ts`: `hashPassword(plain, salt?) : Promise<{ salt: string; hash: string }>` (PBKDF2-SHA256, 100_000 iterations, Web Crypto — works in browser and Node 22 `globalThis.crypto`), `verifyPassword(plain, record): Promise<boolean>`.
- `schema.ts`: `MockDb { version: 1; users: UserRecord[] (passwordRecord, never plain); sessions: {token,userId,expiresAt}[]; nfts: NftRecord[]; carts: CartRecord[]; favorites: {userId, nftId}[]; wallets: WalletRecord[]; orders: OrderRecord[] (+ idempotencyKey, payloadHash, resolveAt, plannedOutcome); idempotency: {key,userId,payloadHash,orderId}[]; coupons; resourceVersions: Record<string, number>; eventLog: string[] }`.
- `seed.ts`: `createSeed(): Promise<MockDb>` — 60 NFTs: the 9 Figma names/prices first (Emerald Ape #042 1.19, Sage Nomad #009 1.69, Neon Vessel #552 1.99 prev 2.29 rare, Cosmic Bloom #118 1.29, Violet Nomad #314 1.39, Ivory Baron #088 1.79, Golden Beat #207 0.99, Golden Frequency #071 0.59, Golden Signal #160 0.39), the rest generated with `createRng(2026)`; categories from Figma (`arte-digital, fotografia, musica, arte-3d, colecionaveis, generativa, jogos, assinaturas, utilidade` with labels as drawn); networks spread over 3; prices 0.02–12.30; 4 editions each (`1/1, 1/10, 1/50, ABERTA`, `maxPerOrder` 1/10/50/99 capped by available); deterministic `createdAt`; Emerald Ape detail copy verbatim from the Figma detail frame. Users ana (with primary wallet MetaMask `0xA91F…E82C`-style full address + secondary "Reserva" `nova.kurio.eth` on polygon, favorites [nft_042]) and bruno (no wallets, empty favorites).
- `store.ts`: `getDb(): MockDb`, `mutate<T>(fn: (db) => T): T` (applies + persists to `localStorage['kurio-mock-db:v1']`), `resetDb(scenario?: ScenarioName): Promise<void>`, `bumpVersion(resourceKey: string): number`, `initDb(): Promise<void>` (load persisted or seed). Storage adapter injectable for tests (`setStorage(memoryStorage)`).

- [ ] **Step 1: Write failing tests**: `verifyPassword('Kurio@2026', await hashPassword('Kurio@2026'))` true and wrong password false; seeded db has ≥2 users and **no** user record contains the string `Kurio@2026`; `createSeed()` twice → deep-equal NFT lists (determinism); `mutate` persists → new `initDb()` with same storage reads mutated value; `resetDb()` restores seed; `bumpVersion('nft:nft_042')` returns 2 then 3.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat: add persistent deterministic mock database and fixtures`.

### Task 6: Mock network layer, scenarios, control endpoints and bootstrap

**Files:** Create `src/mocks/{browser,config,network,scenarios}.ts`, `src/mocks/handlers/{index,mock-control}.ts`, `src/mocks/network.test.ts`; Modify `src/main.tsx`; generate `public/mockServiceWorker.js` (`npx msw init public --save`)

**Interfaces:**
- `scenarios.ts`: `type ScenarioName = 'default'|'empty'|'slow'|'jitter'|'offline'|'server-error'|'favorite-fail'|'session-expired'|'signup-conflict'|'price-change'|'sold-out'|'order-timeout'|'payment-declined'|'wallet-reject'`; `SCENARIOS: Record<ScenarioName, ScenarioConfig>` where `ScenarioConfig { latency: {min:number,max:number}; routeFaults?: { method, pathPattern, status?: number, error?: 'network'|'timeout', code?: ApiErrorCode }[]; seedPatch?: (db) => void; flags?: { sessionTtlRequests?: number; orderOutcome?: 'confirmed'|'declined'; orderTimeout?: boolean; walletReject?: boolean; priceChangeOnQuote?: string /*nftId*/; soldOutOnOrder?: string } }`. Exact latencies: default 150–400, slow 2500–2500, jitter 50–1500 (seeded), others default.
- `network.ts`: `withNetwork(handler)` wrapper used by every handler: reads active scenario + panel overrides, `await delay(rng-latency)` (skipped when `config.latency === 0` override from tests), applies matching `routeFaults` (`HttpResponse.error()` for network, never-resolving promise for timeout, JSON error body for status). `apiError(status, code, message, fieldErrors?) : HttpResponse`.
- `config.ts`: `getMockConfig()/setMockConfig(partial)` persisted in `sessionStorage['kurio-mock-config']`: `{ scenario, latencyOverride: number|null, offline: boolean }`. Reads `?scenario=` and `?reset=1` from `location` on boot (then strips them via `history.replaceState`).
- `mock-control.ts`: `POST /api/__mock/reset {scenario?}`, `POST /api/__mock/scenario {scenario, latencyOverride?}`, `POST /api/__mock/emit {action: 'nft:update', nftId, price?, editions?} | {action:'session:expire'} | {action:'socket:drop', seconds?} | {action:'socket:restore'} | {action:'wallet:disconnect'} | {action:'event:replay', eventId}` (replay re-sends a past envelope — for duplicate tests) | `{action:'order:resolve', orderId}`. Returns `{ ok: true }`.
- `browser.ts`: `startMocks(): Promise<void>` → `initDb()`, `setupWorker(...handlers).start({ onUnhandledRequest: 'bypass', serviceWorker: { url: '/mockServiceWorker.js' }, quiet: true })`.
- `main.tsx`: `if (import.meta.env.VITE_ENABLE_MOCKS === 'true') await (await import('./mocks/browser')).startMocks()` before `createRoot`.

- [ ] **Step 1: Write failing tests** (`network.test.ts`, msw/node `setupServer` with a dummy route wrapped in `withNetwork`): scenario `offline` → fetch rejects (TypeError); `server-error` → 503 with `code:'TRANSIENT'`; `jitter` with fixed seed → two calls produce the same latency sequence across runs; latencyOverride 0 → resolves < 50 ms.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; `npm run dev` → console shows no MSW warnings; `fetch('/api/__mock/reset',{method:'POST'})` in devtools returns `{ok:true}`.
- [ ] **Step 5:** Commit `feat: add configurable MSW network scenarios and control endpoints`.

### Task 7: Realtime spike + mock Socket.IO server

**Files:** Create `src/mocks/realtime/{server,commit}.ts`, `tests/e2e/realtime-spike.spec.ts`, `src/features/realtime/socket.ts`; Modify `src/mocks/browser.ts`, `docs/superpowers/specs/…design.md` (append "Spike results" under Spec §6)

**Interfaces:**
- `server.ts`: uses `ws.link(SOCKET_URL)` + `toSocketIo(connection)` from `@mswjs/socket.io-binding`. `registerConnection(userId, io)`; rooms `Map<userId, Set<SocketIoConnection>>`; `emitToUser(userId, envelope)`, `emitToAll(envelope)`, `dropAll(seconds?)` (close connections, refuse new until restore/timeout), `restore()`. Auth resolution: handshake `auth.token` if the binding exposes it, otherwise `token` query param on `connection.client.url` — the spike decides; record which.
- `commit.ts`: `commitNftUpdate(nftId, patch): EventEnvelope` (mutates DB via `mutate`, `bumpVersion('nft:'+id)`, logs `eventId`, emits to all), `commitOrderUpdate(orderId, patch)` (emits only to owner), `commitWalletDisconnect(userId)`. **Every** stateful change that has an event goes through these.
- `src/features/realtime/socket.ts`: `createSocket(token: string): Socket` → `io(import.meta.env.VITE_SOCKET_URL, { transports: ['websocket'], auth: { token }, query: { token }, autoConnect: false, reconnectionDelay: 500, reconnectionDelayMax: 3000 })`.

- [ ] **Step 1: Write failing spike test** `realtime-spike.spec.ts`. It runs in a dedicated Playwright project `spike` against `npm run dev` (port 5173), so the test can load the real client module with `page.evaluate(async () => { const { createSocket } = await import('/src/features/realtime/socket.ts'); … })` — no debug route in app code. Assertions: (a) client connects and receives a `nft.updated` emitted via `POST /api/__mock/emit`; (b) server sees the token (assert via a `__mock/emit {action:'whoami'}` echo event containing the userId); (c) after `socket:drop` the client fires `disconnect` then `connect` again after `socket:restore`; (d) with `page.clock.install()` + `runFor(60_000)` the client stays connected (ping/pong) — if not, implement pong/handshake `pingInterval` in `server.ts` until it does.
- [ ] **Step 2:** Run `npx playwright test --project=spike` → FAIL.
- [ ] **Step 3:** Implement server/commit; iterate until (a)–(d) pass. Write findings (auth channel, ping behavior, version compat, websocket-only, per-tab server) into the spec.
- [ ] **Step 4:** PASS. Remove the `spike` project and its `whoami` action only if they leak into app code (mock-only code may stay).
- [ ] **Step 5:** Commit `feat: add mock Socket.IO server with per-user rooms and commit pipeline`.

### Task 8: HTTP client, errors, session store and query client

**Files:** Create `src/shared/api/{http,api-error,session-storage}.ts`, `src/shared/lib/safe-redirect.ts`, `src/app/query-client.ts`, `src/shared/api/api-error.test.ts`, `src/shared/lib/safe-redirect.test.ts`, `src/app/query-client.test.ts`

**Interfaces:**
- `ApiError extends Error { status: number; code: ApiErrorCode | 'NETWORK' | 'TIMEOUT'; fieldErrors?: Record<string,string[]>; details?: unknown; isTransient: boolean }`; `toApiError(e: unknown): ApiError` (axios error w/ body → parse with `apiErrorBodySchema`; no response → `NETWORK`; `ECONNABORTED` → `TIMEOUT`).
- `http`: axios instance `baseURL: import.meta.env.VITE_API_BASE_URL`, `timeout: 10_000`; request interceptor adds `Authorization: Bearer <token>` from `sessionStore` and `X-Cart-Id` from `getGuestCartId()`; response interceptor converts to `ApiError` and on `401` with code `SESSION_EXPIRED|UNAUTHENTICATED` (when a token was sent) calls `onSessionExpired()` registered by the auth feature. `request<T>(config, schema: ZodType<T>): Promise<T>` — validates every response with the contract.
- `session-storage.ts`: `sessionStore = { get(): Session|null; set(s); clear(); subscribe(fn) }` backed by `localStorage['kurio-session']` (token + user + expiresAt, never password); `getGuestCartId(): string` (`localStorage['kurio-guest-cart-id']`, `crypto.randomUUID()` on first call).
- `safe-redirect.ts`: `safeRedirect(raw: unknown, fallback = '/'): string` — only same-origin paths starting with `/` and not `//`.
- `query-client.ts`: `createQueryClient()` with defaults: queries `retry: (count, err) => toApiError(err).isTransient && count < 2`, `retryDelay: attempt => Math.min(500 * 2 ** attempt, 4000)`, `staleTime: 30_000`, `gcTime: 300_000`, `refetchOnWindowFocus: false`; mutations `retry: 0`. `queryKeys` factory: `queryKeys.nfts(params)`, `.nft(id)`, `.session()`, `.user(userId).cart()|favorites()|profile()|wallets()|order(id)|pendingOrders()`, `.guestCart(guestId)`, `.quote(scopeId, input)`.

- [ ] **Step 1: Write failing tests**: `toApiError` on axios error with 409 body → `{status:409, code:'QUOTE_STALE'}`, no response → `NETWORK` + `isTransient true`, 422 → `isTransient false`; `safeRedirect('//evil.com')==='/'`, `safeRedirect('https://evil.com')==='/'`, `safeRedirect('/pagamento?x=1')==='/pagamento?x=1'`; retry fn returns false for 404 and true for 503 at count 0.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat: add typed axios client, error normalization and query defaults`.

### Task 9: App shell — layout, routes skeleton, 404, em-breve, mock panel, live region

**Files:** Create `src/app/providers.tsx`, `src/shared/layout/{Header,Footer,MobileTabBar,Breadcrumbs,PageShell}.tsx`, `src/shared/ui/LiveRegion.tsx`, `src/features/mock-panel/MockPanel.tsx`, route files: `src/routes/{__root,index,em-breve,carrinho,pagamento,entrar,cadastro}.tsx`, `src/routes/nft.$nftId.tsx`, `src/routes/pedidos.$orderId.tsx`, `src/routes/perfil.tsx` (layout with sidebar) + `perfil.index.tsx`, `perfil.carteiras.tsx`, `perfil.favoritos.tsx`, `src/routes/_authenticated.tsx` (pathless guard layout wrapping pagamento/pedidos/perfil*), `tests/e2e/shell.spec.ts`

**Interfaces:**
- Header (desktop ≥1024): logo `KURIO`, nav `Início` `/`, `Mercado` `/#catalogo` (active on `/nft/*`, `/carrinho`, `/pagamento`), `Criadores` `/em-breve?secao=criadores`, `Aprenda` `/em-breve?secao=aprenda`; search icon (focuses catalog search / navigates `/?q=`), cart icon with count badge (`aria-label="Carrinho, N itens"`), `Entrar` button or user menu (avatar → Perfil, Carteiras, Lista de interesse, Sair). Below 1024: compact header + `MobileTabBar` (Início, Favoritos, central scan → `/em-breve?secao=scanner`, Carrinho, Perfil) as in Mobile/Início frame.
- Footer verbatim from Figma (feature trio W/C/D, newsletter form whose submit shows inline `role="status"` "Newsletter indisponível nesta demonstração.", contact band, link columns → `/em-breve` or real routes for "Meu perfil"/"Lista de interesse", social icons as external links `target="_blank" rel="noopener noreferrer"`, wallets badge).
- `LiveRegion`: `announce(message, politeness?)` via context; renders visually-hidden `aria-live` regions; `<Toaster>` (sonner) styled with tokens.
- `MockPanel`: rendered only when `import.meta.env.VITE_ENABLE_MOCKS === 'true'` (lazy chunk), floating button "Simulação" bottom-left → Sheet with scenario select, latency, buttons (Reset, Expirar sessão, Derrubar conexão, Restaurar conexão, Alterar preço de NFT do carrinho, Esgotar edição, Desconectar carteira, Reenviar último evento); every action calls `/api/__mock/*` via `fetch` (mock-control is the only allowed non-axios call; it lives in `src/features/mock-panel` and is excluded from the "app code" rule by being demo tooling — document in ARCHITECTURE).
- 404 `defaultNotFoundComponent`: heading "Página não encontrada", link "Voltar ao início".
- Route guard (`_authenticated.tsx` `beforeLoad`): `const session = await context.queryClient.ensureQueryData(sessionQueryOptions())` (sessionQueryOptions provided by Task 11; until then a stub reading `sessionStore`) → if null `throw redirect({ to: '/entrar', search: { redirect: location.href } })`.

- [ ] **Step 1: Write failing E2E** `shell.spec.ts` (desktop+mobile): header nav items visible on desktop and tab bar on mobile; `/em-breve?secao=criadores` shows heading "Em breve" and text containing "Criadores"; newsletter submit shows "indisponível"; unknown route shows 404; `/perfil` unauthenticated redirects to `/entrar?redirect=%2Fperfil`; `page.keyboard.press('Tab')` first focus is a "Pular para o conteúdo" skip link; no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`) at 390/1440.
- [ ] **Step 2:** FAIL. **Step 3:** Implement, comparing against `Desktop/Início.png` header/footer and `Mobile/Início.png` tab bar. **Step 4:** PASS. **Step 5:** Commit `feat: add app shell, layout, guarded routes and mock panel`.

### Task 10: Catalog (Início) — API, URL state, filters, skeleton, failures

**Files:** Create `src/mocks/handlers/nfts.ts`, `src/features/catalog/{api,queries,search-params}.ts`, `src/features/catalog/search-params.test.ts`, `src/features/catalog/components/{Hero,CatalogSection,FilterSidebar,FilterSheet,CatalogTabs,SortSelect,NftCard,NftGrid,NftCardSkeleton,Pagination,FeaturedNft,PromoBanners,JournalSection}.tsx`, `tests/e2e/01-catalog.spec.ts`; Modify `src/routes/index.tsx`

**Interfaces:**
- Handler `GET /api/nfts`: parses `catalogQuerySchema` from query string (arrays as repeated params), filters (q matches name/collection case-insensitive, accent-insensitive), categories OR within group, AND across groups, price range inclusive using money `compare`, tab (`new` = createdAt in latest 30 days of seed epoch, `trending` = trendingScore ≥ 70), sort, `pageSize = 9`, `facets` computed over the result set ignoring the facet's own group. `GET /api/nfts/:id` → 404 `NOT_FOUND` if missing.
- `search-params.ts`: `catalogSearchSchema` (= `catalogQuerySchema` with `.catch` defaults) used as route `validateSearch`; `withFilterChange(prev, patch)` → returns patch merged with `page: 1`; `stripDefaults(search)` for clean URLs.
- `queries.ts`: `catalogQueryOptions(params)` → `queryKey: queryKeys.nfts(params)`, `queryFn: ({ signal }) => fetchCatalog(params, signal)`, `placeholderData: keepPreviousData`.
- Grid states: loading → 9 `NftCardSkeleton` with identical dimensions (`aspect-square` image + 2 text lines); empty → "Nenhum NFT encontrado" + "Limpar filtros"; error → message + "Tentar novamente" (`refetch`); background fetch → `aria-busy="true"` on grid + subtle top progress bar. Results count announced via LiveRegion ("12 NFTs encontrados").
- Price slider (shadcn Slider, two thumbs, step 0.01, bounds from `facets.priceRange`), applies only on "Aplicar". Search input debounced 300 ms with `navigate({ search, replace: true })`; filters/sort/tab/page use push.
- Hero: 3 slides (Figma copy "Bem-vindo à Kurio" / "SEJA DONO DO FUTURO DA ARTE DIGITAL" desktop, "SEJA DONO DA CULTURA DIGITAL" mobile), dot buttons with `aria-label="Slide N de 3"`, `aria-current`, no autoplay. LCP image `fetchpriority="high"` + `<link rel="preload">` in index.html for emerald 640 avif.
- Card hover/focus actions (cart, favorite, view) per Login frame; selo "RARO"; previous price struck with `<s>` + sr-only "preço anterior".

- [ ] **Step 1: Write failing unit tests** `search-params.test.ts`: `withFilterChange({page:3, sort:'name'}, {networks:['polygon']})` → page 1; `stripDefaults({tab:'all',sort:'recent',page:1,q:''})` → `{}`; invalid `page: -2` → 1.
- [ ] **Step 2: Write failing E2E** `01-catalog.spec.ts` (desktop + mobile; mobile opens filters via "Filtros" sheet): search "golden" → only names containing Golden, URL `?q=golden`; check `Música` + network `Polygon` → URL has both, results satisfy both (assert each card's data attributes `data-category`/`data-network`); go to page 2 then change sort → URL page absent (1); `page.goBack()` restores previous filters and grid; `page.reload()` keeps state; scenario `empty` → empty state; scenario `jitter`: type "a", "ap", "ape" quickly → final grid matches `?q=ape` results (compare against `GET /api/nfts?q=ape` fetched in page) ; scenario `server-error` → error + retry after switching scenario to default via mock fixture → grid renders.
- [ ] **Step 3:** FAIL. **Step 4:** Implement (compare with `Desktop/Início.png`, `Mobile/Início.png`). **Step 5:** PASS (unit + E2E both projects). **Step 6:** Run an early Lighthouse smoke (`npx lighthouse http://localhost:4173/ --preset=desktop --quiet --output=json`) and note scores in the commit body. **Step 7:** Commit `feat: add catalog with URL-driven search, filters, sorting and pagination`.

### Task 11: Auth and session (register, login, logout, expiry, user switch)

**Files:** Create `src/mocks/handlers/auth.ts`, `src/features/auth/{api,queries,session-events}.ts`, `src/features/auth/components/{AuthDialog,LoginForm,RegisterForm,PasswordInput,SocialButtons}.tsx`, `src/features/auth/session-events.test.ts`, `tests/e2e/fixtures.ts`, `tests/e2e/03-auth.spec.ts`; Modify `src/routes/{entrar,cadastro,_authenticated}.tsx`, `src/shared/layout/Header.tsx`

**Interfaces:**
- Handlers: `POST /api/auth/register` (409 `EMAIL_TAKEN`/`USERNAME_TAKEN` with `fieldErrors`; 422 validation; creates user with hashed password; returns `Session` 201); `POST /api/auth/login` (401 `UNAUTHENTICATED` "E-mail ou senha inválidos" on failure); `GET /api/auth/session` (200 session | 401); `POST /api/auth/logout` (204, deletes session). Sessions TTL 30 min; every authenticated handler uses `requireUser(request)` → user or `apiError(401,'SESSION_EXPIRED')`; scenario flag `sessionTtlRequests` and `session:expire` action invalidate the token.
- `queries.ts`: `sessionQueryOptions()` (`queryKey: queryKeys.session()`, `staleTime: 300_000`, returns `Session|null`, 401 → null); `useLogin()`, `useRegister()`, `useLogout()`.
- `session-events.ts`: `endSession(queryClient, reason: 'logout'|'expired'|'switch')`: `sessionStore.clear()`, `queryClient.removeQueries({ queryKey: ['user'] })`, `queryClient.setQueryData(queryKeys.session(), null)`, emits `sessionEnded` to subscribers (realtime provider disconnects in Task 14). On `expired`: save `{ path: location.pathname+search }` to `sessionStorage['kurio-resume']` and `router.navigate({ to: '/entrar', search: { redirect, reason: 'expired' } })`. `startSession(queryClient, session)`: set store, set query data, `invalidateQueries` public + run `cart merge` hook registered by cart feature (Task 13).
- `/entrar` & `/cadastro` routes: `validateSearch { redirect?: string, reason?: 'expired' }`; `beforeLoad` redirects authenticated users to `safeRedirect(redirect)`. Desktop (≥768): `index` page content behind + `AuthDialog` (tabs "Entrar | Criar conta" as links); mobile: full page per Mobile/Login & Cadastro frames ("Novo na Kurio? Crie uma conta"). `reason=expired` shows alert "Sua sessão expirou. Entre novamente para continuar." (role="alert").
- Forms: react-hook-form + zod resolver; errors under fields with `aria-describedby`, `aria-invalid`; API `fieldErrors` mapped with `setError`; submit disabled while pending with spinner text "Entrando…". Social buttons & "Esqueceu a senha?" open a tooltip/dialog "Indisponível nesta demonstração".
- `tests/e2e/fixtures.ts`: `test = base.extend<{ mock: MockControl; login: (user:'ana'|'bruno') => Promise<void> }>` where `MockControl { reset(s?), scenario(s, opts?), emit(action) }` implemented with `page.evaluate(fetch('/api/__mock/...'))`; `gotoFresh(page, path, scenario='default')` → `page.goto(path + '?scenario=…&reset=1')`.

- [ ] **Step 1: Write failing unit test** `session-events.test.ts`: after `endSession(qc,'logout')`, `qc.getQueryCache().findAll({queryKey:['user']})` is empty and public `['nfts', …]` entries remain.
- [ ] **Step 2: Write failing E2E** `03-auth.spec.ts`: register new user (validation errors on empty submit, focus moves to first invalid field; then success → header shows username); register with `ana@kurio.dev` → field error "E-mail já cadastrado"; login wrong password → error; login ana from `/perfil` redirect → lands on `/perfil`; reload keeps session; `mock.emit({action:'session:expire'})` then navigate to `/perfil/carteiras` → `/entrar?…reason=expired` with alert, login → back to `/perfil/carteiras`; logout → header shows "Entrar", `/perfil` redirects; login ana, add favorite, logout, login bruno → favorites page shows empty state (no ana data).
- [ ] **Step 3:** FAIL. **Step 4:** Implement. **Step 5:** PASS both projects. **Step 6:** Commit `feat: add registration, login, session recovery, expiry and logout`.

### Task 12: NFT detail + favorites (optimistic with rollback)

**Files:** Create `src/features/nft/{api,queries}.ts`, `src/features/nft/components/{Gallery,ZoomDialog,EditionPicker,QuantityStepper,NftInfo,DetailTabs,Reviews,MoreFromCollection,NftDetailSkeleton,NftNotFound}.tsx`, `src/features/nft/quantity.ts` + `quantity.test.ts`, `src/mocks/handlers/favorites.ts`, `src/features/favorites/{api,queries}.ts`, `src/features/favorites/components/{FavoriteButton,FavoritesPage}.tsx`, `tests/e2e/02-detail.spec.ts`, `tests/e2e/04-favorites.spec.ts`; Modify `src/routes/nft.$nftId.tsx`, `src/routes/perfil.favoritos.tsx`

**Interfaces:**
- Route `nft.$nftId.tsx`: `loader: ({ context, params }) => context.queryClient.ensureQueryData(nftQueryOptions(params.nftId))`, `pendingComponent: NftDetailSkeleton`, `notFoundComponent: NftNotFound` (loader throws `notFound()` on `ApiError.code === 'NOT_FOUND'`), `validateSearch { edition?: string }` (selected edition in URL).
- `quantity.ts`: `clampQuantity(requested: number, edition: Edition, alreadyInCart = 0): { value: number; limited: boolean; max: number }` (`max = min(available - alreadyInCart, maxPerOrder)`, min 1, 0 when sold out).
- Detail behaviors: default edition = first with `available > 0`; sold-out edition chip `aria-disabled`, label suffix "Esgotada"; when none available, COMPRAR disabled + text "Edição indisponível"; limit reached → helper text `Máximo de N por pedido` via `aria-live`. COMPRAR and the card cart action are rendered here with an `onAddToCart` prop left unwired; Task 13 wires them to `useAddToCart()` and navigation to `/carrinho` (and owns their E2E). Mobile layout per Mobile/Detalhes frame with fixed bottom bar.
- Favorites handlers: `GET /api/favorites` → `{ nftIds: string[], items: NftSummary[] }`; `PUT/DELETE /api/favorites/:nftId` → 204; scenario `favorite-fail` → 500 `TRANSIENT`.
- `useToggleFavorite()`: `onMutate` cancels `favorites` query, snapshots, writes optimistic set; `onError` restores snapshot + toast "Não foi possível atualizar seus favoritos. Tente novamente."; `onSettled` invalidates. `FavoriteButton`: `aria-pressed`, label "Favoritar"/"Remover dos favoritos"; unauthenticated click → navigate `/entrar?redirect=<current>`.

- [ ] **Step 1: Write failing unit tests** `quantity.test.ts`: `{available:3,maxPerOrder:10}` request 5 → `{value:3, limited:true, max:3}`; with `alreadyInCart:2` → max 1; available 0 → value 0.
- [ ] **Step 2: Write failing E2E** `02-detail.spec.ts`: direct `goto('/nft/nft_042')` (fresh context) renders "Emerald Ape #042", "1.19 ETH", description text from Figma; `/nft/nao-existe` → "NFT não encontrado" + link to catalog; selecting a sold-out edition (seed: `nft_042` edition `1/1` available 0) is not possible and shows "Esgotada"; + button stops at limit and shows `Máximo de`; gallery thumbnail click swaps main image (`alt` changes) and zoom dialog traps focus & Esc closes returning focus to trigger. `04-favorites.spec.ts`: guest click favorite → login redirect then back to NFT; ana toggles favorite on → `aria-pressed=true` immediately and persists after reload and appears in `/perfil/favoritos`; scenario `favorite-fail` → toggle shows pressed then reverts to unpressed + error toast; switch scenario to default, toggle again → succeeds.
- [ ] **Step 3:** FAIL. **Step 4:** Implement (compare `Desktop/Detalhes do NFT.png`, `Mobile/Detalhes do NFT.png`). **Step 5:** PASS. **Step 6:** Commit `feat: add NFT detail page and optimistic favorites`.

### Task 13: Cart, guest merge, coupon and quote

**Files:** Create `src/mocks/handlers/{cart,quote}.ts`, `src/mocks/pricing.ts` + `pricing.test.ts`, `src/features/cart/{api,queries,cart-scope}.ts`, `src/features/cart/components/{CartTable,CartLineRow,CartLineCard,CouponForm,OrderSummary,OrderSummarySkeleton,AlsoViewed,EmptyCart,ChangeNotice}.tsx`, `tests/e2e/05-cart.spec.ts`; Modify `src/routes/carrinho.tsx`, `src/features/auth/session-events.ts` (register merge)

**Interfaces:**
- `pricing.ts` (mock-side, pure): `computeQuote(db, cart, { coupon, network, now }): Quote | ApiErrorLike` — subtotal = Σ unitPrice×qty, discount = percentOf(subtotal, coupon.percent), fee by network, total = subtotal − discount + fee; `fingerprint` = stable hash of `[lineId, price, qty, available]`, coupon, network, fee. Coupon validation: unknown → `COUPON_INVALID` (422, `fieldErrors.coupon`), expired → `COUPON_EXPIRED`.
- Handlers: cart scope = authenticated user cart if `Authorization` valid, else guest cart from `X-Cart-Id` (create on first touch). `POST /api/cart/items` merges same nft+edition line; quantity > `clampQuantity` max → 409 `OUT_OF_STOCK` with `details: { max }`. `PATCH`, `DELETE`. `POST /api/cart/merge {guestCartId}` (auth required) → `mergeCartResult`. `POST /api/quote` → quote (stored in db with expiry 10 min).
- `cart-scope.ts`: `useCartScope(): { kind: 'user', userId } | { kind: 'guest', guestId }` → selects `queryKeys.user(id).cart()` vs `queryKeys.guestCart(id)`.
- `useCart()`, `useAddToCart()`, `useUpdateCartLine()` (optimistic quantity, rollback on `OUT_OF_STOCK` + message "Apenas N disponíveis"), `useRemoveCartLine()`, `useQuote({ coupon, network })` (`staleTime: 0`, key includes cart `version`), `useMergeGuestCart()` (invoked by `startSession`; shows toast listing adjustments; afterwards removes guest cart query and resets `kurio-guest-cart-id`).
- Coupon state lives in URL search of `/carrinho` (`?cupom=KURIO10`) and is carried to `/pagamento` via search param; remove button clears it. Errors associated to the coupon input.
- Summary shows Subtotal, "Desconto do lançamento", "Taxa de rede" + "Taxa estimada", Total, all strings from the quote (never computed client-side). "Conectar e finalizar" → `/pagamento?cupom=…` (guard sends guests to login with redirect). `OrderSummarySkeleton` same height as summary.

- [ ] **Step 1: Write failing unit tests** `pricing.test.ts`: lines 2×1.19, 6×1.39, 9×1.79 network ethereum no coupon → `{subtotal:'26.83', discount:'0', networkFee:'0.016', total:'26.846'}` (matches Figma); with `KURIO10` → discount `'2.683'`, total `'24.163'`; `LANCAMENTO24` → `COUPON_EXPIRED`; fingerprint changes when one unitPrice changes.
- [ ] **Step 1b:** Wire `onAddToCart` from Task 12 (detail COMPRAR → add + navigate `/carrinho`; card cart icon → add + toast "Adicionado ao carrinho" + header count update).
- [ ] **Step 2: Write failing E2E** `05-cart.spec.ts`: guest adds Emerald Ape ×2 and Violet Nomad ×1 → table/cards show lines and summary; reload → same; + beyond availability → "Apenas N disponíveis" and quantity reverts; remove line → gone + announcement; coupon `XYZ` → "Cupom inválido", `LANCAMENTO24` → "Cupom expirado", `KURIO10` → discount row non-zero, total equals API quote (read via `page.evaluate(fetch('/api/quote'…))`), remove coupon → discount `(-) 00.00`; login as ana (who has 1× Sage Nomad in her seeded cart) → cart contains guest lines + Sage Nomad; Review Focus: guest qty 10 of an edition with 3 available in ana's cart merge → line clamped to available and toast mentions adjustment.
- [ ] **Step 3:** FAIL. **Step 4:** Implement (compare `Desktop/Carrinho de NFTs.png`, `Mobile/Carrinho de NFTs.png`). **Step 5:** PASS. **Step 6:** Commit `feat: add cart with guest merge, coupons and API quotes`.

### Task 14: Realtime client — dedupe, versioning, nft.updated, reconnection

**Files:** Create `src/features/realtime/{RealtimeProvider.tsx,event-guard.ts,event-guard.test.ts,apply-nft-update.ts,apply-nft-update.test.ts,use-socket-status.ts}`, `tests/e2e/09-realtime-checkout.spec.ts` (cart/catalog part), `tests/e2e/10-realtime-resilience.spec.ts` (dup/old/disconnect part); Modify `src/app/providers.tsx`

**Interfaces:**
- `event-guard.ts`: `createEventGuard({ maxIds = 500 })` → `{ shouldApply(envelope, currentUserId): boolean }`: false if `eventId` seen (LRU), false if `version <= lastVersion[resource.type+':'+resource.id]`, false if `envelope.userId !== null && envelope.userId !== currentUserId`; records on true.
- `apply-nft-update.ts`: `applyNftUpdate(qc, envelope): { cartChange: { name, from, to, soldOut: boolean } | null }` — patches `queryKeys.nft(id)`, every cached `['nfts', …]` page containing id (`setQueriesData`), every cached cart (user or guest) line with that nftId (price & edition availability), then `invalidateQueries({ queryKey: ['quote'] })`; returns change info when the NFT is in the cart.
- `RealtimeProvider`: when session exists (or guest — public `nft.updated` events are delivered to everyone), `createSocket(token ?? '')`, `connect()`; listeners `nft.updated`, `order.updated` (Task 18 handler), `wallet.disconnected` (Task 17 handler) registered through `useRealtimeEvent(type, handler)`; on `sessionEnded` → `socket.removeAllListeners(); socket.disconnect()`; on reconnect (`socket.io.on('reconnect')`) → `invalidateQueries` for `['nfts']`, `['nft']`, cart key, `['quote']`, pending orders. Cart change → `announce('O preço de X mudou de A para B')` + `ChangeNotice` inline banner in cart/payment (state in a small `useCartNotices` store, cleared on dismiss).
- `use-socket-status.ts`: `'connected'|'reconnecting'|'offline'` → small status pill in header for screen readers & users ("Reconectando…").

- [ ] **Step 1: Write failing unit tests**: duplicate eventId → second `shouldApply` false; version 5 then 4 → false; other user's event → false; `applyNftUpdate` on a QueryClient seeded with catalog page + cart → both patched, return `{from:'1.19', to:'1.29'}`.
- [ ] **Step 2: Write failing E2E**: (09, cart part) ana with Emerald Ape in cart on `/carrinho`; `mock.emit({action:'nft:update', nftId:'nft_042', price:'1.29'})` → notice "mudou de 1.19 para 1.29" visible, line price 1.29 ETH, summary total recomputed from new quote; same on `/` grid card price. (10) `mock.emit({action:'event:replay', eventId})` of an older event (price 1.29 after a newer 1.39) → UI stays 1.39 and no second notice; `socket:drop` → header shows "Reconectando…", while dropped `nft:update` to 1.49 happens, `socket:restore` → UI shows 1.49 (reconciled via REST). Review Focus: `nft:update` setting the cart line's edition `available: 1` while cart qty is 2 → line marked "Apenas 1 disponível", "Conectar e finalizar" disabled with explanation until qty adjusted.- [ ] **Step 3:** FAIL. **Step 4:** Implement. **Step 5:** PASS. **Step 6:** Commit `feat: add Socket.IO realtime sync with dedupe, versioning and reconciliation`.

### Task 15: Profile (data, avatar, password)

**Files:** Create `src/mocks/handlers/profile.ts`, `src/features/profile/{api,queries,avatar}.ts`, `src/features/profile/avatar.test.ts`, `src/features/profile/components/{ProfileSidebar,ProfileForm,AvatarField,PasswordForm}.tsx`, `tests/e2e/08-profile-wallets.spec.ts` (profile part); Modify `src/routes/perfil.tsx`, `src/routes/perfil.index.tsx`

**Interfaces:**
- Handlers: `GET/PATCH /api/me` (username/email uniqueness → 409 with fieldErrors), `PUT /api/me/avatar` (validates `avatarInputSchema`, 422 otherwise), `DELETE /api/me/avatar`, `POST /api/me/password` (wrong current → 422 `INVALID_PASSWORD` `fieldErrors.currentPassword`; stores new hash).
- `avatar.ts`: `validateAvatarFile(file: File): { ok: true } | { ok: false; message: string }` (types png/jpeg/webp, ≤ 2 MB: messages "Formato não suportado. Use PNG, JPG ou WebP." / "Arquivo maior que 2 MB."); `resizeToDataUrl(file, size = 256): Promise<string>` (canvas, `image/webp` 0.85).
- Profile sidebar per `Desktop/Perfil do Colecionador.png`: Dados do perfil, Carteiras, Lista de interesse are routes; Atividade/Ofertas/Arquivos baixados/Suporte → `/em-breve?secao=…`; Sair → logout. On mobile the sidebar becomes a horizontal scrollable nav (no frame; document). Save shows toast "Perfil atualizado" and updates header avatar via `setQueryData(session)`.
- Password form separate submit ("Alterar senha"), fields cleared on success.

- [ ] **Step 1: Write failing unit tests** `avatar.test.ts`: 3 MB png → size message; `image/gif` → format message; 100 KB webp → ok.
- [ ] **Step 2: Write failing E2E** (profile part): ana edits display name → reload persists; set username to `bruno` → field error; upload `tests/e2e/assets/avatar.png` → avatar img visible in form and header; upload `tests/e2e/assets/big.png` (>2 MB) → error, no request; change password with wrong current → field error; correct → success, logout, login with new password works and old fails.
- [ ] **Step 3:** FAIL. **Step 4:** Implement. **Step 5:** PASS. **Step 6:** Commit `feat: add collector profile with avatar and password change`.

### Task 16: Wallets (primary/secondary upsert)

**Files:** Create `src/mocks/handlers/wallets.ts`, `src/features/wallets/{api,queries}.ts`, `src/features/wallets/components/{WalletForm,WalletSection,NetworkSelect,WalletTypeSelect,EnsField}.tsx`; Modify `src/routes/perfil.carteiras.tsx`, `tests/e2e/08-profile-wallets.spec.ts` (wallets part)

**Interfaces:**
- Handlers: `GET /api/wallets`, `PUT /api/wallets/primary|secondary` (201 create / 200 update; 422 with `fieldErrors` from `walletInputSchema` incl. network-specific address; secondary with `sameAsPrimary: true` copies primary fields and requires primary to exist → 422 `fieldErrors.sameAsPrimary` "Cadastre a carteira principal primeiro"), `POST /api/wallets/:id/connect` → `{ connected: true, sessionId }` or 409 `WALLET_REJECTED` when scenario `wallet-reject`.
- Page per `Desktop/Carteiras.png`: "Carteira principal" section (form; empty state when null with "Adicionar" revealing form), "Carteira secundária" with "Igual à carteira principal" checkbox + "Adicionar"; "Salvar carteira" per section; `?redirect=` support returns to `/pagamento` after first save.

- [ ] **Step 1: Write failing E2E** (wallets part): bruno (no wallets) sees "Você ainda não adicionou uma carteira…" states; submit empty → required errors focused/announced; network Solana + `0x…` address → address error; valid EVM primary saves and persists after reload; secondary "Igual à carteira principal" saves; edit primary nickname → persisted.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat: add primary and secondary wallet management`.

### Task 17: Checkout — form, wallet connection, review, stale quote, idempotent order

**Files:** Create `src/features/checkout/{api,queries,draft,payload-hash}.ts`, `src/features/checkout/{draft.test.ts,payload-hash.test.ts}`, `src/features/checkout/components/{CheckoutForm,WalletPicker,ConnectorPicker,ConnectWalletDialog,ReviewDialog,QuoteChangedDialog,CheckoutSummary,PendingOrderDialog}.tsx`, `src/shared/lib/idempotency.ts`, `src/mocks/handlers/orders.ts` (create part), `tests/e2e/06-purchase.spec.ts`, `tests/e2e/07-payment-failures.spec.ts`; Modify `src/routes/pagamento.tsx`, `tests/e2e/09-realtime-checkout.spec.ts` (checkout part)

**Interfaces:**
- `draft.ts`: `saveCheckoutDraft(userId, values: CheckoutDraft)`, `loadCheckoutDraft(userId)`, `clearCheckoutDraft(userId)` in `sessionStorage['kurio-checkout-draft:'+userId]`; `CheckoutDraft` = payer fields + selected wallet/connector/network + note (no secrets). Debounced save on change; restored on mount (Review Focus).
- `idempotency.ts`: `getAttempt(userId, payloadHash): { key: string; payloadHash: string }` — returns stored attempt if hash matches, else creates `crypto.randomUUID()`; `clearAttempt(userId)`. Stored in `sessionStorage['kurio-order-attempt:'+userId]`.
- `payload-hash.ts`: `hashPayload(input: CreateOrderInput): string` (stable key order JSON → SHA-256 hex via Web Crypto).
- Orders handler (create): `POST /api/orders` requires auth + `Idempotency-Key`: same key+same hash → existing order 200; same key+diff hash → 409 `IDEMPOTENCY_CONFLICT`; else revalidate quote via `computeQuote` and compare `fingerprint` → 409 `QUOTE_STALE` `details: { quote: newQuote }`; stock shortfall → 409 `OUT_OF_STOCK`; creates order `pending` with `snapshot`, `resolveAt = now + 2500ms`, `plannedOutcome` (scenario `payment-declined` → declined else confirmed); scenario `order-timeout`: create + never respond for the first request with that key; scenario `price-change`: on first `POST /api/quote` for the checkout, call `commitNftUpdate` raising the first cart line price by 0.10; scenario `sold-out`: on first `POST /api/orders` call `commitNftUpdate` setting that edition available 0 before validation.
- Checkout flow (`/pagamento`, guarded): load profile + wallets + cart + quote(network from selected wallet, coupon from search). Desktop layout per `Desktop/Pagamento.png`, mobile per `Mobile/Pagamento.png`. Steps: (1) form validation (zod; all `*` fields required); (2) "Confirmar compra" → `ConnectWalletDialog` calling `POST /wallets/:id/connect` (manual wallet uses connector id) — rejection shows "Conexão recusada na carteira." with "Tentar novamente"; (3) `ReviewDialog` lists quote lines/totals + "Enviar pedido" (button `disabled` while pending; Enter repeat ignored); (4) `useCreateOrder()` posts with `Idempotency-Key`; Axios timeout 10 s → `TIMEOUT` → dialog "A confirmação está demorando…" + automatic single retry with **same key**, then "Verificar pedido" button retrying with same key; (5) `QUOTE_STALE` → `QuoteChangedDialog` showing old vs new per changed line + total, requiring "Confirmar novo valor" (re-opens Review with new quote); (6) success → store `pendingOrderId` (Task 18) and navigate `/pedidos/$id`. `wallet.disconnected` event during steps 2–4 → close dialogs, toast "Carteira desconectada. Conecte novamente.", back to step 2, form intact. Empty-wallet state per Spec §9.

- [ ] **Step 1: Write failing unit tests**: `hashPayload` equal for same object with different key order; `getAttempt` returns same key for same hash and a new key for different hash; draft round-trip excludes nothing sensitive (no `password` keys exist in type — compile-time) and is per-user.
- [ ] **Step 2: Write failing E2E** `06-purchase.spec.ts` (desktop + mobile): from `/` click a card → detail → COMPRAR → cart → "Conectar e finalizar" → login as ana → `/pagamento` prefilled → choose MetaMask → connect → review shows total equal to quote → Enviar → pending → confirmation page (Task 18) shows receipt with same total, and cart now lacks bought quantities. `07-payment-failures.spec.ts`: scenario `payment-declined` → "Pagamento recusado" + cart unchanged; double-click "Enviar pedido" → exactly one order (`GET /api/orders` count 1 via mock fetch); scenario `order-timeout` with `page.clock` → advance 10 s → "demorando" → retry → same order id as the one in mock db (assert via `/api/orders`), only one order exists; scenario `wallet-reject` → error then retry after switching scenario succeeds. `09` checkout part: on `/pagamento` with review open, `nft:update` price change → Enviar → `QuoteChangedDialog` shows old/new, confirm → order total uses new price. Review Focus: on `/pagamento` fill fields, `session:expire`, click Confirmar → login page with expired alert → login → `/pagamento` with fields restored.
- [ ] **Step 3:** FAIL. **Step 4:** Implement. **Step 5:** PASS. **Step 6:** Commit `feat: add checkout with wallet simulation, review, stale-quote guard and idempotent orders`.

### Task 18: Orders — scheduler, order.updated, recovery, receipt

**Files:** Create `src/mocks/realtime/order-scheduler.ts`, `src/mocks/handlers/orders.ts` (read part), `src/features/orders/{api,queries,pending-order}.ts`, `src/features/orders/components/{OrderReceipt,OrderPending,OrderDeclined,OrderSkeleton}.tsx`, `src/mocks/realtime/order-scheduler.test.ts`; Modify `src/routes/pedidos.$orderId.tsx`, `tests/e2e/10-realtime-resilience.spec.ts` (pending part)

**Interfaces:**
- `order-scheduler.ts`: `scheduleOrder(order)`, `resolveDueOrders(now = Date.now())` (resolves all pending with `resolveAt <= now` via `commitOrderUpdate`: status → plannedOutcome, `resolvedAt`, version+1; on confirmed: decrement stock via `commitNftUpdate` per line and subtract purchased quantities from the owner's cart lines (remove line when 0)); `bootScheduler()` called in `startMocks` → resolves due and reschedules future ones with `setTimeout`. `GET /api/orders/:id` calls `resolveDueOrders()` first; other user's order → 403 `FORBIDDEN`; missing → 404.
- `pending-order.ts`: `rememberPendingOrder(userId, orderId)`, `getPendingOrder(userId)`, `forgetPendingOrder(userId)` (`localStorage['kurio-pending-order:'+userId]`). On app start with session, if a pending id exists → fetch it; if still pending show a global banner "Você tem um pedido em processamento" linking to it; terminal → forget.
- `order.updated` handler (registered via `useRealtimeEvent` in `orders/queries.ts` hook mounted by `RealtimeProvider`): guard check, `setQueryData(queryKeys.user(id).order(orderId))`, invalidate cart + nft keys, `announce` result; terminal → `forgetPendingOrder`, `clearAttempt`, `clearCheckoutDraft`.
- `/pedidos/$orderId`: `pending` → `OrderPending` (`role="status"`, "Aguardando confirmação na rede…", "Você pode sair desta página com segurança"), polls `GET` every 5 s as fallback while socket offline; `declined` → `OrderDeclined` (reason, "Voltar ao carrinho"); `confirmed` → `OrderReceipt` per `Desktop/Confirmação de Pedido.png` (dialog-styled card with envelope SVG, ID da transação short hash, Data, Total, Carteira, items, Taxa de rede, Total, copy "Transação confirmada na Ethereum…" with network name from snapshot, "Ver no Etherscan" → `explorerUrl` (`https://sepolia.etherscan.io/tx/<simulated>`) opening in new tab with sr-only "(simulação, abre em nova aba)"). Close (X) → `/`. Rendered **only** from `order.snapshot`.

- [ ] **Step 1: Write failing unit tests** `order-scheduler.test.ts` (memory storage db): order with `resolveAt` in past + plannedOutcome confirmed → after `resolveDueOrders` status confirmed, stock decremented, owner's cart line qty 3 with 2 purchased → 1; declined → cart untouched; resolving twice doesn't decrement twice (terminal).
- [ ] **Step 2: Write failing E2E** (10 pending part): create order with `socket:drop` active → page shows pending; `page.reload()` → still pending, no second order; `socket:restore` + wait → confirmed receipt; then `mock.emit` an `nft:update` changing purchased NFT price → receipt values unchanged (snapshot); bruno opening ana's `/pedidos/<id>` → "Pedido não encontrado" (403 mapped to not found UI, no data shown). Review Focus: ana creates an order with `socket:drop` active, logs out, bruno logs in, `socket:restore` + `mock.emit({action:'order:resolve', orderId})` → bruno sees no announcement/toast and no pending-order banner; logging back in as ana shows the order confirmed.
- [ ] **Step 3:** FAIL. **Step 4:** Implement. **Step 5:** PASS (also re-run 06/07). **Step 6:** Commit `feat: add order lifecycle, recovery after reload and immutable receipt`.

### Task 19: Accessibility and loading/failure suites

**Files:** Create `tests/e2e/11-a11y-keyboard.spec.ts`, `tests/e2e/12-loading-failures.spec.ts`; install `@axe-core/playwright`; Modify components as findings require

**Interfaces:** none new.

- [ ] **Step 1: Write failing E2E** `11`: keyboard-only purchase path from `/` to review dialog (Tab/Enter/Space/Arrow on radio groups), focus visible (computed outline ≠ none) on each focused element; login dialog traps focus and returns it on close; filter sheet (mobile) traps focus; registration form submit with errors moves focus to first invalid and errors are linked via `aria-describedby`; axe scan (`wcag2a, wcag2aa`) on `/`, `/nft/nft_042`, `/carrinho`, `/pagamento`, `/perfil`, `/entrar` → zero violations; zoom: set viewport 720 wide with `deviceScaleFactor` + CSS zoom 200% on `/pagamento` → no horizontal scroll. `12`: scenario `slow` → skeletons (`[data-skeleton]`) visible on catalog, detail and cart summary, then replaced; layout shift check: bounding box of first card skeleton equals the final card (±2px); `prefers-reduced-motion: reduce` → skeleton animation-name `none`; scenario `offline` on catalog → error with "Tentar novamente", switch to default + click retry → content.
- [ ] **Step 2:** Run → collect failures. **Step 3:** Fix components. **Step 4:** PASS all specs, both projects. **Step 5:** Commit `test: add accessibility and loading/failure E2E suites with fixes`.

### Task 20: Visual regression + CI

**Files:** Create `tests/visual/pages.visual.spec.ts`, `.github/workflows/e2e.yml`, `tests/visual/pages.visual.spec.ts-snapshots/*` (win32 + linux)

**Interfaces:**
- Visual spec: for `/`, `/nft/nft_042`, `/carrinho` (guest cart seeded via UI with 3 Figma items: Emerald ×2, Violet ×6, Ivory ×9), `/pagamento` (ana): scenario `default` with `latencyOverride: 0`, `await page.evaluate(() => document.fonts.ready)`, wait for `networkidle` and images `complete`, `toHaveScreenshot({ fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.01, mask: [mock panel button] })` in desktop, mobile, tablet.
- Workflow: on push/PR; ubuntu-latest, Node 22, `npm ci`, `npx playwright install --with-deps chromium`, `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`; upload `playwright-report/` and `test-results/` artifacts always. Manual `workflow_dispatch` input `update_snapshots` runs `test:e2e:update -- tests/visual` and uploads the snapshots dir as artifact (to be committed).

- [ ] **Step 1:** Write spec; run `npm run test:e2e:update -- tests/visual` locally → win32 baselines. **Step 2:** Run again without update → PASS. **Step 3:** Push; run workflow with `update_snapshots=true`; download artifact; commit linux baselines. **Step 4:** Push → CI green. **Step 5:** Commit `test: add versioned visual regression baselines and CI workflow`.

### Task 21: Lighthouse audit

**Files:** Create `scripts/lighthouse.mjs`, `lighthouse/config.mjs`, `lighthouse/reports/**`, `lighthouse/summary.md`

**Interfaces:**
- `lighthouse.mjs`: builds demo (`npm run build:demo`), starts `vite preview` on 4173, launches Chrome via `chrome-launcher`, for pages `['/', '/nft/nft_042']` × presets `mobile` (default Lighthouse mobile emulation + simulated throttling) and `desktop` (`lighthouse/core/config/desktop-config.js`) × runs 3: saves `reports/<page>-<preset>-run<n>.report.{html,json}`; computes median per category (performance, accessibility, best-practices, seo) and median LCP, CLS, TBT; writes `summary.md` with table, Lighthouse/Chrome/Node versions, OS, CPU, throttling settings, date, and a "Abaixo da meta" section (filled manually with causes when any median < target: Perf 90, A11y 95, BP 95, SEO 90).

- [ ] **Step 1:** Implement script; run `npm run lighthouse`. **Step 2:** If below targets: investigate with the JSON (LCP element, render-blocking, unused JS, MSW worker registration cost) and fix legitimately (preload, code split, image sizes, defer mock panel) — no audit-only shortcuts. Re-run. **Step 3:** Write justifications for any remaining gaps in `summary.md`. **Step 4:** Commit `perf: add Lighthouse audit config, reports and summary`.

### Task 22: Documentation

**Files:** Create `README.md`, `ARCHITECTURE.md`

**Interfaces:**
- `README.md` (pt-BR): visão geral + links (repo, deploy); requisitos (Node 22); setup (`npm ci`, `npx playwright install chromium`); variáveis (`.env.example` table); credenciais fictícias; comandos (dev, build, build:demo, preview, typecheck, lint, test:unit, test:e2e, test:e2e:update, lighthouse); cenários (table name → how to activate `?scenario=` / painel → what to observe) and reset (`?reset=1`, painel); "Como reproduzir os fluxos de falha" step lists for each README §6 bullet; cupons; política de cache/retry/sincronização table.
- `ARCHITECTURE.md`: estrutura; contratos REST (table per endpoint: method, path, input, output, errors) generated from Spec §5 + actual code; eventos (envelope, types, delivery rules); sessão (storage, expiry, cleanup); carrinho (guest/user, merge, notices); cache strategy; reconciliação REST × Socket.IO; MSW transport + Socket.IO binding limitations (spike results); idempotência; acessibilidade adjustments (`a11y-deviation` list); desvios do Figma (414→390 mobile, mobile adaptations for perfil/carteiras/confirmação/tablet, facets counts computed from fixtures instead of Figma's static numbers, network/ENS simplification, mock panel); decisões de UX; limitações.

- [ ] **Step 1:** Write docs. **Step 2:** Verify every command in README runs from a clean clone (`git clone` to scratchpad → `npm ci` → `npm run build:demo` → `npm run test:unit`). **Step 3:** Commit `docs: add README and ARCHITECTURE`.

### Task 23: Deploy to Vercel and verify

**Files:** Modify `README.md` (deploy URL), `tests/e2e/fixtures.ts` (support `BASE_URL` env to run smoke against prod)

- [ ] **Step 1:** `vercel link` (new project `kurio-nft-marketplace`, user's account) and `vercel deploy --prod` (build `npm run build:demo`). Connect Git integration if available so pushes deploy.
- [ ] **Step 2:** Verify on the public URL: direct load + refresh of `/nft/nft_042`, `/carrinho`, `/perfil/carteiras`, `/rota-inexistente`; `mockServiceWorker.js` served with `application/javascript`; run `BASE_URL=<url> npx playwright test tests/e2e/01-catalog.spec.ts tests/e2e/06-purchase.spec.ts tests/e2e/09-realtime-checkout.spec.ts --project=chromium-desktop` → PASS.
- [ ] **Step 3:** Update README with URL; commit `docs: add public deploy URL`; push. Remind user to revoke the Figma token.
