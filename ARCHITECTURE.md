# Arquitetura — Kurio

Este documento descreve como a aplicação está organizada e por quê. Ele cobre contratos REST, eventos Socket.IO, sessão, carrinho, cache, reconciliação entre REST e tempo real, a camada de mocks, idempotência, acessibilidade, desvios do Figma, decisões de UX e limitações. Setup, comandos, cenários e roteiros de falha estão no [`README.md`](README.md).

O código é a fonte de verdade: os contratos citados aqui são os schemas Zod de `src/shared/contracts/`.

## Sumário

1. [Visão geral](#visão-geral)
2. [Estrutura](#estrutura)
3. [Rotas](#rotas)
4. [Contratos REST](#contratos-rest)
5. [Eventos Socket.IO](#eventos-socketio)
6. [Sessão](#sessão)
7. [Carrinho](#carrinho)
8. [Estratégia de cache](#estratégia-de-cache)
9. [Reconciliação REST × Socket.IO](#reconciliação-rest--socketio)
10. [Camada de mocks (MSW)](#camada-de-mocks-msw)
11. [Pedidos e idempotência](#pedidos-e-idempotência)
12. [Acessibilidade](#acessibilidade)
13. [Desvios do Figma](#desvios-do-figma)
14. [Decisões de UX](#decisões-de-ux)
15. [Limitações](#limitações)

## Visão geral

```
UI (routes + features/*/components)
  │ hooks de feature (features/*/queries.ts) — TanStack Query
  ▼
features/*/api.ts ──► shared/api/http.ts  request(config, zodSchema)  ── Axios ──► /api/*
                                                                                    │
socket.io-client (features/realtime) ◄── WebSocket ──────────────────────────────┐  │
                                                                                  │  │
                    só com VITE_ENABLE_MOCKS=true, no navegador:                   │  ▼
                    src/mocks: Service Worker (REST) + ws.link/@mswjs/socket.io-binding
                               └─ banco simulado (localStorage) ─ commit() ─ emite eventos
```

- **Contratos compartilhados:** os mesmos schemas Zod validam as respostas no cliente (`request()` falha com `INVALID_RESPONSE` se a resposta não bate) e as entradas nos handlers MSW. Os tipos TypeScript saem de `z.infer`.
- **Fronteira dos mocks:** só `src/mocks/**` conhece a simulação. A aplicação a carrega com um `import()` dinâmico em `src/main.tsx` e o painel com um `lazy()` em `src/routes/__root.tsx`, ambos atrás de `VITE_ENABLE_MOCKS`. Componentes, hooks e o Axios não têm dados fictícios nem caminhos alternativos. O `npm run check:prod-bundle` prova que o build de produção não contém nada da simulação.
- **Dinheiro:** valores ETH são strings decimais de ponta a ponta (contrato, cache, UI). Toda conta passa por `src/shared/lib/money.ts` (big.js). Quantidades são inteiras.

## Estrutura

```
src/
  main.tsx                 boot: pré-carrega a rota inicial, sobe os mocks (se ativos) e renderiza
  app/                     router (hooks de sessão), providers, query-client (padrões + queryKeys), 404
  routes/                  rotas por arquivo (TanStack Router); privadas em routes/_authenticated/
  features/
    auth/                  login, cadastro, sessão, guard, eventos de fim de sessão, retomada
    catalog/               início, hero, filtros, busca, grid, paginação, search params
    nft/                   detalhe, galeria, edições, quantidade, avaliações
    favorites/             favoritos (otimista) e página /perfil/favoritos
    cart/                  carrinho (visitante/usuário), merge, cupom, cotação, avisos de preço/estoque
    checkout/              pagamento, conexão de carteira, revisão, rascunho, tentativa idempotente
    orders/                pedido pendente/recusado/recibo, faixa global de pedido pendente
    profile/  wallets/     perfil, avatar, senha; carteiras principal e secundária
    realtime/              socket, hub de eventos (dedupe/versão/usuário), reconexão, pílula de status
    mock-panel/            painel "Simulação" (só no build com mocks)
  shared/
    contracts/             schemas Zod (REST + eventos), compartilhados com os mocks
    api/                   http.ts (Axios + interceptors), ApiError, sessionStore, id do carrinho visitante
    lib/                   money, format, idempotency, safe-redirect, stable-json…
    ui/                    componentes shadcn/ui adaptados aos tokens do Figma, LiveRegion, Skeleton
    layout/                cabeçalho, rodapé, tab bar mobile, breadcrumbs
  styles/                  globals.css + tokens.generated.css (gerado do Figma por scripts/figma-tokens.mjs)
  mocks/                   ver "Camada de mocks"
tests/e2e, tests/visual    Playwright
lighthouse/                configuração, relatórios e resumo da auditoria
scripts/                   lighthouse, check-prod-bundle, figma-tokens, optimize-images, make-e2e-assets
```

Convenções: cada feature tem `api.ts` (chamadas tipadas), `queries.ts` (hooks TanStack Query) e `components/`. Toda chamada REST da aplicação passa por `shared/api/http.ts`, e todo estado de servidor passa pelo TanStack Query com chaves de `queryKeys`. A única exceção são o painel de mocks e os testes, que chamam `/api/__mock/*` com `fetch`: é ferramenta de demonstração e teste, não REST de negócio, e não existe no build de produção.

## Rotas

| Rota | Tela | Acesso |
|---|---|---|
| `/` | Início: hero, catálogo (busca, filtros, abas, ordenação, paginação na URL), destaque, promoções, diário | público |
| `/nft/$nftId` | Detalhe do NFT | público |
| `/carrinho` | Carrinho | público (carrinho de visitante) |
| `/entrar`, `/cadastro` | Login e cadastro: diálogo sobre a Início em ≥ 768 px, página cheia abaixo disso | só visitante (logado vai para o `redirect`) |
| `/pagamento` | Pagamento | autenticado |
| `/pedidos/$orderId` | Pedido pendente, recusado ou recibo confirmado | autenticado e dono |
| `/perfil`, `/perfil/carteiras`, `/perfil/favoritos` | Perfil (dados, avatar, senha), carteiras, favoritos | autenticado |
| `/em-breve` | Página honesta para seções fora do escopo | público |
| `*` | 404 no padrão visual | público |

- **Guard:** `src/routes/_authenticated.tsx` (layout sem caminho). Com sessão em cache, navega na hora e revalida em segundo plano. Sem sessão, faz `ensureQueryData` e redireciona para `/entrar?redirect=<href>` (mais `reason=expired` quando o token salvo foi recusado pela API). O `redirect` só é seguido se for um caminho interno (`safe-redirect.ts`).
- **Search params do catálogo** (`q`, `categories[]`, `networks[]`, `minPrice`, `maxPrice`, `tab`, `sort`, `page`): validados com o mesmo schema do contrato, valores inválidos caem no padrão e os padrões saem da URL. Qualquer mudança de filtro, busca, aba ou ordenação volta para a página 1. A busca usa debounce de 300 ms com `replace`; filtros e páginas usam `push`, para o voltar/avançar restaurar o estado.

## Contratos REST

Base `/api`. Schemas em `src/shared/contracts/`; handlers em `src/mocks/handlers/`. Rotas autenticadas exigem `Authorization: Bearer <token>`. Toda requisição também leva `X-Cart-Id` (o id do carrinho de visitante).

**Envelope de erro** (`apiErrorBodySchema`):

```json
{ "error": { "code": "OUT_OF_STOCK", "message": "Apenas 2 disponíveis", "fieldErrors": { "campo": ["mensagem"] }, "details": { "max": 2 } } }
```

| HTTP | `code` | Significado |
|---|---|---|
| 422 | `VALIDATION_ERROR` | corpo, parâmetro ou cabeçalho inválido (`fieldErrors` por campo quando se aplica) |
| 401 | `UNAUTHENTICATED` | sem token, ou credenciais inválidas no login |
| 401 | `SESSION_EXPIRED` | token desconhecido, expirado ou invalidado |
| 403 | `FORBIDDEN` | recurso de outro usuário (pedido) |
| 404 | `NOT_FOUND` | NFT, edição, linha, pedido ou carteira inexistente |
| 409 | `EMAIL_TAKEN`, `USERNAME_TAKEN` | conflito de cadastro ou de perfil |
| 409 | `OUT_OF_STOCK` | quantidade acima da disponibilidade |
| 409 | `QUOTE_STALE` | a cotação confirmada não vale mais (`details.quote` traz a nova) |
| 409 | `IDEMPOTENCY_CONFLICT` | mesma `Idempotency-Key` com outro payload |
| 409 | `WALLET_REJECTED` | o colecionador recusou a conexão na carteira (simulado) |
| 422 | `COUPON_INVALID`, `COUPON_EXPIRED`, `INVALID_PASSWORD` | regras de negócio |
| 503 / 500 | `TRANSIENT` | falha transitória (cenários `server-error` e `favorite-fail`) |

No cliente, `toApiError()` normaliza tudo em `ApiError`. Ele acrescenta os tipos locais `NETWORK`, `TIMEOUT`, `INVALID_RESPONSE` e `CANCELED`. `isTransient` vale para `NETWORK`, `TIMEOUT`, `TRANSIENT` e qualquer status ≥ 500 (408 e 429 sem envelope viram `TRANSIENT`).

Todos os endpoints passam por `withNetwork()`: latência do cenário e falhas por rota (rede, timeout, status HTTP). Os erros abaixo são os da regra de negócio de cada endpoint. Nas rotas autenticadas, ainda vale o `401` da tabela acima.

### Sessão e conta

| Método e caminho | Entrada | Saída | Erros |
|---|---|---|---|
| `POST /auth/register` | `{ username, email, password, confirmPassword }` (usuário `[a-z0-9_]{3,20}`; senha 8+ com maiúscula, número e símbolo) | `201 Session` | `422 VALIDATION_ERROR`; `409 EMAIL_TAKEN` / `USERNAME_TAKEN` com `fieldErrors` (comparação sem diferenciar maiúsculas) |
| `POST /auth/login` | `{ email, password }` | `200 Session` | `422`; `401 UNAUTHENTICATED` "E-mail ou senha inválidos" (mesma resposta para e-mail inexistente e senha errada) |
| `GET /auth/session` | Bearer | `200 Session` | `401 UNAUTHENTICATED` / `SESSION_EXPIRED` |
| `POST /auth/logout` | Bearer | `204` (idempotente, inclusive com token desconhecido) | — |

`Session = { token, expiresAt, user: { id, username, email, displayName, avatarUrl } }`. O token é opaco (32 bytes aleatórios). A validade é de 30 min, renovada a cada requisição autenticada válida.

### NFTs

| Método e caminho | Entrada | Saída | Erros |
|---|---|---|---|
| `GET /nfts` | query: `q`, `categories` (repetível), `networks` (repetível: `ethereum`/`polygon`/`solana`), `minPrice`, `maxPrice`, `tab` (`all`/`new`/`trending`), `sort` (`recent`/`price-asc`/`price-desc`/`name`), `page` ≥ 1, `pageSize` 1–48 (padrão 9) | `{ items: NftSummary[], page, pageSize, total, totalPages, facets: { categories[{id,label,count}], networks[{id,count}], priceRange{min,max} } }` | `422 VALIDATION_ERROR` |
| `GET /nfts/:id` | — | `NftDetail` (resumo + `description`, `longDescription`, `attributes`, `contractAddress`, `rating`, `reviewCount`, `editions[{ id, label: 1/1·1/10·1/50·ABERTA, available, maxPerOrder }]`, `gallery`, `reviews`) | `404 NOT_FOUND` |

`NftSummary` inclui `price` e `previousPrice` (strings ETH), `version` (versão do recurso, a mesma dos eventos), `network`, `category`, `collection`, `createdAt` e `trendingScore`. A busca ignora acentos e maiúsculas e procura em nome e coleção. Cada faceta é calculada sem o próprio grupo de filtro, então as contagens mostram o que cada opção traria.

### Favoritos

| Método e caminho | Entrada | Saída | Erros |
|---|---|---|---|
| `GET /favorites` | Bearer | `{ nftIds: string[], items: NftSummary[] }` (mais recentes primeiro) | `401` |
| `PUT /favorites/:nftId` | Bearer | `204` (idempotente) | `404 NOT_FOUND` |
| `DELETE /favorites/:nftId` | Bearer | `204` (idempotente) | — |

### Carrinho

Escopo: com `Authorization`, sempre o carrinho do usuário (um token inválido responde `401`, nunca cai no carrinho de visitante). Sem `Authorization`, o carrinho do visitante identificado por `X-Cart-Id` (UUID), criado no primeiro acesso. Toda mutation responde o **carrinho inteiro**.

| Método e caminho | Entrada | Saída | Erros |
|---|---|---|---|
| `GET /cart` | Bearer ou `X-Cart-Id` | `Cart = { id, owner{type: guest/user, id}, version, lines[{ lineId, nftId, editionId, quantity, nft: NftSummary, edition }] }` | `401`; `422` (`X-Cart-Id` inválido) |
| `POST /cart/items` | `{ nftId, editionId, quantity ≥ 1 }` (mesma edição soma na mesma linha) | `Cart` | `404`; `409 OUT_OF_STOCK` (`details.max`); `422` |
| `PATCH /cart/items/:lineId` | `{ quantity ≥ 1 }` (reduzir é sempre aceito; aumentar acima do limite não) | `Cart` | `404`; `409 OUT_OF_STOCK`; `422` |
| `DELETE /cart/items/:lineId` | — | `Cart` (idempotente) | — |
| `POST /cart/merge` | Bearer + `{ guestCartId }` | `{ cart, adjustments[{ lineId, nftId, name, requested, applied, reason: 'stock' }] }` (idempotente: o carrinho de visitante é apagado após o merge) | `401`; `422` |

Limite de uma linha: `min(available, maxPerOrder)` da edição.

### Cotação

| Método e caminho | Entrada | Saída | Erros |
|---|---|---|---|
| `POST /quote` | `{ coupon?, network }`, no escopo do carrinho (como acima) | `Quote = { quoteId, lines[{ lineId, nftId, editionId, unitPrice, quantity, lineTotal, available }], subtotal, discount, networkFee, total, coupon{code,percent}/null, network, expiresAt (+10 min), fingerprint }` | `422 COUPON_INVALID` / `COUPON_EXPIRED` (com `fieldErrors.coupon`); `422 VALIDATION_ERROR` |

Fórmula: `subtotal = Σ unitPrice × quantity`, `discount = percent% do subtotal`, `total = subtotal − discount + networkFee`. A cotação fica guardada na mock (últimas 20 por carrinho, as expiradas são descartadas). O `fingerprint` cobre só **valores** (linhas com preço e quantidade, cupom, rede e taxa). Disponibilidade fica de fora de propósito: estoque é checado à parte (`OUT_OF_STOCK`) e nunca aparece como "o valor mudou".

### Pedidos

| Método e caminho | Entrada | Saída | Erros |
|---|---|---|---|
| `POST /orders` | Bearer + cabeçalho `Idempotency-Key` (UUID) + `{ quoteId, connector: metamask/walletconnect/coinbase, walletId \| null, network, payer{ displayName, username, profileName, email, ensName?, referralCode, walletAddress, secondaryAddress? }, note? }` | `201 Order` (criado) / `200 Order` (mesma chave e mesmo payload: o pedido existente) | `422 VALIDATION_ERROR` (cabeçalho, corpo, carteira de outra rede ou de outro endereço, endereço inválido para a rede, carrinho vazio); `409 IDEMPOTENCY_CONFLICT`; `409 OUT_OF_STOCK` (`details.quote`, `details.lines`); `409 QUOTE_STALE` (`details.quote`); `422 COUPON_*` |
| `GET /orders/:orderId` | Bearer | `Order` (resolve antes se o `resolveAt` já venceu) | `404 NOT_FOUND`; `403 FORBIDDEN` (pedido de outra conta) |
| `GET /orders?status=` | Bearer, `status` opcional (`pending`/`confirmed`/`declined`) | `Order[]`, mais recentes primeiro | `422` |

`Order = { id, status: pending/confirmed/declined, version, createdAt, resolvedAt, declineReason, txHash, explorerUrl, idempotencyKey, snapshot{ lines[{ nftId, name, art, tokenNumber, editionId, editionLabel, unitPrice, quantity, lineTotal }], subtotal, discount, networkFee, total, walletLabel, connector, network } }`. O `snapshot` sai da cotação confirmada e nunca muda depois. O `idempotencyKey` só é visível para o dono. Ele permite ao cliente saber se a tentativa pendente dele foi a que criou o pedido. A UI não usa `GET /orders`; os testes o usam para contar pedidos.

### Perfil

| Método e caminho | Entrada | Saída | Erros |
|---|---|---|---|
| `GET /me` | Bearer | `Profile = { id, username, email, displayName, walletNickname, ensName, avatarUrl }` | `401` |
| `PATCH /me` | `{ displayName, username, email, walletNickname, ensName ('' ou nome .eth) }` | `Profile` | `422`; `409 EMAIL_TAKEN` / `USERNAME_TAKEN` |
| `PUT /me/avatar` | `{ dataUrl }` (`data:image/png\|jpeg\|webp;base64,…`, até 400 000 caracteres; o cliente recorta para 256×256 WebP) | `Profile` | `422` |
| `DELETE /me/avatar` | — | `Profile` | — |
| `POST /me/password` | `{ currentPassword, newPassword }` (a confirmação é só do cliente) | `204` | `422 INVALID_PASSWORD` (`fieldErrors.currentPassword`); `422 VALIDATION_ERROR` |

### Carteiras

| Método e caminho | Entrada | Saída | Erros |
|---|---|---|---|
| `GET /wallets` | Bearer | `{ primary: Wallet \| null, secondary: Wallet \| null }` | `401` |
| `PUT /wallets/primary`, `PUT /wallets/secondary` | `WalletInput = { displayName, nickname, network, profileName, address, secondaryAddress?, walletType, referralCode, email, ensName, sameAsPrimary }`, ou `{ sameAsPrimary: true }` só na secundária (copia a principal) | `201 Wallet` (slot vazio) / `200 Wallet` (edição) | `422 VALIDATION_ERROR` com `fieldErrors`: endereço inválido para a rede (EVM `0x` + 40 hex; Solana base58), ENS obrigatório só na Ethereum, "Cadastre a carteira principal primeiro" |
| `POST /wallets/:id/connect` | `:id` = id de carteira do usuário ou um conector (`metamask`, `walletconnect`, `coinbase`) para carteira digitada à mão | `{ connected: true, sessionId }` | `404 NOT_FOUND`; `409 WALLET_REJECTED` |

Uma secundária marcada "igual à principal" acompanha toda edição da principal.

### Controle da simulação (só com mocks)

| Método e caminho | Entrada | Saída |
|---|---|---|
| `POST /__mock/reset` | `{ scenario? }` | Restaura o seed (com o patch do cenário), ativa o cenário e zera latência e efeitos de "uma vez" |
| `POST /__mock/scenario` | `{ scenario, latencyOverride? }` | Troca cenário e latência **sem** reseed |
| `POST /__mock/emit` | `{ action, … }` (ver README) | Muta o banco simulado e emite pelo socket simulado; `501` para ação sem handler |
| `GET /__mock/ping` | — | Sonda dos testes que segue as falhas do cenário |

Essas rotas não passam por `withNetwork` (exceto o ping): falhas e latência de cenário nunca as afetam.

## Eventos Socket.IO

**Envelope** (`eventEnvelopeSchema`, `src/shared/contracts/events.ts`):

```json
{
  "eventId": "uuid",
  "type": "nft.updated",
  "resource": { "type": "nft", "id": "nft_042" },
  "version": 7,
  "occurredAt": "2026-11-12T10:00:00.000Z",
  "userId": null,
  "data": { "price": "1.29", "previousPrice": "1.19", "editions": [{ "id": "nft_042_e2", "available": 3 }] }
}
```

| Evento | Público | `data` | Efeito no cliente |
|---|---|---|---|
| `nft.updated` | todas as conexões, inclusive visitantes (`userId: null`) | `{ price, previousPrice, editions[{ id, available }] }` | Aplica preço e estoque nas cópias em cache mais antigas que o evento (detalhe, páginas de catálogo, carrinho, favoritos) e invalida `['quote']`. Se o NFT está no carrinho e o preço mudou, mostra o aviso (faixa em `/carrinho` e `/pagamento` + região viva; toast nas outras páginas). |
| `order.updated` | só a sala do dono | `{ status, order }` | Grava o pedido se a versão for maior; invalida carrinho, cotação, `['nft']` e `['nfts']`. Em estado terminal, encerra a tentativa pendente e o rascunho, se foi essa tentativa que criou o pedido. Anuncia o resultado (na página do pedido, ou por toast fora dela). |
| `wallet.disconnected` | só a sala do usuário | `{}` | No checkout, fecha a revisão, mantém o formulário e pede nova conexão. |
| `mock.whoami` | sonda de teste | `{ userId }` | Nenhum (só para os testes verificarem a sala). |

**Regras de entrega**

- **Origem única:** toda mudança simulada com evento passa por `src/mocks/realtime/commit.ts` (`commitNftUpdate`, `commitOrderUpdate`, `commitWalletDisconnect`). A função atualiza o banco (o mesmo que o REST lê), incrementa a versão do recurso e emite. REST e socket não divergem.
- **Versão por recurso:** um contador persistido em `resourceVersions` (`nft:<id>`, `order:<id>`, `wallet:<userId>`). Para NFTs, ele é espelhado no campo `version` do NFT, então uma resposta REST e um evento são comparáveis.
- **Salas:** a conexão começa como visitante e entra na sala do usuário quando chega o CONNECT com `auth.token` válido. Token vazio, inválido ou expirado fica como visitante (só eventos públicos). Logout, expiração (manual, por TTL ou do cenário) fecham os sockets do usuário no servidor (`disconnectUser`).
- **No cliente** (`src/features/realtime/`): o `RealtimeProvider` mantém um socket por sessão (visitante conecta com token vazio). Quando a sessão muda, o socket é destruído (`removeAllListeners` + `disconnect`) e outro é criado com o novo token. O hub valida o envelope com Zod e passa pelo `event-guard`:
  1. `eventId` já visto (LRU de 500) → descarta;
  2. `userId` diferente do usuário atual → descarta (segunda barreira além das salas);
  3. `version` ≤ última aplicada do mesmo recurso → descarta (nunca regride nem reaplica efeitos).

  Um handler que falha não impede os outros. Os listeners são registrados com `useRealtimeEvent` e saem quando o componente desmonta.

## Sessão

| Aspecto | Implementação |
|---|---|
| Armazenamento | `localStorage['kurio-session']` = `Session` (token opaco, não a senha), validado com Zod a cada leitura. Assinantes (`sessionStore.subscribe`) mantêm a query `['session']` e o socket em sincronia. |
| Envio | Interceptor do Axios: `Authorization: Bearer <token>`. O socket recebe o token **só** no `auth` do CONNECT, nunca na URL. |
| Validação | `GET /auth/session` (query `['session']`, `staleTime` 5 min). Sem token salvo, nenhuma requisição. Falha de rede mantém a sessão salva. `401` encerra a sessão. |
| Validade | No servidor simulado: 30 min, renovados a cada requisição autenticada. O cliente não confia em `expiresAt`: quem decide é o `401` da API. |
| Expiração | Qualquer `401` (`SESSION_EXPIRED`/`UNAUTHENTICATED`) numa requisição que levou token chama `endSession('expired')`: limpa o token, remove todas as queries `['user', …]`, grava `['session'] = null`, avisa os assinantes (o socket é recriado como visitante e os avisos de preço somem), salva a rota atual em `sessionStorage['kurio-resume']` e navega para `/entrar?redirect=…&reason=expired`. Vários `401` em paralelo redirecionam uma vez só. |
| Retomada | Depois do login, volta para o `redirect` (validado como caminho interno). O rascunho do checkout (`sessionStorage['kurio-checkout-draft:<userId>']`, sem segredos) é restaurado. |
| Logout | `POST /auth/logout` (melhor esforço: se a API falhar, a sessão local termina mesmo assim) → mesma limpeza da expiração, mas apaga a retomada e **todos** os rascunhos do checkout, e volta para `/`. |
| Troca de usuário | Login de outro usuário na mesma aba encerra a sessão anterior (`'switch'`) antes de gravar a nova: cache privado, rascunhos e socket do anterior saem antes de qualquer dado do novo. |
| Senhas | Só hash PBKDF2-SHA-256 (100 000 iterações) com salt. O seed hasheia `Kurio@2026` na inicialização com salt determinístico por usuário (seed reproduzível); o cadastro usa salt aleatório. |

## Carrinho

- **Visitante:** o cliente gera um UUID (`localStorage['kurio-guest-cart-id']`) e o envia em `X-Cart-Id` em toda requisição. O carrinho vive na API simulada, então sobrevive ao refresh. Query key `['guest-cart', guestId]`.
- **Usuário:** carrinho do servidor, `['user', userId, 'cart']`. A query só roda depois que a sessão salva foi verificada, para um token velho nunca chegar à API do carrinho antes do guard decidir.
- **Merge no login:** um hook de início de sessão chama `POST /cart/merge` uma vez por token. Quantidades da mesma edição são somadas e limitadas ao estoque; linhas que ficam em 0 saem. O resultado substitui o cache, o carrinho de visitante é descartado e o id é zerado. Ajustes aparecem num toast ("Carrinho ajustado ao estoque disponível": "Nome: 3 → 2", "Nome: esgotado, removido"). Se o merge falhar, o id do visitante é mantido para uma tentativa no próximo login.
- **Mutations:** adicionar substitui o cache pela resposta. Alterar quantidade é otimista: as mudanças de uma linha rodam em ordem, a falha desfaz só aquela linha (com o motivo, por exemplo "Apenas 2 disponíveis") e a revalidação acontece quando a última mutation de carrinho termina. Remover substitui o cache pela resposta.
- **Cotação:** o resumo vem sempre de `POST /quote`. Nenhum valor monetário é calculado na UI. A versão do carrinho entra na chave da cotação, e a cotação anterior fica na tela enquanto a nova carrega. O carrinho é cotado na rede Ethereum; o checkout cota na rede escolhida.
- **Avisos:** mudança de preço via socket → faixa dispensável ("O preço de X mudou de A para B ETH") em `/carrinho` e `/pagamento`, falada pela região viva da aplicação. Estoque abaixo da quantidade → a linha mostra "Apenas N disponíveis" ou "Esgotado", e o checkout fica bloqueado com a explicação associada ao botão.
- **Depois da compra:** no `confirmed`, a mock subtrai do carrinho **só as quantidades compradas** e o estoque das edições (emitindo `nft.updated`). No `declined`, nada muda.

## Estratégia de cache

Padrões (`src/app/query-client.ts`): `staleTime` 30 s, `gcTime` 5 min, sem refetch no foco, retry só para erro transitório (até 2 novas tentativas, 500 ms e 1 s), mutations sem retry. A tabela completa por dado está no [README](README.md#política-de-cache-retry-e-sincronização).

- **Isolamento por escopo:** toda chave privada começa com `['user', userId]`, e o logout remove o prefixo `['user']` inteiro. Chaves públicas: `['nfts', params]` e `['nft', id]`. Visitante: `['guest-cart', id]`. Cotação: `['quote', 'user:<id>' | 'guest:<id>', { coupon, network, version }]`.
- **Respostas obsoletas:** o `signal` do TanStack Query vai até o Axios. Cada combinação de parâmetros tem a própria chave, então uma resposta atrasada de outra busca nunca ocupa a tela. Catálogo e cotação usam `keepPreviousData` para não piscar.
- **Atualização otimista com rollback:** favoritos (snapshot em `onMutate`; o erro desfaz só a mudança que falhou; revalida quando o último toggle termina) e quantidade no carrinho (rollback da linha em `409 OUT_OF_STOCK` ou falha).
- **Dados sensíveis a tempo:** carrinho, cotação e pedido têm `staleTime` 0. Carrinho e pedido refazem a busca no foco. Um pedido pendente com o socket fora do ar é relido a cada 5 s, então não depende da reconexão.
- **Estados:** catálogo, detalhe, resumo do carrinho, pedido e páginas de perfil têm skeleton (com as dimensões finais), vazio, erro com "Tentar novamente" (`refetch`) e indicação de atualização em segundo plano.

## Reconciliação REST × Socket.IO

- **REST é a fonte de verdade.** Eventos são atalhos para não esperar o próximo refetch. Um evento só altera uma cópia em cache **mais antiga** que ele (`nft.version < event.version`; pedido com `version` menor).
- **Requisição em voo:** se chega um `nft.updated` enquanto uma busca do mesmo NFT, do catálogo, do carrinho ou dos favoritos está em andamento, ela é cancelada antes do patch e marcada como obsoleta. Os dados de antes do evento não sobrescrevem o patch, e as telas ativas buscam o estado posterior.
- **Reconexão:** no `reconnect` do Manager, o cliente invalida catálogo, detalhe, cotação, carrinho, favoritos e pedidos. Eventos perdidos durante a queda são recuperados pelo REST, e nenhum aviso de mudança é inventado.
- **Pedido pendente:** o id fica em `localStorage['kurio-pending-order:<userId>']`. Uma recarga, reconexão ou visita posterior relê `GET /orders/:id`, que resolve o pedido se o prazo já venceu. Uma faixa global avisa "Você tem um pedido em processamento" até o pedido terminar.
- **Sessões diferentes:** salas por usuário no servidor, descarte por `userId` no cliente, troca de socket a cada mudança de sessão e remoção do cache privado. Um evento da sessão anterior não atinge os dados do novo usuário (coberto em `10-realtime-resilience`).

## Camada de mocks (MSW)

```
src/mocks/
  browser.ts          startMocks(): lê ?scenario/?reset, carrega o banco, registra ações e sobe o worker
  config.ts           cenário ativo + latência (sessionStorage, por aba)
  scenarios.ts        14 cenários: latência, falhas por rota, patch de seed, flags
  network.ts          withNetwork(): latência com PRNG de seed, falhas de rede/timeout/HTTP por rota
  db/                 seed determinístico, store (localStorage 'kurio-mock-db:v1'), PBKDF2
  fixtures/           NFTs (60), avaliações, usuários, carteiras, favoritos, carrinho, cupons
  handlers/           auth, nfts, favorites, cart, quote, orders, profile, wallets, mock-control
  pricing.ts          cotação pura (subtotal, desconto, taxa, total, fingerprint)
  realtime/           servidor Socket.IO simulado, commit(), agendador de pedidos, ações do /emit
```

- **Transporte REST:** Service Worker do MSW 2.15 (`public/mockServiceWorker.js`), com `onUnhandledRequest: 'bypass'` para assets. A aplicação só monta depois que o worker controla a página. O atributo `data-mocks="ready"` no `<html>` marca esse momento para os testes: antes do `MOCK_ACTIVATE`, o worker já pode controlar a página mas ainda deixa passar as requisições.
- **Transporte Socket.IO:** `ws.link()` do MSW + `@mswjs/socket.io-binding` 0.2.0. A interceptação do `WebSocket` roda **na thread principal**, não no Service Worker.
- **Persistência e reset:** o banco é salvo em `localStorage` a cada mutation e sustenta o refresh. O reset recria o seed e aplica o patch do cenário. Os efeitos de "uma vez" (`price-change`, `sold-out`, `order-timeout`) ficam em memória e são zerados no reset.
- **Determinismo:** seed fixo (data de referência `2026-11-01`, PRNG com seed). A latência de cada cenário segue uma sequência com seed própria, reiniciada a cada ativação.
- **Agendador de pedidos:** um pedido nasce `pending` com `resolveAt` persistido (2,5 s; 60 s no `order-timeout`). Ele é resolvido por timer, no boot da mock e em todo `GET /orders…` com prazo vencido. Só pedidos `pending` são resolvidos, então estoque e carrinho mudam uma vez só.

### Resultados do spike e limitações do binding

Validado em `tests/e2e/realtime-spike.spec.ts` (projeto `spike`, contra `npm run dev`).

| Ponto | Resultado | Como a solução lida |
|---|---|---|
| Versões | `socket.io-client` 4.8.4 (EIO 4) e o binding 0.2.0 compartilham `socket.io-parser` e `engine.io-parser` | Compatível. MSW fixado em 2.15 porque o peer do binding é `msw@^2` |
| Autenticação | A API do binding não expõe o pacote CONNECT (responde sozinho `40{"sid":"test"}`) | A mock lê o frame bruto `40{"token":"…"}` da conexão (`readConnectToken`) e só então põe a conexão na sala do usuário. O token vai **só** no `auth`, nunca na query da URL |
| Ping/pong | O handshake anuncia `pingInterval` 25 s / `pingTimeout` 5 s, mas o binding nunca envia ping (sem ping, o cliente cai a cada ~30 s) | O servidor simulado envia o ping Engine.IO (`"2"`) a cada 25 s por conexão |
| Queda e reconexão | `close()` do servidor dispara a reconexão do cliente (backoff 500 ms a 3 s) | `socket:drop` fecha tudo e recusa novas conexões (`error` + `close`, para o cliente emitir `connect_error` e continuar tentando) até `socket:restore` |
| Transporte | Só `websocket`; long-polling não é interceptado | `transports: ['websocket']` no cliente |
| Escopo | Um servidor simulado **por aba** | O banco é compartilhado entre abas via `localStorage`, mas um evento emitido numa aba não chega às outras |
| Salas | O binding não tem salas | Mapa `userId → conexões` na mock (`server.ts`) |
| Replay | Os envelopes para `event:replay` ficam em memória (últimos 200) | Depois de um reload, um `eventId` antigo responde `404` |

O cenário `offline` só afeta o REST. Para o socket, use `socket:drop` ("Derrubar conexão").

## Pedidos e idempotência

Fluxo do checkout: "Confirmar compra" (valida o formulário e exige uma cotação da rede escolhida) → conexão simulada da carteira (`POST /wallets/:id/connect`) → revisão com a cotação → "Enviar pedido" (`POST /orders`) → `/pedidos/<id>` pendente → `order.updated` → recibo ou recusa.

- **Chave:** ao enviar, o cliente cria uma **tentativa** `{ key: UUID, payloadHash, payload, meta }` e a grava em `sessionStorage['kurio-order-attempt:<userId>']` **antes** da requisição.
- **Resposta incerta** (timeout de 10 s, rede, 5xx): a tentativa fica guardada. A mutation reenvia uma vez, sozinha e imediatamente, com a mesma chave. Depois disso, "Verificar pedido", fechar o diálogo, um novo "Enviar pedido", outra cotação ou uma recarga **reenviam exatamente o payload guardado com a mesma chave**. Assim, um pedido de resultado desconhecido nunca é comprado de novo com chave nova.
- **Resposta definitiva:** sucesso (o pedido) ou recusa 4xx apagam a tentativa. Se o servidor recusar o replay (por exemplo `QUOTE_STALE`), a revisão recomeça com os dados atuais e uma nova aprovação da carteira.
- **Servidor:** mesma chave + mesmo hash do payload → o mesmo pedido (`200`), mesmo que os preços tenham mudado. Mesma chave + payload diferente → `409 IDEMPOTENCY_CONFLICT`. Revalida carteira, endereços, estoque (`OUT_OF_STOCK`) e cotação (`QUOTE_STALE` se a cotação expirou ou se o fingerprint de valores, a rede ou a taxa mudaram).
- **Mudança de valor:** `QUOTE_STALE` abre "O valor do pedido mudou" com antes/agora por item e total; nada é enviado até "Confirmar novo valor". Se só a cotação foi renovada (expirou) com os mesmos valores, o cliente reenvia sem perguntar.
- **Cliques repetidos:** uma trava síncrona (`ref`) impede um segundo envio no mesmo frame. "Enviar pedido" fica `aria-disabled` enquanto o pedido está em voo.
- **Recibo:** só existe para `confirmed` e é renderizado exclusivamente a partir do `snapshot`. Pendente e recusado têm telas próprias. Hash e link de explorador são simulados.

## Acessibilidade

Ajustes em relação ao layout (o Figma não desenha estados de foco, erro nem leitores de tela):

| Ajuste | Onde |
|---|---|
| Anel de foco global `:focus-visible` (2 px na cor primária, com offset) em todo elemento focável; removidos os `outline-none` que o escondiam (abas, inputs, cupom) | `globals.css` e componentes |
| Labels reais em todos os campos. No login e no cadastro, o Figma usa só placeholder: os labels existem, ocultos visualmente | `AuthField` |
| Campos obrigatórios com `aria-required` e "(obrigatório)" no label | formulários |
| Erros por campo com `aria-invalid` + `aria-describedby`; o foco vai para o primeiro campo inválido | formulários |
| Opções de filtro são `role="checkbox"` com `aria-checked` e ícone de check (não só cor) | `FilterSidebar` |
| Edição esgotada diz "Esgotada" e fica `aria-disabled` (continua focável) | `EditionPicker` |
| Aba ativa da tab bar mobile ganha um ponto, além da cor | `MobileTabBar` |
| Diálogos e drawers prendem o foco e o devolvem ao elemento que os abriu (inclusive no diálogo de login, que é uma rota sem trigger); botão de fechar "Fechar" | `dialog.tsx`, `sheet.tsx`, `AuthDialog` |
| "Enviar pedido" usa `aria-disabled` em vez de `disabled`, para o foco não se perder dentro do diálogo | `ReviewDialog` |
| Regiões vivas: total de resultados do catálogo, mudanças de preço, resultado de mutations, estado da conexão ("Reconectando…" / "Conexão restabelecida") e resultado do pedido; toasts via sonner | `LiveRegion`, `ConnectionStatus` |
| Shimmer e spinners param com `prefers-reduced-motion` | `globals.css` |
| Hero sem autoplay, pontos com `aria-label="Slide N de 3"` e `aria-current` | `Hero` |
| Link do explorador com "(simulação, abre em nova aba)" para leitor de tela | `OrderReceipt` |
| Lista de redes sociais do rodapé quebra linha, para não ter overflow com zoom de 200% | `Footer` |
| Faixa de tentativa pendente no checkout é uma região nomeada, anunciada uma vez | `CheckoutPage` |

As cores do Figma passam em contraste ≥ 4,5:1 nos pares de texto pequeno (`src/shared/ui/contrast.test.ts`), então nenhuma cor foi alterada. `11-a11y-keyboard` roda axe (WCAG 2.0/2.1 A e AA, sem regras desligadas) em todas as telas e na revisão do pedido, a compra completa só por teclado e o reflow com zoom de 200%.

## Desvios do Figma

| Área | Figma | Implementado | Motivo |
|---|---|---|---|
| Viewport mobile | frames de 414 px | avaliado e com baselines em 390 px (também 768 e 1440) | §8 do enunciado pede 390 |
| Telas sem frame | perfil, carteiras e confirmação sem mobile; nenhum frame tablet | coluna única no mobile, mesmos componentes; tablet entre os layouts (filtros em drawer abaixo de 1024 px, login como diálogo a partir de 768 px) | §3 pede que funcionem em mobile |
| Tipografia | `Title/20` com line-height 16 | `leading-6` | o original sobrepõe linhas em títulos que quebram |
| Ícones | Iconly | `lucide-react`; LinkedIn/YouTube como traços inline; "Entrar" usa `LogIn` | o pacote do Figma não está disponível; lucide 1.x não tem ícones de marca |
| Início mobile | barra de busca no lugar do cabeçalho | cabeçalho compacto (logo, busca, Entrar) em todas as páginas | navegação consistente |
| Badge do carrinho | mostra "6" (dado de exemplo) | oculto quando o carrinho está vazio | |
| Hero | só o slide 1 desenhado | slides 2 e 3 reutilizam o texto das promoções | conteúdo não existe no Figma |
| Destaque | NFT fixo | escolha editorial fixa (`nft_009`, o desenhado), lida da API | |
| Contagens dos filtros | números estáticos | calculadas pela API a partir das fixtures, por faceta | contagens coerentes com os filtros |
| "Mais desta coleção", "Colecionadores também viram" | carrossel com pontos | linha de 5 cards (desktop) / rolagem com snap (mobile), sem pontos | |
| Carrinho | só o número do token na linha | "Edição: 1/50" sob o token; linha do cupom aplicado com "Remover" | linhas diferem por edição; remover cupom é requisito |
| Carrinho mobile | sem cabeçalho nem tab bar | mantém cabeçalho e tab bar | o carrinho continua alcançável |
| Pagamento desktop | conectores com uma linha de selos; sem carteiras cadastradas | linhas das carteiras cadastradas ao lado de "Usar outra carteira?"; 3 linhas de conector | §3 pede usar as carteiras cadastradas (inclusive a secundária) |
| Pagamento mobile | sem formulário | campos do colecionador num bloco expansível "Dados do colecionador" (abre sozinho para carteira manual e em erros) | §3 pede validar os campos também no mobile |
| Perfil | um "Salvar" no fim da página; asteriscos em ENS e apelido | "Salvar" logo após os dados; senha em formulário separado; ENS e apelido opcionais (Bruno começa sem eles) | senha tem fluxo e erros próprios |
| Seletor ".eth" | dropdown | `<select>` nativo com uma opção (`.eth`) | só existe esse sufixo; o valor salvo é `nome.eth` |
| Carteiras | formulário aberto | estado vazio com "Adicionar" que revela o formulário; ENS obrigatório só na Ethereum | ENS não existe nas outras redes |
| Rede e ENS | — | rede é um enum (`ethereum`/`polygon`/`solana`); endereços validados só pelo formato; sem resolução de ENS | sem blockchain real (fora do escopo) |
| Recibo | link "Ver no Etherscan"; coluna Carteira com "MetaMask" | mesmo rótulo, mas o link aponta para `explorer.kurio.example/testnet` (fictício); Carteira mostra o conector e, abaixo, o rótulo da carteira; linha de desconto só quando há desconto | um Etherscan real com hash inventado pareceria um erro real |
| Tab bar mobile | cor e preenchimento no item ativo | mais um ponto no item ativo | estado não depende só de cor |
| Estados não desenhados | — | skeletons, vazios, erros, pílula de conexão, faixa de pedido pendente, 404, `/em-breve`, painel "Simulação" | seguem os tokens e componentes do Figma |

## Decisões de UX

- **Login e cadastro:** diálogo sobre a Início a partir de 768 px e página cheia no mobile, como nos frames. Fechar o diálogo volta ao `redirect` quando ele é público e a `/` quando é privado (voltar a uma rota privada reabriria o login).
- **Fora do escopo** (Criadores, Aprenda, Diário, Ofertas, Atividade, Downloads, Suporte) leva a `/em-breve`. Login social e "esqueci a senha" dizem "Indisponível nesta demonstração". Nada finge sucesso.
- **"Listados recentemente"** segue a ordem de listagem do banco (os NFTs do Figma primeiro). A data de mint (`createdAt`) define a aba "Novos lançamentos".
- **Favoritar sem login** leva a `/entrar` e volta ao NFT.
- **COMPRAR** adiciona ao carrinho e abre `/carrinho`. O limite por pedido aparece como "Máximo de N por pedido", e a quantidade já no carrinho conta para esse limite.
- **Avisos de preço:** faixa dispensável no carrinho e no pagamento (anunciada uma vez pela região viva); toast nas outras páginas. A pílula "Reconectando…" só aparece se a queda durar mais de 1,5 s.
- **Resultado do pedido:** a página do pedido anuncia o resultado; fora dela, um toast. Pedido de outra conta aparece como "Pedido não encontrado", igual a um ID inexistente.
- **Checkout:** a revisão mostra exatamente o que será enviado. Uma tentativa sem resposta é retomada antes de qualquer compra nova, com a faixa "Um pedido anterior ficou sem confirmação (…)" e "Verificar pedido".

## Limitações

- **Custos da simulação no build de demonstração:** chunk do MSW (cerca de 180 KB gzip), espera pelo Service Worker antes do primeiro render e latência proposital. Isso derruba a Performance mobile do Lighthouse (ver [`lighthouse/summary.md`](lighthouse/summary.md)). O build sem mocks (`npm run build`) não carrega nada disso.
- **Build sem mocks e sem backend:** `npm run build` é a versão para uma API real. Servido sozinho, as chamadas `/api` falham e o `socket.io-client` tenta reconectar indefinidamente (a pílula mostra "Reconectando…" e o console registra erros). O deploy usa o build de demonstração.
- **Socket simulado por aba**, só transporte websocket, replays em memória (ver tabela do spike). O cenário ativo também é por aba.
- **Tentativa de pedido sobrevive ao logout na mesma aba:** a tentativa sem resposta (payload com os dados do pagador, sem senha) fica em `sessionStorage` por usuário até uma resposta definitiva ou até a aba fechar. É uma escolha deliberada a favor de nunca duplicar uma compra. Em dispositivo compartilhado, feche a aba depois do logout.
- **`INVALID_RESPONSE` num 2xx de `POST /orders`** mantém a tentativa guardada (a resposta não prova nada), então a aba só reenvia aquela tentativa até ser fechada. A simulação não gera esse caso.
- **Sem `sessionStorage`** (modo restrito do navegador), a proteção contra duplicidade vale só enquanto o diálogo do checkout está aberto.
- **Troca de senha** não encerra as outras sessões do mesmo usuário.
- **Avatar no Safari:** o canvas do Safari não gera WebP, então o avatar é enviado como PNG (maior, ainda dentro do limite).
- **Sessão no cliente:** `/entrar` confia na sessão em cache por até 5 min antes de revalidar, e o cliente não atualiza o `expiresAt` salvo. A expiração real é sempre decidida pelo `401` da API.
- **Pedido "sem resposta"** (`order-timeout`): o abort do cliente nem sempre chega ao handler através do Service Worker, então a mock fecha a requisição pendurada em até 15 s.
- **Mensagens da API** para pedido de outra conta (`403`) revelam que o pedido existe. A UI trata `403` e `404` da mesma forma.
- **Baselines visuais** dependem do sistema e da imagem do runner (`ubuntu-26.04` no CI). Mudanças de UI ou de imagem exigem regenerá-las (ver README).
- **Blockchain, carteiras e pagamentos** são simulados: `txHash` aleatório, explorador fictício, aprovação de carteira simulada.
