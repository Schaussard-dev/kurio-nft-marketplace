# Kurio — NFT Marketplace (Desafio Frontend Jungle Gaming) — Design

> Fonte de verdade dos requisitos: README de `github.com/junglegaming/frontend-challenge` (seções §1–§12 citadas abaixo).
> Fonte de verdade visual: arquivo Figma `Ff0SksUi7UFtPWUO8kyNtw` ("Marketplace de NFTs GreenMint"), lido via API.
> Prazo: 2 dias a partir de 2026-11-11. Entrega: repositório público + URL pública (Vercel).
> Itens marcados **[decisão do Claude]** foram escolhas técnicas minhas, não do usuário.

## 1. Intenção

Entregar uma solução que pontue no máximo em todos os critérios da §11, sem nenhum item eliminatório. O usuário quer "arrasar": nada de atalhos, cada requisito do README deve ser rastreável a uma implementação, um teste ou um trecho de documentação.

### Objetivos
- Fidelidade visual ao Figma (tokens exatos extraídos via API) em 390 / 768 / 1440 px.
- Fluxos reais de ponta a ponta: o estado vive na API simulada (MSW) e nada é "só visual".
- Tempo real via `socket.io-client` contra MSW (`@mswjs/socket.io-binding`).
- 12 grupos de testes Playwright + regressão visual + Lighthouse (3 execuções, mediana).
- Execução reproduzível a partir de checkout limpo; deploy na Vercel com mocks ativos.

### Não-objetivos
- Blockchain, extensões de carteira, gateways de pagamento ou backend reais (§1).
- Páginas editoriais, suporte, atividade, ofertas e downloads (§3).

### Anti-objetivos (falharia mesmo "funcionando")
- Qualquer resposta fictícia ou caminho de negócio alternativo em componentes, hooks ou no cliente Axios (§6).
- Eventos de tempo real disparados direto na UI, em setters ou no cache (§6, §11).
- Pedido confirmado sem resposta da simulação; dados de um usuário aparecendo para outro (§11).
- Ação fora do escopo que aparenta sucesso (§3), por exemplo uma newsletter que diz "inscrito".
- Simplificações exclusivas para subir a nota do Lighthouse (§10).

## 2. Stack

| Responsabilidade | Escolha |
|---|---|
| Build | Vite + React 19 + TypeScript `strict` **[decisão do Claude]** |
| Pacotes | npm (pnpm não está instalado) **[decisão do Claude]** |
| Roteamento | TanStack Router, rotas por arquivo (plugin Vite), `validateSearch` com Zod |
| Estado remoto | TanStack Query v5 |
| HTTP | Axios (instância única; interceptors de auth e normalização de erro) |
| Tempo real | `socket.io-client` com `transports: ['websocket']` |
| Estilo | Tailwind CSS v4 com tokens do Figma em `@theme` |
| Componentes | shadcn/ui (Radix), restilizado com os tokens |
| Formulários | react-hook-form + Zod (schemas compartilhados com os contratos) **[decisão do Claude]** |
| Decimais | `big.js` para todo cálculo ETH **[decisão do Claude]** |
| Mocks | MSW v2 (`http` + `ws`) + `@mswjs/socket.io-binding` |
| Testes | Playwright (Chromium) |
| Auditoria | Lighthouse (API Node) num script versionado |
| Fonte | Roboto Mono 400/500/700, self-hosted via `@fontsource` (funciona offline) |
| Deploy | Vercel (SPA rewrite para `index.html`) |

## 3. Identidade visual (extraída do Figma)

**Cores** (estilos nomeados do arquivo, viram tokens CSS):
- `ink #140D0A`: fundo da página
- `surface #241612`: cards e painéis
- `surface-2 #2F1D15`
- `band #38220F`: faixa de contato do rodapé
- `primary #D28A4C`
- `text-accent #E89B55`
- `text-secondary #CFB28C`
- `muted #B39463`
- `foreground #F5F1EB`
- bordas `#3F2319` / `#55321F`
- `danger #F0805F` (asteriscos e erros)

O contraste de cada par texto/fundo será verificado. Se algum par usado em texto pequeno ficar abaixo de 4.5:1, ajusto o tom e registro o desvio no `ARCHITECTURE.md` (§8).

