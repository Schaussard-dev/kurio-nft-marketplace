# Relatório da revisão final — Kurio

Plano: [`plano-revisao-final.md`](plano-revisao-final.md). Base: `main` = `102d66c` (deploy), revisão iniciada em 2026-11-12.

## F0 — Preparação

| Verificação | Resultado |
|---|---|
| Clone limpo de `main` (102d66c): `npm ci`, typecheck, lint, 325 testes unitários, `build`, `check:prod-bundle` | ok (nenhum código de mock no build de produção) |
| Bundle publicado × build de demonstração local × clone limpo | idênticos (`index-Bu-aCVnC.js`) |

## F1 — Rastreabilidade do enunciado

Os 12 itens do §9 têm spec e2e nomeada (`tests/e2e/01…13`, `shell`, `mock-control`, `realtime-spike`). §5: conflito de idempotência (mesma chave e outro conteúdo → 409 `IDEMPOTENCY_CONFLICT`) coberto em `src/mocks/handlers/orders.test.ts`. 403 de pedido de outra conta tratado como 404. §6: 14 cenários em `src/mocks/scenarios.ts`. §9: relógio controlado (`page.clock`) em 07, 10 e spike; relatório HTML e `trace: 'retain-on-failure'`. Eliminatórios: sem lacuna.

| ID | Sev. | Achado |
|---|---|---|
| FR-01 | S3 | `ARCHITECTURE.md` (desvios do Figma) não registra as mudanças da rodada 2: banner arrastável com pontos maiores, rodapé do filtro empilhado, rótulos curtos das abas do detalhe no mobile, nomes em 2 linhas nos cards. |

## F2 — Fidelidade ao Figma

Método: captura de cada frame no estado do Figma (Ana; carrinho Emerald ×2, Violet ×6, Ivory ×9) a 1440 e 414 px, composição lado a lado e **comparação automática texto a texto** entre o JSON do arquivo Figma (API) e o DOM renderizado (tamanho, peso, decoração e posição de cada texto).

