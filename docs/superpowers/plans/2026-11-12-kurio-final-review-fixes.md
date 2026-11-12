# Final review fix batch (FR-01..FR-21) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every finding of the final review that the user approved for fixing, then re-verify the whole app and redeploy.

**Architecture:** Mostly class-level changes in existing components (type scale, container, control heights) driven by the Figma JSON vs DOM comparator, plus small behavioral fixes (router search serialization, private-route pending UI, retry, a11y details) each pinned by a unit or e2e test.

**Tech Stack:** React 19, TanStack Router/Query, Tailwind v4 tokens (`src/styles/tokens.generated.css`), Radix, Vitest, Playwright.

**Spec:** `docs/qa/relatorio-revisao-final.md` (findings FR-01..FR-21, with evidence); challenge README via `.superpowers/sdd/2026-11-11-kurio-nft-marketplace/qa-tools/challenge.md`.

## Global Constraints

- Only existing tokens: `text-body-lg-16/17/18`, `text-body-15`, `text-body-14`, `text-caption-13/12`, `text-title-20/22`, `text-heading-24/28`, `text-display-32`, `text-tiny-10`. No arbitrary px font sizes.
- UI copy pt-BR unchanged; code/comments/commits in English. Commits end with the session attribution trailers.
- No mock-only branches in app components (README §6); fixes under `src/mocks` stay there.
- Every behavioral fix has a test that fails before the fix. Pure class tweaks (typography/spacing) are verified by the comparator (`qa-tools/cmp.mjs`) on fresh captures plus the visual suite (baselines regenerated once, at the end).
- Never commit `tests/*.tmp.spec.ts`, `.env.local`, CLAUDE.md.

## Review Focus

1. A shared link with plain values (`/?minPrice=3.62&categories=arte-digital`) must apply the filters, and old JSON-style links already shared (`?maxPrice=%2212.00%22`) must keep working — Task 7 tests both.
2. Other routes with search params (`/entrar?redirect=…&reason=expired`, `/nft/$id?edition=…`, `/carrinho?cupom=…`, `/perfil/carteiras?redirect=…`) must still parse after the serializer change — Task 7 runs their existing e2e.
3. Smaller form controls (40 px) must keep a ≥24 px target and visible focus — Task 4 relies on the a11y e2e (`11`) and the F8 focus walk.
4. The mobile type changes must not reintroduce wraps/overflow at 320–414 px — Task 13 reruns `13-mobile-fit` and `layout-audit2`.
5. The private-route pending UI must not flash on fast loads — Task 8 uses a pending delay (`pendingMs`) and the e2e asserts the skeleton only under `slow`.

---

### Task 1: Desktop container + shell typography (FR-02, FR-03 shell)

**Files:** Modify `src/shared/layout/Header.tsx`, `src/shared/layout/Footer.tsx`, `src/shared/layout/PageShell.tsx`.

- [ ] Container in all three: `max-w-[1200px] px-4` → `max-w-[1232px] px-4` (content box 1200 px at x=120 on 1440).
- [ ] Header nav links `text-body-lg-16` (was 15); "Entrar" `text-body-lg-16 font-medium`.
- [ ] Footer: column headings (Meu perfil, Central de ajuda, Coleções, Redes sociais, Carteiras compatíveis) `text-body-lg-18`; feature titles `text-body-lg-17`; feature texts `text-body-14`; feature letter circle `text-heading-24`; newsletter heading `text-body-lg-18`; "Enviar" `text-body-lg-18`; newsletter description `text-caption-13`.
- [ ] Verify: comparator on desktop home shows no size/weight diff for these texts; `npm run typecheck && npm run lint`.
- [ ] Commit `fix(layout): Figma container width and shell type scale (FR-02, FR-03)`.

### Task 2: Catalog + detail desktop typography (FR-03)

**Files:** `src/features/catalog/components/CatalogTabs.tsx`, `src/features/nft/components/*` (edition chips, quantity, buy/favorite buttons, related cards).

- [ ] Active tab weight `font-medium` (500).
- [ ] Detail edition chips `text-body-14`; selected chip weight unchanged in size; quantity value `text-title-20`; COMPRAR `text-body-14`; Favoritar `text-body-14`.
- [ ] Related ("Colecionadores também viram") card name `text-body-15`, price `text-body-lg-16` (desktop); section title `text-body-lg-17`.
- [ ] Verify with comparator (desktop detail/cart); commit `fix(nft): Figma type scale on detail and related cards (FR-03)`.

### Task 3: Cart, payment, receipt desktop typography + coupon height (FR-03, FR-04)

**Files:** `src/features/cart/components/*` (CartTable/lines, OrderSummary, CouponForm), `src/features/checkout/components/*`, `src/features/orders/components/*`.