**Tipografia:** Roboto Mono em toda a interface. Os estilos de texto nomeados no Figma (`Display/43 Bold lh70`, `Heading`, `Title`, `Body Large/16–18`, `Body/14–15`, `Caption`, `Tiny/10 Medium`) viram utilitários Tailwind com os mesmos tamanhos, pesos, alturas de linha e espaçamento entre letras. Os valores exatos saem de um script que lê o JSON do Figma (`scripts/figma-tokens.mjs`); o token de acesso fica só no `.env.local` e nunca é versionado.

**Raios e bordas:** seguir os valores de cada nó (o Figma mistura 3–6 px em inputs e botões, 16–40 px no mobile).

**Assets:** as 4 artes originais (1254×1254) mais 2 imagens auxiliares, baixadas da API do Figma. Um script `scripts/optimize-images.mjs` (sharp) gera AVIF/WebP em 3 larguras, versionadas em `public/nfts/`. Ícones e o envelope "THANK YOU" da confirmação são exportados como SVG do Figma. Ícones genéricos (busca, carrinho, coração, lixeira) usam lucide-react quando forem idênticos; caso contrário, uso o SVG do Figma.

**Frames:**
- Desktop 1440: Início, Detalhes, Carrinho, Pagamento, Confirmação, Login, Cadastro, Perfil, Carteiras.
- Mobile 414: Início, Detalhes, Carrinho, Pagamento, Login, Cadastro.
- Perfil, Carteiras e Confirmação no mobile, e todas as telas em 768, são adaptações no mesmo padrão visual (§3), documentadas no `ARCHITECTURE.md`.

## 4. Rotas (TanStack Router)

| Rota | Tela | Acesso |
|---|---|---|
| `/` | Início: hero, catálogo, destaque, promos, diário, rodapé | público |
| `/nft/$nftId` | Detalhes do NFT | público |
| `/carrinho` | Carrinho | público (carrinho de visitante) |
| `/pagamento` | Pagamento | autenticado |
| `/pedidos/$orderId` | Pedido: pendente / recusado / recibo confirmado | autenticado e dono |
| `/entrar` | Login | só visitante |
| `/cadastro` | Cadastro | só visitante |
| `/perfil` | Dados do perfil, avatar, senha | autenticado |
| `/perfil/carteiras` | Carteiras principal e secundária | autenticado |
| `/perfil/favoritos` | Lista de interesse (favoritos) | autenticado |
| `/em-breve` | Página honesta para itens fora do escopo | público |
| `*` | 404 no padrão visual | público |

- **Login e Cadastro no desktop:** o Figma mostra um diálogo sobre a Início. A rota `/entrar` renderiza a Início ao fundo com o `Dialog` aberto (foco preso, Esc fecha e navega para `redirect` ou `/`). No mobile (< 768) é página cheia, como no frame mobile. As abas "Entrar | Criar conta" do diálogo navegam entre `/entrar` e `/cadastro`.
- **Proteção:** `beforeLoad` nas rotas privadas verifica a sessão (via `queryClient.ensureQueryData(sessionQuery)`). Sem sessão, faz `redirect({ to: '/entrar', search: { redirect: location.href } })`. Após o login, volta ao `redirect`, sempre validado como caminho interno para evitar open redirect.
- **"Mercado"** no menu leva a `/` com âncora no catálogo e fica ativo em Detalhe, Carrinho e Pagamento, como no Figma. **"Criadores", "Aprenda", "Diário da Cunhagem", "Ofertas", "Atividade", "Arquivos baixados" e "Suporte"** levam a `/em-breve`. **[decisão do Claude]**

**Search params do catálogo** (`/`), validados com Zod e com defaults omitidos da URL:
- `q`: string
- `categories`: string[] (Coleções)
- `networks`: (`ethereum|polygon|solana`)[]
- `minPrice`, `maxPrice`: strings decimais
- `tab`: `all|new|trending`
- `sort`: `recent|price-asc|price-desc|name`
- `page`: int ≥ 1

Qualquer mudança de filtro, busca, aba ou ordenação zera `page` (§3). Busca com debounce de 300 ms e `replace` no histórico enquanto digita. Filtros e páginas usam `push`, para o voltar/avançar restaurarem o estado.

## 5. Contratos REST

Todos os contratos são schemas Zod em `src/shared/contracts/`, importados pelo cliente **e** pelos handlers MSW. Os tipos TypeScript são derivados com `z.infer`. Base: `/api`. Os valores ETH trafegam como **strings decimais** (`"1.19"`) e as quantidades como inteiros.

**Envelope de erro:**
```json
{ "error": { "code": "...", "message": "...", "fieldErrors": { "email": ["..."] }, "details": {} } }
```

