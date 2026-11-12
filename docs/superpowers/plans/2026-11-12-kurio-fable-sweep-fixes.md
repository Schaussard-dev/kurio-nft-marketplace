# Fable sweep fixes — Package 1 (then Package 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix the findings of the final Fable sweep that the user approved (option A: Package 1, then Package 2), then merge and deploy.

**Architecture:** Mostly class-level layout fixes in existing components plus small behavior fixes; each behavior/layout fix is pinned by an e2e or unit test that fails first. New responsive e2e checks live in `tests/e2e/14-responsive.spec.ts`.

**Tech Stack:** React 19, Tailwind v4 tokens, Radix dialog/sheet, sonner, TanStack Router/Query, Playwright, Vitest.

**Spec:** findings in `.superpowers/sdd/2026-11-12-fable-sweep/{code-review,responsive,figma}.md` (IDs CR-, RS-, FG-); challenge `qa-tools/challenge.md`.

## Global Constraints
- Existing tokens only; no mock-only branches in app code; ETH as strings; copy pt-BR.
- Memory is tight: e2e in the foreground, `--workers=2`, chunks < 10 min; free ports 4173/5173 by PID before runs; `npm run build:demo` before preview.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
1. Any dialog taller than the viewport (review, connect, quote-changed, auth, zoom) scrolls and keeps its actions reachable — Task 1 test uses the review dialog at 844x390 and 568x320.
2. Toasts never cover fixed bottom chrome on phones — Task 2.
3. Short viewports (≤480 px high) keep the page usable: buy bar/tab bar no longer fixed — Task 3.
4. 1024–1279 desktop variant: toolbar, hero dots, payment form, cart table — Task 4.
5. Header sign-in returns to the page it was opened from, never to a private/external target — Task 6.

---

### Task 1: Dialogs fit any viewport (RS-01, RS-02)
- [ ] e2e (14-responsive): signed in, cart with Golden Frequency + Sage Nomad, `/pagamento` → review at 844x390 and 568x320: "Enviar pedido" and "Voltar" can be scrolled into view and clicked; at 360x740 no element inside the dialog extends past its right edge.
- [ ] `dialog.tsx` DialogContent: `grid-cols-[minmax(0,1fr)] max-h-[calc(100dvh-2rem)] overflow-y-auto`; `ReviewDialog.tsx` line name `break-words` instead of `truncate`.

### Task 2: Toasts above fixed chrome (RS-03)
- [ ] e2e: 390x844 detail, add to cart toast rect does not intersect `[data-bottom-bar]`.
- [ ] `providers.tsx`: `position` top-center below 1024 (`useMediaQuery`), bottom-right from 1024.

### Task 3: Short viewports (RS-05)
- [ ] e2e at 320x180: detail edition radio clickable; filter sheet "Ver resultados" clickable.
- [ ] `@media (max-height: 480px)`: buy bar and tab bar `position: static` (+ remove page bottom padding); filter sheet scroller `min-h-0 flex-1`; account menu `max-h` available-height + `overflow-y-auto`.

### Task 4: 1024–1279 desktop variant + tables (RS-04, RS-11, RS-12, RS-13, RS-14, RS-17/FG-02)
- [ ] e2e at 1024x768: the three catalog tabs fully visible (tab list scrollWidth ≤ clientWidth) and sort label one line; hero dots left of image start; detail main image card height ≈ width; cart table cells don't overlap with a 1234.56789 ETH price.
- [ ] Toolbar stacks `lg:max-xl` + sort label `whitespace-nowrap`; hero dots offset only from `xl`; gallery-main `md:self-start`; payment grid `lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] xl:…489px`; cart table `table-fixed` + cell padding + name cell `max-w-0`; detail h1 `break-words`; receipt table `table-fixed`.

### Task 5: Mobile polish + Figma S2/S3 picks (RS-08, RS-09, RS-10, RS-21, RS-18, FG-01, FG-12, FG-21, FG-23, FG-33, FG-04 links)
- [ ] e2e: 414x896 detail — "Edição" radiogroup top is above the buy bar top on first paint; 320 cards show the full name (no clamp hiding `#`); loading private page keeps footer below the fold (CLS check via `main` min-height).
- [ ] FG-01: mobile gallery without thumbnail strip (dot indicator), artwork capped, sheet overlap; RS-08 `main` min-height while pending; RS-09 `max-[374px]:line-clamp-3`; RS-10 `leading-6` on wrapping headings; RS-21 `gap-y-1 leading-5`; FG-12 `text-body-lg-18`; FG-21 `md:text-body-lg-16 md:px-5`; FG-23 `text-muted` token line in checkout + receipt; FG-33 placeholder `text-caption-13`, button `w-[97px]`, card radius 14; footer links `text-body-14`; RS-18 `viewport-fit=cover` + tab bar inset outside the `h-20` row.

### Task 6: Behavior (CR-01, CR-02, CR-03, CR-10, CR-11)
- [ ] CR-01 e2e: guest on `/carrinho` with an item → header "Entrar" → sign in → back on `/carrinho`.
- [ ] CR-02 unit: round trip for `q` = `"x"`, `["a","b"]`, `["a"]`; `stringifySearch` JSON-encodes strings that look like legacy JSON, skips `''`.
- [ ] CR-03: `(profile.isError && !profile.data) || (wallets.isError && !wallets.data)` (+ busy state on retry, CR-04).
- [ ] CR-11 unit: price notice text uses `formatEth`.
- [ ] CR-10: panel keeps last `nft:update` eventId and prefills "ID do evento" (e2e in shell).

### Task 7: Verify Package 1
- [ ] typecheck, lint, unit, build, check:prod-bundle; e2e chunks (2 workers); layout-audit2 spot matrix; commit.

### Task 8+: Package 2 (Figma geometry FG-03, FG-04, FG-07, FG-08, FG-09, FG-10, FG-11, FG-14, FG-15)
- [ ] Per frame: apply the Figma geometry from `figma.md`, re-run the capture + side-by-side, then the responsive spot checks.

### Final: docs (Desvios: FG-06, FG-13, FG-16, RS-07, RS-16, RS-19, FG-36), visual baselines win32+linux, Lighthouse, CI, merge to main (confirm), deploy smoke, report update.
