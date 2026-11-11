# Kurio — NFT Marketplace (Jungle Gaming frontend challenge)

## Purpose
Hiring challenge deliverable (README: `gh repo view junglegaming/frontend-challenge`): NFT marketplace with discovery, purchase and collector-account flows, desktop + mobile, all backend behavior simulated with MSW (REST + Socket.IO). Graded on Figma fidelity, flows, integration/state, realtime, mocking, tests, a11y, Lighthouse, docs. Goal: max score, zero eliminatory items.

## Source of truth
- Requirements: challenge README §1–§12 → design spec `docs/superpowers/specs/2026-11-11-kurio-nft-marketplace-design.md` (binding).
- Execution plan (23 tasks): `docs/superpowers/plans/2026-11-11-kurio-nft-marketplace.md`.
- Progress ledger (gitignored, survives context clears): `.superpowers/sdd/2026-11-11-kurio-nft-marketplace/progress.md` — read it first when resuming; per-task briefs/reports live in the same folder; shared subagent constraints in `context.md` there.
- Visual: Figma file `Ff0SksUi7UFtPWUO8kyNtw`; PNG exports in `design/figma-exports/{Desktop,Mobile}/`.

## Tech stack (pinned, see package.json)
Vite 8 + React 19 + TypeScript 5.9 (not 7: typescript-eslint unsupported) · TanStack Router (file routes) + Query v5 · Axios · socket.io-client 4.8 · Tailwind v4 (`@theme` tokens) · shadcn/ui on `radix-ui` in `src/shared/ui` · Zod 4 · react-hook-form · big.js · sonner · MSW **2.15** (do NOT upgrade to 3: `@mswjs/socket.io-binding` peer is ^2) · Vitest 5 · Playwright 1.65 · Lighthouse 13. npm (no pnpm).

## Structure
- `src/app` router, providers, query-client (`queryKeys` factory) · `src/routes` file routes; private ones under `src/routes/_authenticated/` (pathless guard layout).
- `src/features/<feature>/{api,queries}.ts + components/` · `src/shared/{contracts (Zod, shared with mocks), api (axios http, ApiError, sessionStore), lib (money, format, safe-redirect), ui, layout}`.
- `src/mocks` (only place that knows about mocks): `db/` persistent seeded DB, `fixtures/`, `handlers/`, `scenarios.ts`, `network.ts` (`withNetwork`), `realtime/` (mock Socket.IO server + `commit*` pipeline), `browser.ts` (`startMocks`).
- `scripts/` figma-tokens (needs `.env.local` token), optimize-images, lighthouse · `tests/e2e`, `tests/visual`.

## Dev workflow
- `npm run dev` (mocks on) · `npm run build` (mocks off) · `npm run build:demo` (mocks on; Vercel build) · `npm run preview` (4173)
- `npm run typecheck` · `npm run lint` · `npm run test:unit` · `npm run test:e2e` (builds demo + preview 4173 AND dev 5173 for the realtime spike project; ports must be free)
- Mock control: `?scenario=<name>&reset=1`, floating "Simulação" panel, or `POST /api/__mock/{reset,scenario,emit}`.
- Deploy: Vercel (`vercel.json` SPA rewrite), public URL required.
- Git: work on branch `feat/kurio-app`; commit + push per task (user authorized); merge to `main` only at the end with user consent.

## Conventions
- UI copy pt-BR (verbatim from Figma when drawn); code, comments, commits, CLAUDE.md, memory in English.
- ETH = decimal strings end to end; all math via `src/shared/lib/money.ts`; never `Number()` a price.
- Every REST call through `src/shared/api/http.ts` (`request(config, schema)` validates with Zod); every server state via TanStack Query with `queryKeys`. Only exception: mock panel / tests calling `/api/__mock/*` with fetch.
- Query keys scoped: public `['nfts', params]`, `['nft', id]`; private `['user', userId, …]`; guest `['guest-cart', id]`.
- E2E: wait for `navigator.serviceWorker.controller` before mock-dependent steps; new context per test; control mocks via `page.evaluate(fetch('/api/__mock/...'))` (page.request bypasses the SW).

## Constraints / gotchas
- README §6 eliminatory: no fake data or mock-only branches in components/hooks/axios; realtime events must flow through `socket.io-client` (trigger via `/api/__mock/emit`, never set cache directly).
- Socket token travels ONLY in CONNECT `auth` (mock reads raw `40{…}` frame); never in the URL query.
- `@mswjs/socket.io-binding` never pings → mock server pings every 25 s; websocket transport only; mock server is per tab.
- `/api/__mock/scenario` doesn't reseed; use `reset {scenario}` to apply seed patches.
- Never print or commit `.env.local` (Figma token). Remind user to revoke it at the end.
- Windows host: Git Bash + PowerShell; LF→CRLF warnings are harmless.

## Architecture decisions
- Guest cart lives in the mock API via `X-Cart-Id` header; merged on login (`POST /cart/merge`).
- Orders: `Idempotency-Key`, `QUOTE_STALE` 409 forces re-confirmation, `resolveAt` persisted so pending orders resolve after reload; receipt renders only from immutable snapshot.
- Realtime: event envelope `{eventId, type, resource, version, userId}`; client dedupes by eventId + monotonic version; reconnect → invalidate active queries; server `disconnectUser` on session end.
- Login/Cadastro: dialog over Início on ≥768px, full page on mobile (Figma).