| HTTP | `code` | Uso |
|---|---|---|
| 400/422 | `VALIDATION_ERROR` | campos inválidos (`fieldErrors`) |
| 401 | `UNAUTHENTICATED` / `SESSION_EXPIRED` | sem token ou token expirado |
| 403 | `FORBIDDEN` | recurso de outro usuário |
| 404 | `NOT_FOUND` | NFT, pedido ou rota de API inexistente |
| 409 | `EMAIL_TAKEN`, `USERNAME_TAKEN`, `OUT_OF_STOCK`, `QUOTE_STALE`, `IDEMPOTENCY_CONFLICT` | conflitos |
| 422 | `COUPON_INVALID`, `COUPON_EXPIRED`, `INVALID_PASSWORD` | regras de negócio |
| 503 | `TRANSIENT` | falha transitória (pode repetir) |

**Endpoints:**

| Recurso | Endpoints |
|---|---|
| Sessão | `POST /auth/register`, `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` |
| NFTs | `GET /nfts?q&categories&networks&minPrice&maxPrice&tab&sort&page&pageSize` → `{ items, page, pageSize, total, totalPages, facets }`; `GET /nfts/:id` → detalhe com `editions[]` (`id`, `label` 1/1, 1/10, 1/50, ABERTA, `available`, `maxPerOrder`), `version` e `reviews` |
| Favoritos | `GET /favorites`, `PUT /favorites/:nftId`, `DELETE /favorites/:nftId` |
| Carrinho | `GET /cart`, `POST /cart/items` `{nftId, editionId, quantity}`, `PATCH /cart/items/:lineId` `{quantity}`, `DELETE /cart/items/:lineId`, `POST /cart/merge` `{guestCartId}` |
| Cotação | `POST /quote` `{coupon?, network}` → `{ quoteId, lines[{lineId, unitPrice, quantity, lineTotal, available}], subtotal, discount, networkFee, total, coupon, expiresAt, fingerprint }` |
| Pedidos | `POST /orders` (header `Idempotency-Key`) `{quoteId, walletId, network, payer:{...}, note?}`; `GET /orders/:id`; `GET /orders?status=pending` |
| Perfil | `GET /me`, `PATCH /me`, `PUT /me/avatar` `{dataUrl}`, `DELETE /me/avatar`, `POST /me/password` `{currentPassword, newPassword}` |
| Carteiras | `GET /wallets` → `{ primary: Wallet \| null, secondary: Wallet \| null }`; `PUT /wallets/primary` e `PUT /wallets/secondary` são upsert (cadastro quando o slot está vazio → 201; edição quando existe → 200); `POST /wallets/:id/connect` (simula aprovação ou recusa) |
| Mock (só com mocks ativos) | `POST /__mock/reset`, `POST /__mock/scenario`, `POST /__mock/emit` (usado pelo painel e pelos testes; muta o banco simulado e emite pelo socket) |

**Carrinho de visitante:** o cliente gera um `guestCartId` (UUID em `localStorage`) e envia no header `X-Cart-Id`. O carrinho do visitante também vive na API simulada, então persiste no refresh. No login, o cliente chama `POST /cart/merge`: as quantidades são somadas e limitadas à disponibilidade, e a resposta informa os ajustes, que a UI mostra num aviso (§3 "preservar os itens do visitante ao autenticar").

**Cotação e confirmação:** a cotação é a referência para finalizar o pedido (§3). `POST /orders` revalida preço, disponibilidade, cupom e taxa. Se algo mudou desde `quoteId`, responde `409 QUOTE_STALE` com a nova cotação, e a UI mostra as diferenças e exige uma nova confirmação explícita (§3, §7).

**Idempotência:** o `Idempotency-Key` (UUID) é gerado quando o usuário inicia a tentativa de compra e guardado em `sessionStorage` junto com o hash do payload. A mesma chave com o mesmo payload devolve o mesmo pedido (200). A mesma chave com payload diferente devolve `409 IDEMPOTENCY_CONFLICT`. Um timeout no cliente reenvia com a **mesma** chave. O botão é desabilitado enquanto a mutation está pendente, contra cliques repetidos.