| ID | Sev. | Achado | Evidência |
|---|---|---|---|
| FR-02 | S3 | Container desktop `max-w-[1200px] px-4`: o conteúdo útil tem 1168 px a partir de x=136; no Figma, 1200 px a partir de x=120. Tudo fica 16 px para dentro e 32 px mais estreito, o que quebra linhas que no Figma cabem ("Arte digital selecionada e muito mais" em 3 linhas, "Carteiras compatíveis" em 2). | KURIO 120→136; cards 478/770/1062 → 494/775/1057 |
| FR-03 | S3 | Escala tipográfica acima do Figma em quase todas as telas, sempre com o token certo já disponível. Exemplos: navegação e "Entrar" 16→15 (este também com peso 500→700); rodapé 18→20; destaques da newsletter 17→20 e 14→15; "Enviar" 18→15; carrinho e pagamento 16→17, 15→17, 17→20, 14→15; título do Perfil 16→28; "Alterar senha" 16/500→22/700; login mobile "KURIO" 32→44, título 20→24, botões sociais 13/500→15/700; pagamento mobile "Carteira conectada" 16→20 (quebra em 2 linhas), "Total:" 16→22. Nada disso está documentado. | saída do comparador por frame |
| FR-04 | S3 | Campos e botões de formulário com 56 px de altura; no Figma, 40 px (Perfil, Carteiras, Pagamento, cupom do Carrinho com 46). As telas de conta ficam quase com o dobro da altura. | Figma `Rectangle 59…` h=40 r=3 |
| FR-05 | S3 | Subtítulo de Carteiras ("Estas carteiras ficam disponíveis…") na cor de destaque (#E89B55); no Figma, secundária (#CFB28C). | figma `fill=#cfb28c` |
| FR-06 | S4 | Perfil e Carteiras: o Figma não tem rodapé nessas telas e marca o item ativo da barra lateral com contorno laranja; o app mostra rodapé e marca o ativo com fundo. | frames de 1080 px de altura |
| FR-07 | S3 | O botão flutuante "Simulação" cobre conteúdo no mobile: a descrição do detalhe, o campo de cupom do carrinho, a carteira "Coinbase Wallet" no pagamento e "Continuar com Facebook" no login e no cadastro. | capturas a 414 px |
| FR-08 | S4 | Preço anterior do card ("2.29 ETH") riscado no app; no Figma, sem risco (só a cor secundária). Pontos do banner desktop espaçados 28 px; no Figma, 16 px. | `textDecoration` ausente no nó |

## F3 — Responsividade e layout

Método: `layout-audit2` em 13 viewports (320, 360, 375, 390 e 414 com toque; paisagem 844×390; 768, 1024, 1280, 1440, 1920; zoom 200% = 720×450 e 400% = 360×225) × 28 estados (sheets, diálogos, revisão, recibo, erros de formulário, menu, painel, 404). Checa overflow do documento, elementos fora da tela ou cortados, controles cobertos por elementos fixos (no fim da página e nos estados sem rolagem) e alvos de toque abaixo de 24 px, já descontada a exceção de espaçamento do WCAG 2.5.8. Conteúdo extremo em 320, 390, 768 e 1440: nome de 60 caracteres, ENS longo, carrinho com 8 linhas de 12 unidades, total de 4 dígitos e cupom.

Resultado: 315 de 354 estados limpos; nenhum overflow horizontal em nenhuma largura, nem com zoom de 200% e 400%; conteúdo extremo sem quebra. Login e cadastro em paisagem (844×390) rolam dentro do diálogo e o botão de envio é alcançável (falso positivo da cobertura). Controles revelados por hover só se escondem com `@media (hover:hover)`.

| ID | Sev. | Achado |
|---|---|---|
| FR-07 | S3 | (confirmado) O botão "Simulação" cobre controles: o "−" de uma linha do carrinho a 320 px, um card na busca aberta (320/390) e "Voltar ao catálogo" do 404 com zoom de 400%. |
| FR-09 | S3 | Botão "Fechar" de todos os diálogos e sheets (`dialog.tsx`, `sheet.tsx`) é o ícone de 16×16 px, sem área de toque e com 70% de opacidade; no sheet de filtros (320–375) e no zoom da galeria em paisagem fica a menos de 12 px de outro alvo (falha do WCAG 2.5.8). O "Fechar" do painel Simulação também. |
| FR-10 | S4 | Alvos pequenos e próximos: "EXPLORAR" do banner mobile (90×20, junto aos pontos), "Continuar explorando" do carrinho (16 px de altura, junto ao botão principal), "Esqueceu a senha?" em paisagem. |
| FR-11 | S4 | A 320 px o banner mobile quebra o título em 4 linhas e a linha "Desconto do lançamento" do resumo em 3 quando o desconto tem 3 dígitos. |

## F4 — Catálogo, busca e filtros

Método: oráculo independente sobre os 60 NFTs (lista completa pela API) em 39 combinações. As combinações cruzam busca (acento, maiúsculas, espaços nas pontas, `% ( [ * ? \ "`, coleção, termo sem resultado), cada categoria, redes, preço (mínimo, máximo, mínimo = máximo), abas, as quatro ordenações e combinações. Para cada uma, comparo total, ids e ordem **percorrendo todas as páginas**, contagens das facetas e a grade renderizada da página 1. Depois testo a interação: reinício da página, paginação (foco, rolagem, "…"), slider pelo teclado, faixa após mudar a categoria, sem resultados, limpar pelo "x" e por "Limpar filtros", cliques rápidos com `jitter`, sheet do mobile com `slow` e formato da URL.

Resultado:
- API, facetas e grade batem com o oráculo em todos os casos.
- A ordem global é estável entre páginas, sem repetição, e os limites de preço são inclusivos.
- Os filtros reiniciam a página.
- Na paginação, o foco fica no link e a rolagem volta ao topo do catálogo.
- Com `jitter`, o resultado final corresponde à última combinação.
- `page`, `sort` e `tab` inválidos caem no padrão.
- Os e2e `01-catalog` passam em desktop e mobile.

| ID | Sev. | Achado |
|---|---|---|
| FR-12 | S3 | Os search params estão em JSON, o formato padrão do TanStack Router. Por isso as URLs do próprio app ficam `?maxPrice=%2212.00%22&categories=%5B%22arte-digital%22%5D`, e um link escrito à mão ou compartilhado com valor numérico perde o filtro sem aviso: `/?minPrice=3.62`, `/?maxPrice=1` e `/?q=42` mostram o catálogo inteiro. Os links gerados pelo app funcionam (F5, voltar e avançar). |
| FR-13 | S4 | No sheet de filtros (mobile), ao marcar uma coleção, "Ver resultados (N)" continua com o total anterior até a resposta chegar: 2,5 s em `slow`, 150–400 ms no padrão. O usuário toca em "(60)" e vê 5. |
| FR-14 | S4 | O botão "Filtros" do mobile mostra a quantidade de filtros ativos só no badge visual (`aria-hidden`); o nome acessível continua "Filtros". |
| FR-15 | S4 | Com zero resultados, a faixa de preço mostra "Preço: 0,00 - 0,00 ETH" e desabilita o slider, mesmo com um preço máximo aplicado na URL. |

## F5 — Cenários MSW

Método:
- `offline`, `server-error`, `slow` e `empty` em todas as telas (catálogo, detalhe, carrinho, pagamento, perfil, carteiras, favoritos), logado como Ana, com linha do tempo a 0,5/1,5/3/5/8/12 s e "Tentar novamente" depois de voltar ao `default`.
- `reset` depois de alterar carrinho, favoritos e perfil: comparação com o snapshot do seed.
- Latência fixa.
- Ativação e reset pelo painel.

Os demais cenários já têm e2e dedicado (`03`, `04`, `07`, `09`, `mock-control`).

Resultado:
- Toda tela mostra skeleton e depois erro com "Tentar novamente" (após as 2 retentativas automáticas, cerca de 3–5 s), e a recuperação funciona.
- `empty` mostra os estados vazios (catálogo, carrinho, pagamento, favoritos) e "NFT não encontrado".
- `reset` restaura o seed por inteiro e encerra a sessão antiga (401).

| ID | Sev. | Achado |
|---|---|---|
| FR-16 | S3 | Carga direta ou recarga de rota privada (`/pagamento`, `/perfil`, `/perfil/carteiras`, `/perfil/favoritos`) deixa a página **inteira em branco**, sem cabeçalho nem skeleton, enquanto a sessão é verificada. São 2,5–5 s em `slow` e 150–400 ms no padrão. Causa: `_authenticated.beforeLoad` espera `/api/me` sem `pendingComponent` (só o detalhe tem). |
| FR-17 | S4 | `/pagamento` com perfil, carteiras e carrinho falhando: "Tentar novamente" refaz só perfil e carteiras; aparece então o erro do carrinho e é preciso um segundo clique. |
| FR-18 | S4 | Painel Simulação: a latência fixa sobrevive ao Reset e à recarga (fica no `sessionStorage`), mas o campo "Latência (ms)" volta vazio, parecendo "latência do cenário". Trocar o cenário pelo painel faz reseed e **encerra a sessão**; o README diz "reseed", mas não avisa que é preciso entrar de novo. |

## F6 — Regras de negócio e estado

Método:
- **ETH:** preço com 18 casas (`0.123456789012345678` × 7) e quantidades 3 e 7, conferidos em card, detalhe, linha, resumo, pagamento, revisão e recibo.
- **Cupom:** `" kurio10 "`, `KURIO 10`, `KURIO10!`; quantidade alterada com o cupom aplicado; cupom levado ao pagamento; código desconhecido na URL do pagamento.
- **Pedido:** recibo após mudança de preço; voltar e avançar depois da compra.
- **Armazenamento:** `localStorage` e `sessionStorage`.
- **Formulários:** guardas de envio duplo.

O restante tem e2e (`03`, `05`, `06`, `07`, `08`).

Resultado:
- Os valores são exatos (sem float) e idênticos em todas as telas; o total é a cotação da API.
- O cupom é normalizado; formatos inválidos dão "Cupom inválido" no campo; o desconto acompanha a quantidade e o cupom segue para o pagamento.
- O recibo não muda com evento de preço.
- Voltar depois da compra leva ao pagamento sem reabrir a revisão nem criar outro pedido (1 pedido).
- A senha nunca fica no armazenamento.
- Todos os botões de envio desabilitam durante o envio.

Nenhum achado.

## F7 — Tempo real

Método:
- 18 navegações, mais logout/login Ana → Bruno → Ana sem recarregar, e depois `nft.updated` de um NFT do carrinho.
- Duas abas no mesmo navegador.
- Leitura de `RealtimeProvider`: cada troca de sessão remove todos os listeners do socket e do Manager e desconecta; uma geração descarta conexões atrasadas.
- E2E `09` e `10` em desktop e mobile, cobrindo duplicata, evento antigo, queda e retomada, pedido pendente após recarga e evento de outro usuário.

Resultado:
- Um único toast por evento depois de toda a rotatividade (sem listeners acumulados).
- Na segunda aba, sessão e banco são compartilhados e o logout reflete na hora; o evento não cruza abas e aparece no próximo refetch, como o README documenta.
- 40/40 e2e de catálogo e tempo real passam.

Nenhum achado.

## F8 — Acessibilidade

Método: axe com WCAG 2.0/2.1/2.2 A e AA, `best-practice` e `label-content-name-mismatch`, a 1440 e a 390 px, nos estados abertos:
- sheet de filtros, catálogo vazio, página além da última, zoom da galeria;
- 404 do NFT e da rota;
- erros de cadastro, login, cupom e perfil;
- painel Simulação, menu da conta;
- diálogos de conexão e de revisão.

Também fiz:
- caminhada com Tab por Início, detalhe, carrinho, perfil, carteiras e pagamento (349 paradas), verificando `:focus-visible` com contorno ou anel;
- contraste calculado dos placeholders e do texto secundário;
- `prefers-reduced-motion` emulado.

O e2e `11-a11y-keyboard` já cobre as rotas, a compra só pelo teclado e o foco nos diálogos.

Resultado:
- axe limpo em todos os estados, exceto o menu da conta.
- Todas as 349 paradas de foco têm indicador visível.
- Contraste entre 5,2:1 e 8,7:1 (placeholder `#B39463` no pior fundo, `#38220F`).
- Com movimento reduzido, o shimmer, a barra de progresso e a rolagem do banner param.

| ID | Sev. | Achado |
|---|---|---|
| FR-19 | S4 | Menu da conta aberto: o Radix marca o resto da página com `aria-hidden` (modal), o que gera `aria-hidden-focus` e deixa a página sem `main` e `h1` para o leitor de tela enquanto o menu está aberto. O foco do teclado não sai do menu, então o impacto prático é pequeno. |
| FR-20 | S4 | Com `prefers-reduced-motion`, sheets e diálogos continuam com a animação de entrada e saída (o sheet desliza por 0,5 s). |

## F9 — Performance e Lighthouse

`npm run lighthouse` (3 execuções × página × perfil), comparado com o `lighthouse/summary.md` versionado:

| Página | Perfil | Perf (versionado → agora) | LCP | CLS | TBT |
|---|---|---|---|---|---|
| `/` | mobile | 70 → 68 | 5,4 → 5,5 s | 0,019 → 0,019 | 277 → 319 ms |
| `/` | desktop | 97 → 97 | 1,2 → 1,2 s | 0,002 → 0,002 | 1 → 25 ms |
| `/nft/nft_042` | mobile | 76 → 71 | 5,3 → 5,4 s | 0,003 → 0,003 | 209 → 366 ms |
| `/nft/nft_042` | desktop | 89 → 97 | 1,3 → 1,3 s | 0,003 → 0,003 | 218 → 0 ms |

LCP e CLS ficaram iguais: a rodada 2 (banner com 3 slides) não trouxe regressão. As diferenças de Performance vêm só do TBT, que já variava entre execuções. Acessibilidade, Boas práticas e SEO seguem em 100. Os relatórios versionados não foram alterados; a medição será refeita depois do pacote de correções.

## F10 — Robustez e console

Método:
- URLs malformadas e hostis: `%`, `..`, 3000 caracteres, `q` inválido, `cupom=%00`, `redirect` com `javascript:`, `//evil.com` e `https://evil.com`.
- 24 navegações rápidas com `jitter`.
- `kurio-session` corrompido, `localStorage` limpo com a página aberta, `guest-cart-id` hostil.
- Falha de rede no meio das mutations: quantidade, cupom, perfil, carteira (503) e favorito.
- Armazenamento que lança exceção, como no Chrome com "bloquear dados de sites".
- Console capturado em tudo.

Resultado:
- Nenhum erro ou aviso no console nos fluxos.
- Os redirects externos são ignorados.
- Nas mutations com rede caindo, a quantidade e o favorito voltam ao valor anterior, perfil e carteira mantêm o que foi digitado com toast de erro, e o cupom mostra "Não foi possível calcular o resumo".
- Sessão corrompida leva a `/entrar`.
- Navegação rápida termina na última tela, com os dados certos.
- `/nft/%` e `/pedidos/%E0%A4%A` nunca chegam ao app: a Vercel responde 400 (o `vite preview`, 404) antes do SPA.

| ID | Sev. | Achado |
|---|---|---|
| FR-21 | S4 | Com o armazenamento bloqueado, a demonstração (deploy) fica **em branco**. A causa é `src/mocks/db/store.ts:28`: `'localStorage' in globalThis ? globalThis.localStorage : …` acessa o getter, que lança. O código do app já tem fallback em memória (`session-storage.ts`); o problema está só na camada de mocks. |

## F11 — Documentação e entrega

- **README:** todos os `npm run` citados existem. Todas as ações `mock('emit', …)` citadas estão registradas. As receitas de falha correspondem a e2e que passam (`01`, `03`, `05`, `07`, `09`, `10`, `12`).
- **ARCHITECTURE:** os 30 endpoints da tabela batem com os handlers. Falta só registrar os desvios do Figma da rodada 2 (FR-01).
- **Deploy:**
  - O bundle `index-Bu-aCVnC.js` é o mesmo do build de `main` (102d66c).
  - Todas as rotas respondem 200 em acesso direto (SPA rewrite), inclusive `/mockServiceWorker.js`.
  - Contra o deploy, `smoke`, `shell`, `01-catalog`, `mock-control` e o card em tempo real passam: 43/43, desktop e mobile.
- **Repositório:**
  - `package-lock.json` versionado.
  - Nenhum token no histórico inteiro (padrões `figd_`, `ghp_`, `AKIA`, `sk-`, `xox`, `FIGMA_TOKEN=valor`); `.env.local` nunca foi commitado; só `.env.development` e `.env.example`, ambos sem segredos.
  - `.gitignore` coerente; `.superpowers/` se ignora sozinho.
  - O `CLAUDE.md` aparece no histórico (adicionado em 75cd9bb e removido em 596c4a9), sem segredo. Fica no histórico por decisão anterior de não reescrevê-lo.

## Correções (pacote aprovado)

Cada correção de comportamento tem um teste que falhou antes e passou depois. A tipografia foi conferida com o comparador Figma × DOM nos 15 frames.

| ID | Status | Como | Commit |
|---|---|---|---|
| FR-01 | documentado | Desvios da rodada 2 no `ARCHITECTURE.md` | 05b2a4b |
| FR-02 | corrigido | Container de 1200 px úteis a partir de x=120 (`max-w-[1232px] px-4`) | 0f61cda |
| FR-03 | corrigido | Escala do Figma em cabeçalho, rodapé, catálogo, detalhe, carrinho, pagamento, recibo, perfil, carteiras e login/cadastro (desktop e mobile). As diferenças que restam no comparador são casamentos falsos ou inconsistências entre frames do próprio Figma (peso das abas) | 0f61cda…3c9d5e5 |
| FR-04 | corrigido | Campos e botões de perfil, carteiras e pagamento com 40 px e raio de 3 px; cupom com 40 px | 6188a0b, 7273426 |
| FR-05 | corrigido | Subtítulo de Carteiras na cor secundária | 7273426 |
| FR-06 | documentado | Rodapé e item ativo com fundo mantidos | 05b2a4b |
| FR-07 | corrigido | No celular, "Simulação" vira um ícone de 40 px, com espaço reservado sob o conteúdo; e2e: não cobre nenhum controle no fim do carrinho a 320 px | 2ce8ecc |
| FR-08 | documentado | Preço anterior riscado (não depende só de cor); pontos do hero com 28 px | 05b2a4b |
| FR-09 | corrigido | "Fechar" de diálogos e sheets com 32×32 px e opacidade total (e2e) | 19b0ee7 |
| FR-10, FR-11 | documentado | Mantidos conforme o Figma | 05b2a4b |
| FR-12 | corrigido | Query string simples em todas as rotas; links antigos em JSON continuam válidos (unit + e2e) | 2bf2576 |
| FR-13 | corrigido | "Ver resultados" sem a contagem antiga enquanto a nova carrega (e2e) | 12fa267 |
| FR-14 | corrigido | Nome do botão "Filtros, N ativos" (e2e) | 19b0ee7 |
| FR-15 | corrigido | Sem resultados, a faixa mostra o preço aplicado ("até 11,50 ETH") (unit) | 12fa267 |
| FR-16 | corrigido | `pendingComponent` nas rotas privadas: cabeçalho e skeleton durante a verificação da sessão (e2e) | 8910603 |
| FR-17 | corrigido | Um único "Tentar novamente" refaz perfil, carteiras e carrinho (e2e) | 12fa267 |
| FR-18 | corrigido | O campo de latência mostra a latência fixa em vigor; o README avisa que trocar o cenário encerra a sessão (e2e) | 2ce8ecc |
| FR-19 | corrigido | Menu da conta não modal: axe limpo com o menu aberto (e2e) | 19b0ee7 |
| FR-20 | corrigido | Com movimento reduzido, sheets e diálogos aparecem sem animação (e2e) | 19b0ee7 |
| FR-21 | corrigido | A causa real era o cookie store do MSW lendo `localStorage` ao carregar (não `store.ts`, como o F10 supôs). Um shim de armazenamento em memória roda antes do MSW (unit + sonda) | 2ce8ecc |

## Varredura final (revisões independentes)

Três revisões independentes, uma por agente: código (`102d66c..2f96209` mais o código inteiro), responsividade (26 tamanhos de tela de 320 a 2560 px, celular deitado, zoom de 200% e 400%, espaçamento de texto da WCAG 1.4.12, troca de orientação, conteúdo extremo) e fidelidade ao Figma (15 frames: geometria, cores, raios, alturas de linha, textos). Resultado: nenhum item eliminatório; 1 S1 e 4 S2 de responsividade; 2 S2 de Figma; 2 achados importantes de código.

| Grupo | Achados | Status |
|---|---|---|
| Bloqueio de compra | RS-01: a revisão do pedido não cabia em celulares deitados nem com zoom de 400% | corrigido: todo diálogo tem altura máxima e rola (e2e `14-responsive`) |
| Layout | RS-02 (valores cortados na revisão a 320–390 px), RS-03 (avisos sobre a barra de compra), RS-04 (barra do catálogo a 1024 px), RS-05 (barras fixas com zoom de 400%), RS-08 (página pulando ao carregar), RS-09 (número do token escondido a 320 px), RS-10 (títulos encostados), RS-11 (pontos do hero), RS-12 (formulário de pagamento a 1024 px), RS-13 (tabela do carrinho), RS-14 (nomes extremos), RS-17/FG-02 (cartão da imagem), RS-18 (área segura do iOS), RS-21 | corrigidos (e2e `14-responsive`, `12`, `13`) |
| Figma | FG-01 (primeira tela do NFT no celular), FG-03, FG-07, FG-08, FG-09, FG-10 (margem de 24 px no celular), FG-11 (hero mobile), FG-12, FG-14, FG-15, FG-21, FG-23, FG-33, links do rodapé | corrigidos e conferidos com capturas lado a lado |
| Código | CR-01 ("Entrar" do cabeçalho volta à página de origem), CR-02 (busca com aspas preservada), CR-03/04 (checkout resiste a falha em segundo plano), CR-10 (painel guarda o ID do evento), CR-11 (aviso de preço formatado) | corrigidos (e2e `03`, `shell`; unitários) |
| Decisões documentadas | FG-06, FG-13, FG-16, FG-08 (recibo como página), stepper de 28x40, "4,8", alvos entre 24 e 44 px, fonte em px, RS-07 | em `ARCHITECTURE.md`, "Desvios do Figma" |
| Registrados (S4) | CR-05 a CR-09, CR-12, CR-13, RS-15, RS-16, RS-19, RS-20 e os S4 de Figma não listados acima | sem mudança |

Verificação: typecheck, lint e 345 unitários verdes; e2e completo em blocos (desktop, mobile e spike), com duas regressões pegas e corrigidas no caminho (avisos no topo cobrindo botões e altura do esqueleto dos cards); `layout-audit2` em 320–1440 sem estouro horizontal nem elemento fora da tela.

**Reteste no deploy (2026-11-12):** `main` = `fe53819`, publicado em https://kurio-schaussard.vercel.app com o mesmo bundle do build local (`index-hYK56n3b.js`). Contra o deploy: `smoke`, `shell`, `01-catalog` e `mock-control` em desktop e mobile (48/48) e os testes de visitante de `14-responsive` (5/5). CI verde em `fe53819`. Lighthouse: a nova medição sob carga da máquina oscilou muito; num A/B intercalado com o build anterior à varredura, o TBT ficou igual ou melhor, então o resumo versionado foi mantido.
