# Kurio — Marketplace de NFTs

[![e2e](https://github.com/Schaussard-dev/kurio-nft-marketplace/actions/workflows/e2e.yml/badge.svg?branch=main)](https://github.com/Schaussard-dev/kurio-nft-marketplace/actions/workflows/e2e.yml)

Entrega do desafio frontend da Jungle Gaming: marketplace de NFTs com descoberta, compra e conta do colecionador, em desktop e mobile. Todo o backend é simulado com MSW (REST e Socket.IO), na camada de rede.

- **Repositório:** https://github.com/Schaussard-dev/kurio-nft-marketplace
- **Deploy:** https://kurio-schaussard.vercel.app (Vercel, publica a cada push na `main`; build `npm run build:demo`)
- **Arquitetura, contratos, eventos, desvios do Figma e limitações:** [`ARCHITECTURE.md`](ARCHITECTURE.md)
- **Auditoria Lighthouse:** [`lighthouse/summary.md`](lighthouse/summary.md)
- **Testes exploratórios e revisão final (planos e relatórios):** [`docs/qa/`](docs/qa/relatorio-revisao-final.md)

**Stack:** React 19 · TypeScript 5.9 · Vite 8 · TanStack Router · TanStack Query v5 · Axios · socket.io-client 4.8 · Tailwind CSS v4 · shadcn/ui (Radix) · Zod 4 · react-hook-form · big.js · MSW 2.15 + `@mswjs/socket.io-binding` · Playwright 1.65 · Vitest · Lighthouse 13. Versões fixadas em `package.json` e `package-lock.json`.

## Sumário

1. [Requisitos](#requisitos)
2. [Setup](#setup)
3. [Variáveis de ambiente](#variáveis-de-ambiente)
4. [Credenciais e dados fictícios](#credenciais-e-dados-fictícios)
5. [Comandos](#comandos)
6. [Mocks: cenários, seleção e reset](#mocks-cenários-seleção-e-reset)
7. [Como reproduzir os fluxos de falha](#como-reproduzir-os-fluxos-de-falha)
8. [Política de cache, retry e sincronização](#política-de-cache-retry-e-sincronização)
9. [Testes](#testes)
10. [Lighthouse](#lighthouse)
11. [Deploy](#deploy)

## Requisitos

| Ferramenta | Versão | Observação |
|---|---|---|
| Node.js | 22 (testado com 22.22; o CI usa 22) | |
| npm | 10 | o projeto usa `npm ci` com `package-lock.json` |
| Chromium do Playwright | o da versão 1.65 | `npx playwright install chromium` |
| Google Chrome | qualquer estável | só para `npm run lighthouse` (o script usa `chrome-launcher`, que procura o Chrome instalado) |

Portas usadas: **5173** (`npm run dev`) e **4173** (`npm run preview`, testes E2E e Lighthouse). `npm run test:e2e` usa as duas ao mesmo tempo (ver [Testes](#testes)).

## Setup

```bash
git clone https://github.com/Schaussard-dev/kurio-nft-marketplace.git
cd kurio-nft-marketplace
npm ci
npx playwright install chromium   # só para os testes E2E
npm run dev                       # http://localhost:5173, com mocks
```

Nenhum arquivo `.env` precisa ser criado. O repositório versiona `.env.development` (`VITE_ENABLE_MOCKS=true`, lido só pelo servidor de desenvolvimento) e os scripts de build definem o resto. Não há backend, serviço privado nem chave externa: a API e o Socket.IO rodam no navegador, via MSW.

## Variáveis de ambiente

Modelo em [`.env.example`](.env.example). Para sobrescrever localmente, use `.env.development.local` (ignorado pelo Git). Evite `VITE_ENABLE_MOCKS=true` em `.env` ou `.env.local`: esses arquivos também são lidos por `npm run build`, que passaria a embutir os mocks (e `npm run check:prod-bundle` falharia).

| Variável | Padrão | Onde é usada | Efeito |
|---|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` em `npm run dev` (`.env.development`) e em `npm run build:demo` (`cross-env`); ausente em `npm run build` | `src/main.tsx`, `src/routes/__root.tsx`, `vite.config.ts` | `true` carrega a camada MSW antes do primeiro render e mostra o painel "Simulação". Sem ela, o build não contém código de mock (verificado por `npm run check:prod-bundle`). |
| `VITE_API_BASE_URL` | `/api` | `src/shared/api/http.ts` | Base do Axios. Os handlers MSW atendem em `/api`. |
| `VITE_SOCKET_URL` | vazio = mesma origem da página | `src/features/realtime/socket.ts`, `src/mocks/realtime/server.ts` | URL do servidor Socket.IO. O servidor simulado escuta na mesma URL que o cliente usa. |
| `FIGMA_TOKEN` | vazio | só `scripts/figma-tokens.mjs` (nunca entra no bundle) | Regenera `src/styles/tokens.generated.css` a partir do Figma. O script lê o token de `.env.local`. Não é necessário para rodar, testar nem buildar: os tokens gerados estão versionados. |

## Credenciais e dados fictícios

As contas abaixo são **fixtures de demonstração**, definidas em `src/mocks/fixtures/users.ts`. Elas só existem no banco simulado do navegador. A senha nunca é guardada em claro: o seed grava apenas um hash PBKDF2 (Web Crypto, 100 000 iterações, SHA-256, com salt), e contas criadas pelo cadastro recebem salt aleatório.

| Usuário | E-mail | Senha | Estado inicial |
|---|---|---|---|
| Ana Souza (`ana`) | `ana@kurio.dev` | `Kurio@2026` | carteira principal (Ethereum, MetaMask) e secundária (Polygon, WalletConnect), 1 favorito (Emerald Ape #042), carrinho com 1× Sage Nomad #009 (edição 1/50) |
| Bruno Lima (`bruno`) | `bruno@kurio.dev` | `Kurio@2026` | sem carteiras, sem favoritos, carrinho vazio |

| Cupom | Efeito |
|---|---|
| `KURIO10` | 10% de desconto (válido até 2027-12-31) |
| `GENESIS5` | 5% de desconto (válido até 2027-12-31) |
| `LANCAMENTO24` | expirado: `422 COUPON_EXPIRED` |
| qualquer outro | `422 COUPON_INVALID` |

O código é normalizado (espaços e maiúsculas/minúsculas não importam). Taxa de rede estimada: Ethereum `0.016`, Polygon `0.002`, Solana `0.001` ETH.

**Catálogo:** 60 NFTs (os 9 primeiros são os do Figma), 9 coleções, 3 redes e 4 tipos de edição (`1/1`, `1/10`, `1/50`, `ABERTA`). Para os fluxos de "edição indisponível", a edição `1/1` do Emerald Ape #042 (`/nft/nft_042`) nasce esgotada.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor Vite em `http://localhost:5173`, **com mocks** (MSW + Socket.IO simulado + painel "Simulação"). |
| `npm run build` | Typecheck (`tsc -b`) e build de produção **sem mocks** em `dist/`. |
| `npm run check:prod-bundle` | Depois de `npm run build`: falha se `dist/` contiver MSW, o worker, `/api/__mock`, o banco simulado ou o painel. |
| `npm run build:demo` | Build otimizado **com mocks** em `dist/`. É o build do deploy, dos testes E2E e do Lighthouse. |
| `npm run preview` | Serve `dist/` em `http://localhost:4173` (porta fixa). Rode depois de `build:demo` para ver a demonstração. |
| `npm run typecheck` | `tsc -b --noEmit`. |
| `npm run lint` | ESLint em todo o projeto. |
| `npm run test:unit` | Vitest (contratos, dinheiro, handlers MSW, pipeline de eventos, cache, idempotência…). |
| `npm run test:e2e` | Playwright: faz `build:demo`, sobe `preview` (4173) e `dev` (5173) e roda E2E + regressão visual. |
| `npm run test:e2e:update -- tests/visual` | Regenera as baselines visuais da plataforma atual. |
| `npm run lighthouse` | Faz `build:demo`, serve na 4173 e audita `/` e `/nft/nft_042`, 3× por perfil (mobile e desktop). Grava `lighthouse/reports/` e `lighthouse/summary.md`. Aceita `-- --skip-build` e `-- --keep=all`. |

Demonstração local igual ao deploy: `npm run build:demo && npm run preview`.

## Mocks: cenários, seleção e reset

A camada de mocks fica toda em `src/mocks/`. Ela é carregada por `src/main.tsx` só quando `VITE_ENABLE_MOCKS=true`. Componentes, hooks e o cliente Axios não sabem que a API é simulada.

- **Persistência:** o banco simulado fica em `localStorage` (`kurio-mock-db:v1`) e sobrevive ao refresh. Ele é compartilhado entre abas da mesma origem: antes de cada leitura ou gravação, a aba relê o banco salvo se outra aba o alterou, então pedidos, cadastros, sessões e estoque de uma aba valem nas outras e nenhuma gravação apaga a de outra aba.
- **Sessão entre abas:** `kurio-session` também fica em `localStorage`. Login ou logout numa aba vale para as próximas requisições das outras, e o cabeçalho delas acompanha. Um `401` de um token que já foi substituído não encerra a sessão nova.
- **Eventos não cruzam abas:** o servidor Socket.IO simulado é **por aba**. Um `nft.updated` ou `order.updated` emitido numa aba só chega aos sockets dessa aba; as outras veem a mudança no próximo refetch.
- **Cenário ativo:** fica em `sessionStorage` (`kurio-mock-config`), ou seja, **por aba**. Uma aba nova começa em `default`.
- **Determinismo:** a latência sai de um PRNG com seed por cenário. Cada ativação do cenário repete a mesma sequência.
- **Troca de senha:** não encerra as outras sessões do mesmo usuário (outras abas e navegadores continuam logados até o token expirar ou o logout).

### Cenários

| Cenário | Rótulo no painel | O que muda na simulação | O que observar |
|---|---|---|---|
| `default` | Padrão | Tudo funciona; latência 150–400 ms | Fluxos completos |
| `empty` | Catálogo vazio | O seed é aplicado sem NFTs (precisa de reset) | "Nenhum NFT encontrado" no catálogo |
| `slow` | Rede lenta | Latência fixa de 2,5 s | Skeletons com shimmer no catálogo, detalhe e resumo do carrinho |
| `jitter` | Latência variável | Latência de 50 a 1 500 ms por requisição | Respostas fora de ordem; a tela mostra sempre a última busca |
| `offline` | Sem rede | Toda chamada REST `/api/*` falha por rede (`HttpResponse.error()`) | Estados de erro com "Tentar novamente". O socket não é afetado: use "Derrubar conexão" |
| `server-error` | Erro de servidor | Toda chamada REST `/api/*` responde `503 TRANSIENT` | Retry automático das queries e depois o estado de erro |
| `favorite-fail` | Falha ao favoritar | `PUT` e `DELETE /api/favorites/*` respondem `500 TRANSIENT` | Rollback do favorito otimista e aviso de erro |
| `session-expired` | Sessão expirada | Cada token expira na 4ª requisição autenticada | Redirecionamento para `/entrar` com aviso e retomada do contexto |
| `signup-conflict` | Conflito no cadastro | Igual ao `default`; o conflito vem dos usuários do seed | `409 EMAIL_TAKEN` / `USERNAME_TAKEN` nos campos |
| `price-change` | Preço alterado | Na 1ª aprovação de carteira do checkout, o preço do 1º item do carrinho sobe 0,10 ETH (emite `nft.updated`) | Aviso de preço, `409 QUOTE_STALE` e reconfirmação |
| `sold-out` | Esgotado | No 1º `POST /orders`, a edição do 1º item do carrinho esgota (emite `nft.updated`) | `409 OUT_OF_STOCK`, checkout bloqueado até ajustar o carrinho |
| `order-timeout` | Pedido demora a confirmar | O 1º `POST /orders` de cada chave cria o pedido mas não responde; o pedido só se resolve após 60 s | Timeout de 10 s no cliente, reenvio com a mesma chave e recuperação do mesmo pedido |
| `payment-declined` | Pagamento recusado | O pedido termina `declined` | Tela "Pagamento recusado"; o carrinho fica intacto |
| `wallet-reject` | Carteira rejeita | `POST /wallets/:id/connect` responde `409 WALLET_REJECTED` | "Conexão recusada na carteira." com "Tentar novamente" |

### Selecionar e resetar

| Como | Efeito |
|---|---|
| URL `?scenario=<nome>&reset=1` (em qualquer rota) | Ativa o cenário **e** restaura o seed dele. Os dois parâmetros são lidos no boot e removidos da URL; os demais parâmetros ficam. **Forma recomendada.** |
| URL `?reset=1` | Restaura o seed do cenário ativo. |
| URL `?scenario=<nome>` | Ativa o cenário sem reseed (latência e falhas mudam; o `empty` precisa de `reset=1` para esvaziar o catálogo). |
| Painel **Simulação** (botão flutuante no canto inferior esquerdo, só com mocks) → "Cenário" | Reseed + troca de cenário, e a página recarrega para descartar o cache do cliente. O reseed encerra a sessão e restaura carrinhos, favoritos e pedidos do seed: entre de novo depois de trocar. A latência fixa do campo "Latência (ms)" continua valendo até ser apagada. |
| Painel → "Reset" | Restaura o seed do cenário ativo e recarrega a página. |
| `POST /api/__mock/reset` / `/api/__mock/scenario` / `/api/__mock/emit` | Mesmo controle por código. Ver abaixo. |

O reset não apaga a sessão salva no navegador (`kurio-session`). Depois de um reset, o token antigo não existe no banco novo e a primeira chamada autenticada responde `401`, o que encerra a sessão como uma expiração. Para começar do zero, entre de novo.

Um `mock('reset')` pelo console (sem recarregar) mantém o realtime funcionando: as versões dos recursos nunca voltam para as do seed, então o próximo `nft.updated` é aplicado normalmente. O que já está em tela só mostra o seed restaurado no próximo refetch; para ver tudo de uma vez, recarregue a página (é o que o "Reset" do painel faz).

**Ações do painel:** cenário, latência fixa (ms; vazio volta à do cenário), Reset, Expirar sessão, Derrubar conexão, Restaurar conexão, Desconectar carteira, alterar preço de um NFT (ID + novo preço), esgotar todas as edições de um NFT e reenviar um evento pelo ID.

**API de controle** (só existe com mocks; não passa por latência nem falhas de cenário). Pode ser chamada pelo console do DevTools na aba da aplicação:

```js
const mock = (path, body = {}) =>
  fetch(`/api/__mock/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json())

await mock('reset', { scenario: 'default' })                       // reseed + cenário
await mock('scenario', { scenario: 'default', latencyOverride: 0 }) // troca cenário/latência sem reseed
await mock('emit', { action: 'nft:update', nftId: 'nft_042', price: '1.29' }) // → { ok, eventId, version }
```

| `action` de `/api/__mock/emit` | Corpo | Efeito |
|---|---|---|
| `nft:update` | `nftId`, `price?`, `editions?` (número para todas as edições, ou `[{ id, available }]`) | Muta o NFT no banco e emite `nft.updated` para todos; responde `eventId` e `version` |
| `event:replay` | `eventId` | Reenvia um evento já emitido, sem alterações (duplicata ou evento antigo) |
| `order:resolve` | `orderId` | Resolve agora um pedido pendente para o resultado planejado |
| `session:expire` | — | Expira todas as sessões ativas e fecha os sockets delas |
| `socket:drop` | `seconds?` | Fecha todas as conexões e recusa novas até `socket:restore` (ou até `seconds`) |
| `socket:restore` | — | Volta a aceitar conexões |
| `wallet:disconnect` | `userId?` | Emite `wallet.disconnected` para o usuário (ou para todos os conectados nesta aba) |
| `whoami` | — | Sonda de teste: cada conexão recebe `mock.whoami` com o usuário que o servidor associou |

O painel e os testes chamam `/api/__mock/*` com `fetch` direto. É a única chamada de rede fora do `http.ts` (Axios), por ser ferramenta de demonstração e de teste, e não REST de negócio. Ela não existe no build de produção (`npm run build && npm run check:prod-bundle`).

## Como reproduzir os fluxos de falha

Todos os roteiros partem de `http://localhost:5173` (`npm run dev`) ou do preview do build de demonstração. Ao trocar de roteiro, comece com `?scenario=<nome>&reset=1`. No desktop, COMPRAR fica na coluna da direita do detalhe; no mobile, o botão é "Comprar NFT".

### Sucesso e resultado vazio

1. Abra `/?scenario=default&reset=1`. O catálogo mostra 60 NFTs, 9 por página. Busca, filtros, ordenação e página vão para a URL e sobrevivem ao refresh e ao voltar/avançar.
2. Abra `/?scenario=empty&reset=1`. O catálogo mostra "Nenhum NFT encontrado".
3. Em `default`, uma busca sem resultado (`/?q=zzz`) mostra o mesmo estado vazio, com "Limpar filtros".

### Latência variável e respostas fora de ordem

1. Abra `/?scenario=jitter&reset=1`.
2. Digite e apague rápido na busca do catálogo, ou troque filtros em sequência.
3. Cada combinação de parâmetros tem a própria query key, e a anterior é cancelada pelo `AbortSignal`. Uma resposta atrasada nunca sobrescreve a busca atual. O grid mantém os resultados anteriores na tela, com uma barra de progresso no topo, enquanto a nova busca carrega.
4. Para skeletons: `/?scenario=slow&reset=1` (2,5 s por resposta), no catálogo, em `/nft/nft_042` e em `/carrinho`.

### Falhas de conexão e respostas HTTP 4xx/5xx

1. Abra `/?scenario=offline&reset=1`. Depois de 2 novas tentativas automáticas, o catálogo mostra "Não foi possível carregar os NFTs." e "Tentar novamente".
2. Para ver a recuperação na mesma tela, rode no console `await mock('scenario', { scenario: 'default' })` (snippet acima) e clique em "Tentar novamente". (Trocar o cenário pelo painel também recupera, mas recarrega a página.)
3. `/?scenario=server-error&reset=1` faz o mesmo com `503`. Em `/nft/nft_042` aparece "Não foi possível carregar este NFT.".
4. 4xx: `/nft/nao-existe` → "NFT não encontrado" (404); uma rota inexistente (`/qualquer-coisa`) mostra a página 404. O pedido de outro usuário (`GET /orders/:id` → `403 FORBIDDEN`) aparece como "Pedido não encontrado", igual a um ID inexistente, para não revelar nada sobre ele.
5. Mutation com rollback: `/?scenario=favorite-fail&reset=1`, entre como Ana e clique no coração de um NFT. O coração muda na hora (otimista), volta ao estado anterior quando o `500` chega e aparece "Não foi possível atualizar seus favoritos. Tente novamente.".
6. Queda do Socket.IO: painel → "Derrubar conexão". Depois de 1,5 s aparece a pílula "Reconectando…". Enquanto isso, altere um preço pelo painel (o evento se perde). Em "Restaurar conexão", o cliente reconecta e refaz as queries ativas pelo REST, e o preço novo aparece sem aviso de mudança inventado.

### Sessão expirada e acesso não autorizado

1. Acesso não autorizado: sem login, abra `/perfil`, `/pagamento` ou `/pedidos/x`. O guard redireciona para `/entrar?redirect=…`. Depois do login, a navegação volta ao destino (só caminhos internos são aceitos).
2. Expiração durante a navegação: entre como Ana, abra `/perfil` e use painel → "Expirar sessão". A próxima chamada autenticada responde `401 SESSION_EXPIRED`. Os dados privados saem do cache, o socket da sessão fecha e a tela vai para `/entrar` com "Sua sessão expirou. Entre novamente para continuar.". Entre de novo e a navegação volta à mesma rota.
3. Expiração durante o checkout: em `/pagamento`, preencha o formulário (por exemplo, a observação) e use "Expirar sessão". Depois do novo login, o rascunho é restaurado (ele fica em `sessionStorage`, sem senha nem dados sensíveis).
4. Cenário automático: `/?scenario=session-expired&reset=1`. Cada token aceita 3 requisições autenticadas; a 4ª responde `401`.

### Conflito de cadastro e validação de formulário

1. `/cadastro` (`/?scenario=signup-conflict&reset=1`, ou qualquer cenário): envie vazio. Cada campo mostra o erro associado (`aria-describedby`) e o foco vai para o primeiro inválido.
2. Use o e-mail `ana@kurio.dev` ou o usuário `ana`: a API responde `409 EMAIL_TAKEN` / `USERNAME_TAKEN` e o erro aparece no campo.
3. Perfil (`/perfil`, logado como Bruno): trocar o e-mail para `ana@kurio.dev` gera o mesmo `409`. Senha atual errada em "Alterar senha" gera `422 INVALID_PASSWORD` no campo.
4. Carteiras (`/perfil/carteiras`): endereço inválido para a rede e ENS sem `.eth` mostram erro por campo. O ENS é obrigatório só na rede Ethereum.

### Cupom inválido ou expirado

1. Em `/carrinho` (com algum item), aplique `XYZ`: "Cupom inválido".
2. Aplique `LANCAMENTO24`: "Cupom expirado".
3. Aplique `KURIO10`: o resumo mostra o desconto calculado pela API. "Remover" tira o cupom.

### Preço alterado ou edição esgotada durante a compra

**Pelo Socket.IO, com o carrinho aberto:**
1. Entre como Ana (o carrinho dela tem Sage Nomad #009) e abra `/carrinho`.
2. Painel → ID do NFT `nft_009`, novo preço `1.79` → "Alterar preço de NFT do carrinho".
3. A linha e o resumo se atualizam e aparece "O preço de Sage Nomad #009 mudou de 1.69 para 1.79 ETH" (anunciado por leitor de tela). Fora do carrinho, a mesma mudança vira um toast.
4. "Esgotar edição" no mesmo NFT marca a linha como "Esgotado" e bloqueia "Conectar e finalizar" até o item ser removido. Com estoque menor que a quantidade (`await mock('emit', { action: 'nft:update', nftId: 'nft_009', editions: 1 })` com 2 unidades no carrinho), a linha mostra "Apenas 1 disponível" até a quantidade ser reduzida.

**Durante o checkout (cenário `price-change`):**
1. `/?scenario=price-change&reset=1`, entre como Ana, `/carrinho` → "Conectar e finalizar".
   No painel "Simulação", defina a latência fixa em `1500` ms: com a latência padrão (150–400 ms) a página pode recotar antes de a revisão abrir, e a revisão já mostra 1.806 (sem `409`). É o mesmo ajuste usado em `tests/e2e/09-realtime-checkout.spec.ts`.
2. Em `/pagamento`, "Confirmar compra". A aprovação simulada da carteira sobe o preço do Sage Nomad em 0,10 ETH (`nft.updated`), e o total da página vai de 1.706 para 1.806 ETH.
3. "Enviar pedido" na revisão envia a cotação antiga, e a API responde `409 QUOTE_STALE`. O diálogo "O valor do pedido mudou" mostra antes e agora. Nenhum pedido é criado até "Confirmar novo valor".

**Edição esgotada no envio (cenário `sold-out`):** repita os passos acima com `/?scenario=sold-out&reset=1`. O primeiro `POST /orders` encontra a edição esgotada (`409 OUT_OF_STOCK`). A página mostra "Alguns itens não têm mais estoque suficiente. Ajuste o carrinho para continuar." e bloqueia a confirmação.

### Timeout após a criação do pedido, com recuperação por idempotência

1. `/?scenario=order-timeout&reset=1`, entre como Ana, vá ao checkout e envie o pedido.
2. A API cria o pedido mas não responde. Aos 10 s o cliente desiste e reenvia **uma vez**, sozinho, com a **mesma** `Idempotency-Key`. A API devolve o pedido já criado (`200`), sem criar outro.
3. Se o reenvio também falhar, o diálogo "Confirmando pedido" oferece "Verificar pedido", que repete o mesmo payload com a mesma chave. Fechar o diálogo, recarregar a página ou mudar um campo não gera uma chave nova enquanto a tentativa não tiver resposta definitiva.
4. A página `/pedidos/<id>` mostra "Aguardando confirmação na rede…". Recarregue ou derrube o socket: o estado volta pelo `GET /orders/:id` (o ID fica em `localStorage`), e uma faixa global "Você tem um pedido em processamento" aparece nas outras páginas. Neste cenário o pedido se resolve em 60 s. Para antecipar: `await mock('emit', { action: 'order:resolve', orderId: '<id da URL>' })`.

### Pagamento confirmado e pagamento recusado

1. Confirmado: em `default`, entre como Ana, faça carrinho → `/pagamento` → "Confirmar compra" → revisão → "Enviar pedido". O pedido nasce `pending` e cerca de 2,5 s depois chega `order.updated` com `confirmed`. O recibo mostra hash, link de explorador simulado, itens, taxas e total do snapshot. Do carrinho saem só as quantidades compradas.
2. Recusado: o mesmo roteiro com `/?scenario=payment-declined&reset=1` termina em "Pagamento recusado", com o motivo e "Voltar ao carrinho". O carrinho fica intacto.
3. Carteira: `/?scenario=wallet-reject&reset=1` faz a aprovação falhar com "Conexão recusada na carteira." (trocar para `default` pelo console e clicar em "Tentar novamente" conecta). Com a revisão aberta, painel → "Desconectar carteira" fecha a revisão, mantém o formulário e pede nova conexão.

### Eventos duplicados ou antigos

1. Pelo console: `const { eventId } = await mock('emit', { action: 'nft:update', nftId: 'nft_042', price: '1.29' })`, depois `await mock('emit', { action: 'nft:update', nftId: 'nft_042', price: '1.49' })`.
2. `await mock('emit', { action: 'event:replay', eventId })` reenvia o evento antigo (versão menor). O cliente o descarta pelo `eventId` já visto e pela versão monotônica: o preço continua 1.49 e nada é anunciado de novo. O painel tem o mesmo "Reenviar último evento" a partir do ID do evento.

## Política de cache, retry e sincronização

Padrões em `src/app/query-client.ts`; exceções nos `queries.ts` de cada feature.

| Dado | Query key | `staleTime` | `gcTime` | Refetch no foco | Observações |
|---|---|---|---|---|---|
| Catálogo | `['nfts', params]` | 30 s | 5 min | não | `placeholderData: keepPreviousData`; uma chave por combinação de parâmetros |
| Detalhe do NFT | `['nft', id]` | 30 s | 5 min | não | |
| Sessão | `['session']` | 5 min | 5 min | não | O guard das rotas privadas navega com a sessão em cache e a revalida em segundo plano (`staleTime: 0`) |
| Carrinho | `['user', userId, 'cart']` / `['guest-cart', guestId]` | 0 | 5 min | sim | Só busca depois que a sessão salva foi verificada pela API |
| Cotação | `['quote', escopo, { coupon, network, version }]` | 0 | 5 min | não | A versão do carrinho entra na chave: qualquer mudança no carrinho pede nova cotação |
| Pedido | `['user', userId, 'order', orderId]` | 0 | 5 min | sim | Pendente e socket fora do ar: polling a cada 5 s |
| Favoritos, perfil, carteiras | `['user', userId, …]` | 30 s | 5 min | não | |

**Retry**

| Operação | Política |
|---|---|
| Queries | Até 2 novas tentativas (500 ms, depois 1 s) só para erro de rede, timeout, `TRANSIENT`, 5xx, 408 ou 429. Nunca para outros 4xx nem para cancelamento. |
| Mutations | Nenhum retry automático. |
| `POST /orders` | Exceção: 1 reenvio automático imediato após erro incerto (timeout, rede, 5xx), **com a mesma `Idempotency-Key`**. Prazo do cliente: 10 s. |
| Axios | Timeout de 10 s em toda requisição; o `signal` do TanStack Query cancela requisições obsoletas. |

**Sincronização**

| Gatilho | Efeito no cache |
|---|---|
| Mutation de carrinho | A resposta (carrinho inteiro) substitui o cache. Quantidade é otimista, com rollback só da linha que falhou e revalidação quando a última mutation termina. |
| Favoritar / desfavoritar | Otimista (`onMutate` + snapshot), rollback em erro e invalidação quando a última mutation termina. |
| Perfil / carteiras | A resposta grava o cache; perfil também atualiza a sessão (nome e avatar no cabeçalho). |
| Login / cadastro | Grava a sessão, invalida `['nfts']` e `['nft']` e mescla o carrinho de visitante (`POST /cart/merge`). |
| Logout, troca de usuário, sessão expirada | Remove todas as queries `['user', …]`, zera a sessão e reconecta o socket com o novo token (ou como visitante). |
| `nft.updated` | Aplica preço e estoque no detalhe, nas páginas de catálogo, no carrinho e nos favoritos em cache (só cópias mais antigas que a versão do evento) e invalida `['quote']`. |
| `order.updated` | Grava o pedido (se a versão for maior) e invalida carrinho, cotação, `['nft']` e `['nfts']`. |
| Reconexão do socket | Invalida catálogo, detalhe, cotação, carrinho, favoritos e pedidos: o REST é a fonte de verdade. |

Detalhes e justificativas em [`ARCHITECTURE.md`](ARCHITECTURE.md#estratégia-de-cache).

## Testes

### Unitários (Vitest)

`npm run test:unit` cobre contratos Zod, aritmética de ETH (`money.ts`), handlers MSW (carrinho, favoritos, NFTs, pedidos, carteiras), preços e cupons, pipeline `commit` de eventos, agendador de pedidos, guarda de eventos (dedupe/versão), cache do carrinho e dos favoritos, idempotência, rascunho do checkout, sessão e contraste das cores.

### E2E e regressão visual (Playwright)

`npm run test:e2e`:
- sobe **dois servidores**: `npm run build:demo && npm run preview` (4173), usado por todos os projetos, e `npm run dev` (5173), usado só pelo projeto `spike` (teste do binding Socket.IO, que importa módulos do código-fonte). As duas portas precisam estar livres. Fora do CI, um servidor já rodando nessas portas é reaproveitado;
- workers limitados a **3 local / 2 no CI**: cada worker roda a aplicação inteira, com MSW e servidor Socket.IO simulado por aba;
- projetos: `chromium-desktop` (1440×900) e `chromium-mobile` (390×844, touch) para os fluxos; `chromium-tablet` (768×1024) só para regressão visual; `spike` (5173);
- relatório HTML em `playwright-report/` (`npx playwright show-report`) e traces das falhas em `test-results/`;
- contra o deploy público, sem servidores locais: `BASE_URL=https://kurio-schaussard.vercel.app npx playwright test tests/e2e/01-catalog.spec.ts tests/e2e/06-purchase.spec.ts tests/e2e/09-realtime-checkout.spec.ts --project=chromium-desktop` (17 testes, verificados na entrega).

| Spec | Cobre (§9 do enunciado) |
|---|---|
| `01-catalog` | Busca, filtros combinados, ordenação, paginação, histórico, vazio, jitter, erro |
| `02-detail` | Acesso direto, NFT inexistente, edição esgotada, limite de quantidade |
| `03-auth` | Cadastro, conflito, login, expiração (navegação e reload), logout, troca de usuário, redirect externo ignorado |
| `04-favorites` | Favoritos persistidos, falha da mutation e rollback, isolamento entre usuários |
| `05-cart` | Quantidades, remoção, cupons, refresh, merge no login |
| `06-purchase` | Compra completa do catálogo ao recibo, carrinho subtraído |
| `07-payment-failures` | Recusa, clique duplo, timeout com recuperação do mesmo pedido, esgotado, carteira recusada |
| `08-profile-wallets` | Perfil, avatar, senha e carteiras, com erros de validação |
| `09-realtime-checkout` | Preço/estoque via Socket.IO no carrinho e no checkout, `QUOTE_STALE` |
| `10-realtime-resilience` | Evento duplicado/antigo, queda e reconexão, pedido pendente após reload, isolamento entre usuários |
| `11-a11y-keyboard` | Compra só por teclado, foco em diálogos e drawers, formulários, axe (WCAG 2.1 AA) |
| `12-loading-failures` | Skeletons, layout estável, movimento reduzido, falha e nova tentativa |
| `shell`, `smoke`, `mock-control`, `realtime-spike` | Layout sem overflow (390/768/1440), painel de mocks, API de controle, spike do binding |
| `tests/visual/pages.visual` | Início, detalhe, carrinho e pagamento × desktop/mobile/tablet |

Cada teste usa um contexto novo e começa com `?scenario=…&reset=1`. Eventos são disparados por `/api/__mock/emit` e chegam ao app pelo `socket.io-client`; o relógio é controlado com `page.clock` nos testes sensíveis a tempo.

**Baselines visuais:** versionadas em `tests/visual/pages.visual.spec.ts-snapshots/`, uma por plataforma (`-win32` e `-linux`), porque a renderização de fontes muda entre sistemas operacionais. As de Linux foram geradas no runner do CI, fixado em `ubuntu-26.04`. Para regenerar:
- na sua plataforma: `npm run test:e2e:update -- tests/visual`;
- Linux (CI): rode o workflow `e2e` manualmente com `update_snapshots` marcado (`gh workflow run e2e.yml --ref <branch> -f update_snapshots=true`) e baixe o artefato `visual-snapshots`.

### CI

`.github/workflows/e2e.yml` roda em todo push e pull request: `npm ci` → typecheck → lint → testes unitários → `npm run build` + `check:prod-bundle` → `npm run test:e2e`. Relatório e resultados sobem como artefatos.

## Lighthouse

`npm run lighthouse` audita o **build de demonstração** (mocks ativos, igual ao deploy, cenário `default`) com perfil limpo do Chrome a cada execução. A configuração versionada está em `lighthouse/config.mjs`. Medianas de 3 execuções:

| Página | Perfil | Performance | Acessibilidade | Boas práticas | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| `/` | mobile | **70** ⚠ | 100 | 100 | 100 | 5.4 s | 0.000 | 300 ms |
| `/` | desktop | 97 | 100 | 100 | 100 | 1.2 s | 0.002 | 4 ms |
| `/nft/nft_042` | mobile | **75** ⚠ | 100 | 100 | 100 | 5.3 s | 0.001 | 193 ms |
| `/nft/nft_042` | desktop | 97 | 100 | 100 | 100 | 1.3 s | 0.013 | 0 ms |

⚠ = abaixo da meta (Performance 90). **Resultado: abaixo da meta em Performance** no mobile das duas páginas; no desktop as duas páginas ficam em 97. Acessibilidade, Boas práticas e SEO ficam em 100.

A causa principal no mobile é a camada de simulação, que só existe no build de demonstração: o chunk do MSW e do banco simulado (cerca de 180 KB gzip), a espera pela ativação do Service Worker antes do primeiro render e a latência proposital de 150–400 ms por resposta. O elemento de LCP (primeiro card do catálogo) depende de tudo isso. Cortar esses custos só para a auditoria seria uma simplificação proibida pelo enunciado. O TBT varia entre execuções (os valores individuais estão no resumo). Análise completa, execuções individuais, ambiente e relatórios HTML/JSON: [`lighthouse/summary.md`](lighthouse/summary.md) e `lighthouse/reports/`.

## Deploy

Vercel, configurado em `vercel.json`: build `npm run build:demo` (mocks ativos), saída `dist/` e rewrite de SPA para `index.html`. Ficam fora do rewrite os assets, as imagens e o `mockServiceWorker.js`, o que permite acesso direto e refresh em qualquer rota.