**Pedido:**
- Campos: `id`, `status` (`pending|confirmed|declined`), `version`, `createdAt`, `txHash` simulado, `explorerUrl` simulado e `snapshot` imutável (linhas com nome, imagem, edição, preço unitário, quantidade, subtotal, desconto, taxa, total, carteira e rede).
- Ciclo: o pedido nasce `pending` com um `resolveAt` persistido no banco da mock. Um agendador da mock resolve para `confirmed` ou `declined` quando o horário chega e emite `order.updated`. No boot da mock e em todo `GET /orders/:id`, pedidos com `resolveAt` vencido são resolvidos de forma preguiçosa, e os ainda não vencidos são reagendados. Assim o pedido se resolve mesmo após um reload no meio da espera (§7). Os estados `confirmed` e `declined` são terminais.
- No `confirmed`, a mock remove do carrinho **só as quantidades compradas** e decrementa o estoque, o que emite `nft.updated`. No `declined`, nada muda no carrinho.

**Senhas:** a mock guarda apenas um hash PBKDF2 (Web Crypto) com salt. Nada fica em claro, nem no seed: as senhas fictícias são hasheadas na inicialização.

## 6. Mocks (MSW)

```
src/mocks/
  browser.ts            # setupWorker(http handlers + socket.io binding)
  db/                   # banco em memória + persistência em localStorage ("kurio-mock-db:v1")
  fixtures/             # seed determinístico: 48+ NFTs, 9 coleções, 3 redes, edições, reviews, 2+ usuários
  handlers/             # auth, nfts, favorites, cart, quote, orders, profile, wallets, __mock
  realtime/             # servidor Socket.IO simulado (salas por usuário, versão por recurso)
  scenarios/            # definição dos cenários
  network.ts            # latência, latência variável, timeout, offline, erro HTTP por rota
```

- **Ativação:** `VITE_ENABLE_MOCKS=true`, padrão em dev e no build de demonstração. `main.tsx` faz `await import('./mocks/browser')` antes de renderizar, só quando a flag está ativa. Componentes, hooks e Axios não sabem que a API é simulada (§6).
- **Persistência:** o estado da mock é salvo em `localStorage`, o que sustenta o refresh. `?reset=1` ou o painel restauram integralmente o seed do cenário (§6).
- **Seleção de cenário:** pelo query param `?scenario=<nome>` (persistido em `sessionStorage`) e por um **painel de mock** flutuante, visível só com mocks ativos. O painel permite escolher o cenário, ajustar latência, ficar offline, resetar e disparar eventos. Ele chama os endpoints `/__mock/*`; nunca toca no estado da UI.
- **Usuários fictícios** (pelo menos 2): `ana@kurio.dev` / `Kurio@2026` e `bruno@kurio.dev` / `Kurio@2026`, cada um com perfil, carteiras e favoritos próprios. As credenciais também ficam documentadas no README.
- **Cupons determinísticos:** `KURIO10` (10%, válido), `GENESIS5` (5%, válido), `LANCAMENTO24` (expirado). Qualquer outro código é inválido.

**Cenários (§6):**

| Cenário | Comportamento |
|---|---|
| `default` | sucesso, latência 150–400 ms |
| `empty` | catálogo sem resultados |
| `slow` | latência fixa de 2.5 s (skeletons) |
| `jitter` | latência aleatória com seed; respostas fora de ordem |
| `offline` | todas as requisições falham por rede |
| `server-error` | GETs de catálogo/detalhe respondem 503 até `/__mock/scenario` mudar; "tentar novamente" recupera |
| `favorite-fail` | mutations de favorito respondem 500 (rollback do otimista) |
| `session-expired` | o token expira após N requisições ou ao disparar `expire` no painel |
| `signup-conflict` | e-mail ou usuário já existente (também ocorre naturalmente com os usuários do seed) |
| `price-change` | ao abrir o checkout, um item do carrinho tem preço alterado (emite `nft.updated`) |
| `sold-out` | uma edição esgota durante a compra |
| `order-timeout` | `POST /orders` cria o pedido mas não responde (timeout no cliente); o reenvio com a mesma chave recupera |
| `payment-declined` | o pedido termina `declined` |
| `wallet-reject` | `POST /wallets/:id/connect` responde recusa do usuário |

O controle de rede (`network.ts`) aplica, por cenário ou override do painel, latência fixa ou variável, timeout (resposta pendurada), `HttpResponse.error()` (offline) e status HTTP por rota. Tudo usa um PRNG com seed (`mulberry32`), o que torna os cenários reproduzíveis.

**Socket.IO:** `@mswjs/socket.io-binding` intercepta a conexão WebSocket do `socket.io-client`.

Limitações, que ficam documentadas:
- só o transporte `websocket` é suportado (long-polling não);
- a interceptação acontece na thread principal, não no Service Worker;
- não há rede real entre abas.