- [ ] Cart table header `text-body-lg-16` weight 500; line name `text-body-lg-16`; token id `text-body-14`; prices `text-body-lg-16`; quantity `text-body-lg-17`.
- [ ] `OrderSummary` rows: label/value `text-body-15`, "Taxa estimada" `text-caption-12`, Total label `text-body-lg-16`; summary title `text-body-lg-18`; "Código promocional" `text-body-14`; "Aplicar"/"Conectar e finalizar"/"Continuar explorando" `text-body-15`.
- [ ] Coupon input + button height `h-10` (40 px).
- [ ] Payment: section titles `text-body-lg-17`; NFT list names `text-body-lg-16`, ids/qty `text-body-14`; wallet options `text-body-15`; "Confirmar compra" `text-body-15`; "Usar outra carteira?" `text-body-15`.
- [ ] Receipt: title `text-body-lg-16`; meta labels `text-body-14`; "Detalhes da transação" `text-body-15`; qty `text-body-14`; "Taxa de rede"/"Subtotal" `text-body-15`; note `text-body-14`.
- [ ] Mobile values follow the mobile Figma (Task 6) through `md:` prefixes where they differ.
- [ ] Verify comparator desktop cart/payment/receipt; e2e `05`, `06`; commit `fix(checkout): Figma type scale on cart, payment and receipt (FR-03, FR-04)`.

### Task 4: Account pages: type, 40 px controls, subtitle colour (FR-03, FR-04, FR-05)

**Files:** `src/features/profile/components/*`, `src/features/wallets/components/*`, shared field component used by them.

- [ ] Sidebar title "Meu perfil" `text-body-lg-18`; page titles ("Perfil do colecionador", "Carteira principal", "Carteira secundária") `text-body-lg-17`; "Alterar senha" `text-body-lg-16 font-medium`.
- [ ] Required asterisk `text-title-22`.
- [ ] Inputs/selects/buttons on profile, wallets and payment forms `h-10 rounded-[3px]` (was h-14); "Salvar"/"Salvar carteira"/"Remover"/"Alterar" `text-body-14`.
- [ ] Wallets subtitle colour `text-text-secondary` (was accent).
- [ ] Verify comparator desktop profile/wallets; e2e `08`, `11`; commit `fix(account): Figma type scale, 40px controls and subtitle colour (FR-03..05)`.

### Task 5: Auth typography (FR-03)

**Files:** `src/features/auth/components/*`.

- [ ] Dialog tabs "Entrar"/"Criar conta" `text-title-20 font-medium`; submit `text-body-lg-16`; social buttons weight `font-medium`; "Esqueceu a senha?" `text-body-14`.
- [ ] Mobile page: "KURIO" `text-display-32`; title `text-title-20` (signup title `text-body-lg-18`); submit `text-body-lg-16`; social `text-caption-13 font-medium`; footer link `text-body-15`; "Esqueceu a senha?" `text-body-14`.
- [ ] Verify comparator login/signup (desktop + mobile); e2e `03`; commit `fix(auth): Figma type scale (FR-03)`.

### Task 6: Mobile detail/cart/payment typography (FR-03)

- [ ] Detail: name `text-title-20`; description `text-body-14`; edition chips `text-body-14`; meta lines `text-body-15`; "Qtd." `text-body-15 font-medium`; price `text-title-20`; "Comprar NFT" `text-body-lg-16`.
- [ ] Cart: title `text-title-20`; names `text-body-15`; edition `text-body-14`; qty `text-body-lg-16`; summary rows `text-body-15`, values `text-body-lg-16`; "Conectar e finalizar" `text-body-lg-16`.
- [ ] Payment: title `text-title-20`; "Carteira conectada"/"Carteira e rede" `text-body-lg-16`; "Trocar carteira" `text-body-14`; wallet names `text-body-14`; "Total:" `text-body-lg-16`; "Confirmar compra" `text-body-15`.
- [ ] Verify comparator mobile frames + e2e `13-mobile-fit`; commit `fix(mobile): Figma type scale on detail, cart and payment (FR-03)`.

### Task 7: Plain query strings in URLs (FR-12)

**Files:** Create `src/app/search-serialization.ts` + `.test.ts`; modify the router creation (`src/app/router.tsx` or where `createRouter` lives).

**Interfaces:** Produces `parseSearch(search: string): Record<string, unknown>` and `stringifySearch(search: Record<string, unknown>): string`.

- [ ] Failing tests: `parseSearch('?minPrice=3.62&categories=a&categories=b&page=2&q=42')` → `{ minPrice: '3.62', categories: ['a','b'], page: '2', q: '42' }`; legacy `parseSearch('?maxPrice=%2212.00%22&categories=%5B%22x%22%5D')` → `{ maxPrice: '12.00', categories: ['x'] }`; `stringifySearch({ categories: ['a','b'], maxPrice: '12.00', page: 2, q: undefined })` → `'?categories=a&categories=b&maxPrice=12.00&page=2'`; `stringifySearch({})` → `''`.
- [ ] Implement with `URLSearchParams`; values that are a JSON string/array (legacy) are decoded; arrays become repeated keys; `undefined`/`null` dropped. Wire `parseSearch`/`stringifySearch` into `createRouter`.
- [ ] Add e2e in `01-catalog.spec.ts`: `/?minPrice=3.62&categories=arte-digital` filters the grid (first card name equals API page 1 for those params) and an app-made filter URL contains `categories=arte-digital` (no `%22`).
- [ ] Run unit + e2e `01`, `02`, `03`, `05`, `08`; commit `fix(router): plain, shareable query strings (FR-12)`.