A mock associa o socket ao usuário e só emite para a "sala" dele. As salas são um mapa `userId → conexões` implementado na mock, porque o binding não tem salas.

**Spike obrigatório (primeira tarefa de realtime):** antes de fechar os contratos, um teste mínimo valida quatro pontos:
1. se o binding expõe o payload `auth` do CONNECT; se não expuser, o token vai na query da URL do socket (`connection.client.url`);
2. se o binding responde ao ping/pong do Engine.IO; se não responder, ajustar `pingInterval` e `pingTimeout` no handshake simulado ou implementar o pong, para o cliente não cair sozinho após ~45 s;
3. se fechar a conexão pelo servidor dispara a reconexão do cliente;
4. a compatibilidade de versão entre `socket.io-client` e o binding.

O resultado entra no `ARCHITECTURE.md`.

**Queda de conexão simulada:** o painel e os testes têm a ação `socket:drop` (o servidor simulado fecha as conexões e recusa novas por N segundos ou até `socket:restore`). O cenário `offline` aplica isso ao socket e também `HttpResponse.error()` ao REST. Toda mudança no banco simulado (preço, estoque, status do pedido) passa por uma única função `commit()`, que atualiza o banco e emite o evento correspondente. Assim REST e socket nunca divergem (§6).

## 7. Tempo real

**Formato dos eventos:**
```json
{ "eventId": "uuid", "type": "nft.updated", "resource": { "type": "nft", "id": "nft_042" }, "version": 7, "occurredAt": "...", "data": { "price": "1.29", "editions": [{"id": "...", "available": 3}] } }
```

**No cliente** (`src/features/realtime/`):
- **`SocketProvider`:** conecta com o token da sessão e desconecta no logout ou na troca de usuário, removendo todos os listeners.
- **Deduplicação:** um LRU de `eventId` já processados.
- **Versão monotônica:** para cada recurso, guarda a maior `version` aplicada e ignora eventos com versão menor ou igual. Um evento antigo nunca regride o estado e nunca reaplica efeitos (§7).
- **`nft.updated`:** faz `setQueryData` no detalhe, nas páginas de catálogo em cache (só as que contêm o NFT) e nas linhas do carrinho, e marca a cotação como obsoleta (`invalidateQueries(['quote'])`). Se o NFT está no carrinho, mostra um aviso acessível (`aria-live="polite"` + toast): "O preço de Emerald Ape #042 mudou de 1.19 para 1.29 ETH". Esgotou → linha marcada "Indisponível" e checkout bloqueado até ajustar.
- **`order.updated`:** atualiza `['order', id]`. Se o usuário estiver no fluxo, navega para o resultado: recibo se `confirmed`, tela de recusa com os itens preservados se `declined`.
- **Isolamento:** o handler descarta eventos cujo `userId` difere da sessão atual. É uma segunda barreira além das salas.
- **Reconexão:** no `connect` após uma desconexão, invalida as queries ativas de NFT, carrinho, cotação e pedidos pendentes. Isso reconcilia o estado com o REST.

**Cenário obrigatório (§7):**
1. Um NFT está no carrinho.
2. Disparar `nft.updated` pelo painel ou teste (via mock, chegando pelo socket).
3. O carrinho e o pagamento mostram o aviso e o resumo é atualizado.
4. "Confirmar compra" com a cotação antiga recebe `409 QUOTE_STALE`, e a UI exige reconfirmação.

**Pedido pendente com queda de conexão:** o ID do pedido pendente fica em `localStorage` (por usuário). Ao recarregar ou reconectar, `GET /orders/:id` recupera o estado sem criar outra compra.

## 8. Estado, cache e sessão

- **Query keys:** sempre incluem o escopo. Públicas: `['nfts', params]`, `['nft', id]`. Privadas: `['user', userId, 'cart']`, `['user', userId, 'favorites']`, e assim por diante. O carrinho de visitante usa `['guest', guestCartId, 'cart']`. Isso garante o isolamento por usuário e por parâmetros (§4).
- **Cancelamento:** o `signal` do TanStack Query é repassado ao Axios. Respostas obsoletas são descartadas porque cada combinação de parâmetros tem a própria chave. No catálogo, `placeholderData: keepPreviousData` mostra o estado de "atualizando" sem piscar.
- **Política (documentada no README):**

  | Dados | `staleTime` | `gcTime` |
  |---|---|---|
  | catálogo | 30 s | 5 min |
  | detalhe | 30 s | 5 min |
  | sessão | 5 min | 5 min |
  | carrinho, cotação, pedido pendente | 0 | 5 min |

  Retry: queries tentam 2 vezes com backoff exponencial, só para erro de rede ou 5xx (nunca 4xx). Mutations têm retry 0, exceto `POST /orders`, que reenvia com a mesma chave de idempotência. `refetchOnWindowFocus` só nas queries privadas sensíveis (carrinho e pedido).
- **Otimista com rollback (§4):** favoritos (`onMutate`, snapshot, `onError` restaura, `onSettled` invalida). Também a quantidade no carrinho, com rollback se der `409 OUT_OF_STOCK`.
- **Sessão:** um token opaco em `localStorage`, que é a sessão e não a senha. O interceptor do Axios injeta `Authorization: Bearer`. Um `401 SESSION_EXPIRED`:
  1. limpa a sessão;
  2. remove do cache todas as queries `['user', …]`;
  3. desconecta o socket;
  4. salva o contexto (rota atual e rascunho do checkout em `sessionStorage`, sem dados sensíveis);
  5. redireciona para `/entrar?redirect=…&reason=expired`.

  Após o login, o rascunho é restaurado. O logout e a troca de usuário fazem o mesmo, menos o rascunho.
- **Recuperação de falhas:** os estados de erro têm "Tentar novamente" (`refetch`). Mutations de pedido nunca duplicam, por idempotência.

## 9. Telas e comportamentos

**Início:**
- **Hero:** carrossel com indicadores (`•••`), acessível, com pausa e sem autoplay quando há preferência por movimento reduzido.
- **Catálogo:** sidebar com Coleções (contagens vindas de `facets`), Faixa de preço (slider duplo + "Aplicar") e Rede. Abas Todos/Novos/Em alta, ordenação, grid de 3 colunas com cards (selo RARO, preço riscado quando há promoção, ações ao passar o mouse: carrinho, favorito e ver) e paginação.
- **Mobile:** busca no topo e botão de filtros que abre um drawer (shadcn `Sheet`). Grid de 2 colunas escalonadas e barra inferior (Início, Favoritos, ação central, Carrinho, Perfil). A ação central ("escanear") está fora do escopo e leva a `/em-breve`.
- **Seções editoriais:** NFT em destaque, promos e Diário apontam para o NFT ou para `/em-breve`. A newsletter mostra "Indisponível nesta demonstração", sem aparentar sucesso.

**Detalhe:**
- Galeria com 4 miniaturas e zoom num `Dialog`.
- Título, preço, avaliação e edições (chips; edição esgotada fica desabilitada com o texto "Esgotada", não só por cor).
- Quantidade limitada a `min(available, maxPerOrder)`, com mensagem acessível ao atingir o limite.
- COMPRAR adiciona ao carrinho e vai para `/carrinho`. Favoritar exige login, voltando depois ao NFT.
- Abas "Detalhes" e "Avaliações (n)" (somente leitura), compartilhar (links externos reais com `rel="noopener"`) e "Mais desta coleção".
- Estados: 404 para NFT inexistente e "edição indisponível".
- Mobile: layout do frame (barra fixa com Qtd., preço, Comprar e Carrinho).

**Carrinho:**
- Tabela (NFT, Preço, Edições, Total) com +/− e lixeira, e o resumo vindo de `POST /quote`.
- Cupom aplica e remove, com erros "inválido" e "expirado" associados ao campo.
- Avisos de mudança por evento. "Conectar e finalizar" leva a `/pagamento` (com login, se for visitante). "Continuar explorando" volta ao catálogo. Seção "Colecionadores também viram".

**Pagamento:**
- **Desktop:** formulário do layout ("Perfil do colecionador"), pré-preenchido a partir do perfil e da carteira principal; "Usar outra carteira?" libera a entrada manual. À direita, "Seus NFTs", resumo, cupom e "Carteira e rede".
- **Mobile:** layout do frame, com carteiras cadastradas (Reserva/Principal), "Trocar carteira", conectores (WalletConnect, MetaMask, Coinbase Wallet) e Total.
- **Fluxo:**
  1. Validar o formulário.
  2. Conectar a carteira (diálogo "Aguardando aprovação…", com resultado aprovado ou recusado).
  3. Abrir o diálogo de **Revisão** com a cotação atual.
  4. "Enviar pedido" chama `POST /orders` com idempotência.
  5. Mostrar o estado pendente.
  6. Ao receber `order.updated`, ir para `/pedidos/$id`.
- **Desconexão simulada da carteira** (pelo painel, via evento `wallet.disconnected` no socket): volta ao passo 2 sem perder dados.