### Task 8: Pending UI on private routes (FR-16)

**Files:** `src/routes/_authenticated.tsx`; reuse an existing page skeleton component (or create `src/shared/layout/PageSkeleton.tsx`).

- [ ] Failing e2e in `12-loading-failures.spec.ts`: signed in, `slow` scenario, full reload of `/perfil` → within 1.5 s the header (`banner`) and a `[data-skeleton]` are visible.
- [ ] `pendingComponent: PageSkeleton`, `pendingMs: 300`, `pendingMinMs: 300` on `_authenticated`; root layout renders around it.
- [ ] Commit `fix(auth): show the shell and a skeleton while a private route checks the session (FR-16)`.

### Task 9: Mock layer and panel (FR-07, FR-18, FR-21)

- [ ] FR-21 failing unit (`src/mocks/db/store.test.ts`): with a `globalThis.localStorage` getter that throws, `getDb()` works (memory). Fix `resolveStorage` with try/catch.
- [ ] FR-18: latency input initial value from `getMockConfig().latencyOverride ?? ''`; README panel row notes the scenario change ends the session and resets the cart. Unit/e2e assertion in `mock-control.spec.ts`: after applying 1200 and reloading, the field shows 1200.
- [ ] FR-07: below `md` the "Simulação" trigger is an icon-only 44×44 button (`aria-label="Simulação"`, title) placed bottom-left above the tab bar; it must not overlap the cart stepper at 320 nor the detail/checkout bottom bars (verify with `layout-audit2` COVERED = 0 for the trigger).
- [ ] Commit `fix(mocks): storage fallback, panel latency field, compact mobile trigger (FR-07, FR-18, FR-21)`.

### Task 10: A11y details (FR-09, FR-14, FR-19, FR-20)

- [ ] FR-09: dialog and sheet close button: 32×32 hit area (`size-8 inline-flex items-center justify-center`), full opacity, focus ring; same for the mock panel close. E2E (`11`) assert close button box ≥ 24×24.
- [ ] FR-14: filter trigger `aria-label` = `Filtros` / `Filtros, 1 ativo` / `Filtros, N ativos`; e2e in `01` (mobile).
- [ ] FR-19: account `DropdownMenu.Root modal={false}`; F8 axe probe clean with the menu open.
- [ ] FR-20: global `@media (prefers-reduced-motion: reduce)` disables `animate-in/out` and transitions on `[data-slot=sheet-content], [data-slot=dialog-content]` and overlays (or `motion-reduce:animate-none motion-reduce:transition-none` in `sheet.tsx`/`dialog.tsx`); e2e in `12`: with `reducedMotion: 'reduce'` the opened sheet has `animation-name: none`.
- [ ] Commit `fix(a11y): close targets, filter count name, non-modal menu, reduced motion (FR-09, FR-14, FR-19, FR-20)`.

### Task 11: Filters and retry (FR-13, FR-15, FR-17)

- [ ] FR-13: `FilterSheet` shows "Ver resultados" without a count while `isPlaceholderData`/fetching a new key; e2e (mobile, `slow`): right after toggling, the button text has no `(60)`.
- [ ] FR-15: with `total === 0` and an applied price, the price text shows the applied range (`search.minPrice`/`maxPrice`, else bounds); unit test on a pure `priceLabel` helper.
- [ ] FR-17: checkout `LoadError` retry refetches every failed query (profile, wallets, cart); e2e in `12`: `/pagamento` offline → default → one click recovers.
- [ ] Commit `fix(catalog,checkout): live result count, applied price label, single retry (FR-13, FR-15, FR-17)`.

### Task 12: Documentation (FR-01, FR-06, FR-08, FR-10, FR-11)

- [ ] ARCHITECTURE "Desvios do Figma": round-2 items (swipeable hero with larger dots, stacked filter footer, short detail tab labels on mobile, 2-line card names) and the documented S4s (no footer removal on account pages, active sidebar item as background, struck-through previous price, dots spacing, small text links, 320 px wraps), plus the FR-12 URL format and FR-07 compact trigger.
- [ ] Commit `docs: Figma deviations and final-review decisions`.

### Task 13: Full verification and delivery

- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build && npm run check:prod-bundle`.
- [ ] Recapture (`qa-figma` capture) and rerun the comparator on all 15 frames: remaining size/weight diffs only on documented deviations.
- [ ] `layout-audit2` full matrix: no new OUT-OF-VIEWPORT/CUT/COVERED.
- [ ] `npm run test:e2e` (all projects). Regenerate win32 visual baselines; push with `[update-snapshots]`, download Linux baselines from CI, commit them; CI green.
- [ ] `npm run lighthouse`, update `lighthouse/summary.md` + reports.
- [ ] Merge to `main`, push, Vercel deploy; smoke on the deploy; update the report (status per FR), ledger, memory. Delete `tests/*.tmp.spec.ts`.