**Pedido (`/pedidos/$id`):**
- **`confirmed`:** o recibo do Figma (envelope, ID da transação, data, total, carteira, itens, taxa, total, "Ver no Etherscan", que abre uma URL simulada claramente marcada como simulação, num ambiente de testnet fictício). Tudo vem **só do `snapshot`**.
- **`pending`:** spinner acessível mais "Você pode sair desta página com segurança".
- **`declined`:** motivo, mais "Voltar ao carrinho", com os itens preservados.

**Perfil:**
- Campos do frame, avatar (upload PNG/JPG/WebP ≤ 2 MB, redimensionado para 256 px num canvas antes do envio, e "Remover") e "Alterar senha" (atual, nova, confirmação; força mínima validada; senha atual errada vira `INVALID_PASSWORD` no campo).
- Menu lateral: Dados do perfil, Carteiras e Lista de interesse funcionam. Atividade, Ofertas, Arquivos e Suporte levam a `/em-breve`. Sair faz logout.

**Carteiras:** principal e secundária com os campos do frame, "Igual à carteira principal" e erros da API associados aos campos.

**Redes [decisão do Claude]:** Ethereum, Polygon e Solana, como no Figma. Os preços ficam sempre em ETH, como no design. A rede muda:
- a **taxa de rede** da cotação: ethereum `0.016`, polygon `0.002`, solana `0.001`;
- a **validação do endereço**: EVM `0x` + 40 hex; Solana base58 com 32–44 caracteres;
- o nome exibido ("Rede principal Ethereum", "Rede Polygon").

O ENS (`.eth`) é opcional fora da Ethereum. Fica documentado que é uma simplificação de domínio.

**Pagamento sem carteira cadastrada:** o bloco de carteiras mostra o estado vazio "Nenhuma carteira cadastrada", com o link "Cadastrar carteira" (vai para `/perfil/carteiras?redirect=/pagamento`) e a opção "Usar outra carteira?" para entrada manual.

**Itens fora do escopo:**
- Login social (Google/Facebook) e "Esqueceu a senha?": botões visíveis, mas abrem um aviso "Indisponível nesta demonstração", sem aparentar sucesso (§3).
- Redes sociais do rodapé: links externos reais.

## 10. Acessibilidade e responsividade

- Foco visível com anel `primary` de 2 px e offset. Navegação completa por teclado. Diálogos e drawers do Radix já prendem e devolvem o foco.
- Labels reais, `aria-describedby` para erros, `aria-invalid`, asterisco com texto "obrigatório" para leitores de tela e `alt` descritivo nas artes.
- Região `aria-live` global (toasts com sonner) para mutations e eventos de tempo real.
- **Estados nunca só por cor:** ícone e texto para erro, esgotado e ativo.
- Sem overflow horizontal em 390/768/1440 e com zoom de 200%.
- Skeletons com shimmer em CSS (gradiente animado) com as dimensões reais do conteúdo (`aspect-square`, alturas fixas de linha), evitando CLS. Com `prefers-reduced-motion`, o shimmer vira um bloco estático.

## 11. Testes (Playwright)

**Projetos:**
- `chromium-desktop` (1440×900) e `chromium-mobile` (390×844, `isMobile`, touch);
- regressão visual também em `chromium-tablet` (768×1024).

**Alvo:** os testes rodam contra `vite preview` do **build de demonstração** (mocks ativos), igual ao deploy.

**Isolamento:** cada teste usa um contexto novo, e um contexto novo já começa com storage vazio. O cenário entra pela primeira navegação (`/?scenario=x&reset=1`). **Não** se usa `addInitScript` para limpar storage: ele rodaria de novo em todo reload e destruiria a persistência que os testes de refresh verificam.

**Controle da mock nos testes:** a fixture `mock` chama `/__mock/*` com `page.evaluate(() => fetch(...))`. O `page.request` não passa pelo Service Worker, então não chegaria ao MSW. Como banco e "servidor" vivem por aba, `emit` age sobre o socket daquela aba. Isso fica documentado como limitação.

**Tempo:** `page.clock` é instalado **só** nos testes que precisam dele (expiração de sessão, timeout de pedido). O MSW e o socket rodam na mesma thread e também seriam afetados. Nesses testes, a latência da mock é 0 e o tempo avança explicitamente.

**Plataforma das baselines:** os snapshots do Playwright dependem do sistema operacional. Versiono dois conjuntos **[decisão do Claude]**:
- `win32`, gerado nesta máquina;
- `linux`, gerado por um workflow do GitHub Actions (`.github/workflows/e2e.yml`), que também roda a suíte inteira a cada push e publica o relatório HTML como artefato.

Não há Docker nem WSL disponíveis localmente.

**Viewport mobile:** os testes usam 390 px (exigência do §8 do README). Os frames do Figma têm 414 px. As baselines refletem 390, e isso fica documentado como diferença esperada.

**Cobertura (§9):** um arquivo por item, de 01 a 12. Os fluxos principais rodam em desktop e mobile.

**Regressão visual:** Início, Detalhe, Carrinho e Pagamento × desktop/mobile (+ tablet), com baselines versionadas, dados estáveis (seed e cenário `default` sem jitter), animações desligadas e fontes carregadas antes da captura.

**Saídas:** relatório HTML e `trace: 'retain-on-failure'`.

## 12. Performance (Lighthouse)

`scripts/lighthouse.mjs` (configuração versionada em `lighthouse/config.*`):
- builda e sobe o preview;
- audita `/` e `/nft/<id>` × perfis mobile e desktop × 3 execuções;
- calcula a mediana por categoria e guarda LCP, CLS e TBT;
- salva HTML e JSON em `lighthouse/reports/` mais um `summary.md` com as versões das ferramentas, o ambiente e as condições.

**Alavancas:**
- imagens AVIF responsivas com `fetchpriority="high"` e preload da imagem de LCP;
- fontes self-hosted com `font-display: swap` e preload do peso principal;
- code-splitting por rota;
- carregamento da mock otimizado: chunk separado e worker registrado antes do render. O custo desse carregamento entra na análise.

Resultados abaixo da meta são justificados no relatório, sem simplificações exclusivas (§10).

**Risco conhecido:** o Lighthouse audita com storage limpo, então o Service Worker do MSW é instalado em toda execução. Por isso uma **medição de base** roda logo após o esqueleto da Início ficar pronto, e não só no final. Assim as decisões de performance são tomadas cedo.

## 12.1 Ordem de execução
O usuário pediu escopo completo, sem cortes. A ordem segue dependência e peso na §11:
1. fundação (tokens, layout, contratos, mock base);
2. spike do realtime;
3. catálogo e detalhe;
4. auth e sessão;
5. carrinho e cotação;
6. checkout, pedidos e tempo real;
7. perfil e carteiras;
8. cenários de falha;
9. testes E2E e visuais;
10. Lighthouse, docs e deploy.

Os testes de cada fluxo são escritos junto com o fluxo, não deixados para o fim.

## 13. Organização do código

```
src/
  app/          # router, providers (Query, Socket, Session), query-client
  routes/       # rotas TanStack (file-based)
  features/     # catalog, nft, cart, checkout, orders, auth, profile, wallets, favorites, realtime
                # cada uma: api.ts (Axios), queries.ts (Query), components/
  shared/       # contracts (Zod), api (axios + erros), ui (shadcn), lib (money, format), hooks
  mocks/        # ver §6
tests/e2e/      # 01..12 + visual/
lighthouse/     # config + reports
scripts/        # figma-tokens, optimize-images, lighthouse
```

**Scripts npm:** `dev` (com mocks), `build`, `preview`, `typecheck`, `lint` (ESLint), `test:e2e`, `test:e2e:update` (baselines), `lighthouse`.

**Documentação:**
- `README.md` (em português): setup, variáveis, credenciais, cenários e reset, comandos e como reproduzir cada falha.
- `ARCHITECTURE.md`: contratos, eventos, sessão, carrinho, cache, reconciliação, limitações, decisões de UX e desvios do Figma.

**Variáveis de ambiente:** `VITE_ENABLE_MOCKS`, `VITE_API_BASE_URL=/api`, `VITE_SOCKET_URL`. O `FIGMA_TOKEN` só é usado pelos scripts de design e é opcional para rodar o projeto.

## 14. Processo

`writing-plans` → execução via `subagent-driven-development` (um subagente por tarefa, TDD onde fizer sentido: utilitários de dinheiro, versão e dedup de eventos, regras da mock, idempotência), revisão por tarefa e `verification-before-completion` antes de qualquer conclusão. Commits e push só com autorização do usuário. Deploy Vercel no final, com verificação dos fluxos na URL pública.

## 15. Deixado para o executor
Nomes internos, divisão exata de componentes, textos de microcopy não desenhados (seguindo o tom do Figma), escolha de lib de ícones caso a caso e o valor de debounce/latências dentro das faixas acima.
