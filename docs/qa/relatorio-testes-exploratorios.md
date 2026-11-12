# Relatório de testes exploratórios — Kurio

**Data:** 12/11/2026 · **Plano:** `docs/qa/plano-de-testes-exploratorios.md` · **Ferramenta:** Chrome real (Claude in Chrome)

**Ambientes:**
- Deploy público https://kurio-schaussard.vercel.app: pré-checagens e B1 (visitante).
- Mesmo build (`npm run build:demo` + `npm run preview`, `localhost:4173`) para tudo que exige login. As contas de teste dos fixtures não foram digitadas no domínio público.

**Mobile:** 390 px emulado por iframe da mesma origem; a janela do Chrome não pôde ser redimensionada.

## Resumo

| Severidade | Qtde |
|---|---|
| S1 Bloqueante | 0 |
| S2 Grave | 0 |
| S3 Moderado | 5 |
| S4 Cosmético | 9 |

Nenhum fluxo principal quebrou. Funcionaram:
- Compra feliz e todos os cenários de falha (`payment-declined`, `price-change`/QUOTE_STALE, `sold-out`, `order-timeout` com recuperação do mesmo pedido, `wallet-reject` + retry, carteira desconectada na revisão).
- Sessão expirada no checkout, com rascunho restaurado.
- Merge do carrinho no login e isolamento entre usuários.
- Favoritos com rollback, perfil, avatar, senha e carteiras.
- Tempo real: preço ao vivo, esgotar edição, queda e retorno da conexão.

## Achados

### S3 — Moderado

| ID | Viewport | Onde | Passos | Esperado × obtido |
|---|---|---|---|---|
| QA-01 | todos | Título da aba | Abrir `/entrar`, `/cadastro`, `/perfil`, `/perfil/carteiras`, `/perfil/favoritos`, `/pedidos/:id`, `/em-breve`, rota 404 | Título descritivo por página (WCAG 2.4.2), como já ocorre em detalhe, carrinho e pagamento. **Obtido:** sempre "Kurio — Marketplace de NFTs". |
| QA-02 | todos | `aria-current` | Em `/?page=3`, inspecionar a paginação, o cabeçalho e o rodapé | Só a página atual com `aria-current="page"`. **Obtido:** o TanStack Router força `aria-current="page"` em todo `Link` ativo por correspondência parcial de search/path, e isso sobrescreve a prop explícita. Leitores de tela anunciam como atuais "Página 1" (em qualquer página), o logo, "Início", "Mercado" e "EXPLORAR" em `/`, e "Meu perfil" (rodapé) em `/perfil/*`. Visualmente está correto. |
| QA-03 | todos | Painel Simulação | `/?scenario=server-error&reset=1`, abrir o painel | O seletor mostra o cenário ativo. **Obtido:** mostra "Padrão" (estado próprio em `sessionStorage`); "Reset" e "Aplicar" latência enviam `default` e trocam o cenário em silêncio. Isso afeta quem segue as receitas do README. |
| QA-04 | todos | Recibo do pedido | Comprar com a carteira Reserva (Polygon) | Rótulo do explorador coerente com a rede. **Obtido:** "Transação confirmada na Polygon" seguido de "Ver no Etherscan". O link aponta para o explorador fictício. |
| QA-05 | todos | Detalhe do NFT | Bruno com Golden Beat no carrinho; painel → esgotar edição | Aviso de edição esgotada. **Obtido:** todas as edições "Esgotada", COMPRAR desabilitado e a dica diz "Você já tem 1 no carrinho; máximo de 1 por pedido". `purchaseHint` não considera estoque 0. |

### S4 — Cosmético / polimento

| ID | Onde | Observação |
|---|---|---|
| QA-06 | Filtro de preço | Sem resultados, a faixa vira "0,00 - 0,00 ETH" com slider colapsado. |
| QA-07 | URL do catálogo | `categories=["foo"]` é aceito e devolve lista vazia, sem sanear (page/sort/minPrice inválidos são saneados). |
| QA-08 | Erro do catálogo | 503 mostra "Verifique sua conexão e tente novamente." (cópia de rede para erro de servidor). |
| QA-09 | Foco | Após "Tentar novamente" com sucesso, e após Esc no diálogo aberto por URL direta, o foco vai para `body`. |
| QA-10 | Login | E-mail vazio mostra "E-mail inválido" em vez de "Campo obrigatório". |
| QA-11 | Avatar | PNG corrompido mostra "Não foi possível enviar a imagem. Tente novamente." (repetir não resolve). |
| QA-12 | Pagamento | `sold-out` mostra dois avisos redundantes ("Ajuste as quantidades…" e "Alguns itens não têm mais estoque…"). |
| QA-13 | Pagamento | "Confirmar novo valor" (QUOTE_STALE) volta à revisão e exige um segundo "Enviar pedido". |
| QA-14 | Pagamento | Sem carteira e sem rede escolhida (Bruno), a taxa de rede já aparece como 0.016 ETH. |

## Verificado sem achados
- **P1–P3:** console limpo (só ruído da extensão); acesso direto e F5 em todas as rotas; rotas privadas redirecionam com `redirect`; h1 único; `lang=pt-BR`; skip link.
- **B1:** busca sem acento, sem resultado, "Limpar filtros"; filtros combinados e contagens por faceta; ordenação; abas; paginação; voltar/avançar; F5 mantém estado; `page=99` mostra "Esta busca tem 7 páginas"; `server-error` + "Tentar novamente"; hero; ações do card; favoritar como visitante abre o login.
- **B2:** galeria; edições (esgotada desabilitada); quantidade e "Máximo de N por pedido"; COMPRAR leva ao carrinho; botão de compra fixo no mobile.
- **B3:** validação com foco no 1º inválido; senha errada; duplicados (409) no cadastro; Esc fecha; redirect após login; sessão expirada com aviso; logout; Ana → Bruno sem vazamento.
- **B4:** otimista; rollback com toast em `favorite-fail`; três cliques rápidos ficam consistentes com o BD; persistência após F5; lista vazia do Bruno.
- **B5:** visitante adiciona; limite de estoque desabilita o +; remoção anunciada; cupons `XYZ`, `LANCAMENTO24`, `kurio10` (case-insensitive), cupom na URL; merge Ana (Sage Nomad + itens do visitante); total = cotação.
- **B6:**
  - troca de carteira atualiza rede, tipo, ENS e taxa;
  - clique duplo gera 1 pedido;
  - pendente → confirmado, com o carrinho esvaziado;
  - falhas: `payment-declined`, `price-change`, `sold-out`, `order-timeout` (sem duplicar pedido), `wallet-reject` + retry;
  - desconectar a carteira na revisão; faixa de pedido pendente; pedido de outro usuário → "Pedido não encontrado";
  - rascunho restaurado após expiração.
- **B7:** nome em branco, usuário e e-mail duplicados; avatar >2 MB, formato inválido e válido (cabeçalho atualiza); senha: obrigatórios, não coincidem, atual errada, política; carteira com endereço inválido para a rede.
- **B8:** preço ao vivo no carrinho (aviso) e no detalhe (toast); esgotar edição; queda ("Reconectando…" após 1,5 s) e "Conexão restabelecida".
- **B9 (parcial):** sem rolagem horizontal do documento a 371–390 px em todas as rotas; overflow só dentro de faixas roláveis.

## Não coberto nesta rodada
- Duas abas reais (sincronização de BD e sessão).
- Reenvio de evento antigo pelo painel.
- Navegação só por teclado no fluxo inteiro, zoom 200 %, `prefers-reduced-motion`.
- Tablet 768 px.
- Comparação manual com os PNGs do Figma (B10).

Esses itens já têm cobertura automatizada: specs e2e de realtime, a11y (axe) e regressão visual em 3 viewports.

## Correções (triagem)

| ID | Correção | Teste que reproduz |
|---|---|---|
| QA-01 | Hook `useDocumentTitle` ("<página> · Kurio") em todas as páginas; os três `useEffect` existentes migraram para ele | `tests/e2e/shell.spec.ts` › tab titles (rotas públicas e privadas) |
| QA-02 | `activeOptions`: `exact` na paginação e nos links para `/perfil`; `includeHash` nos links para `#catalogo` | `tests/e2e/shell.spec.ts` › aria-current |
| QA-03 | O painel lê o cenário da config do mock (fonte da verdade) ao montar e ao abrir; o estado do painel guarda só a confirmação pós-reseed | `tests/e2e/shell.spec.ts` › mock panel … (QA-03) |
| QA-04 | `explorerLinkLabel(network)`: "Ver no Etherscan" (Figma) na Ethereum, Polygonscan e Solscan nas outras redes | `src/features/orders/explorer.test.ts` + asserções em `06-purchase.spec.ts` |
| QA-05 | `purchaseHint` recebe o estoque da edição; estoque 0 → "Edição indisponível" mesmo com unidades no carrinho | `src/features/nft/purchase-hint.test.ts` |
| QA-08 | `loadErrorHint(error)`: "Verifique sua conexão…" só para NETWORK/TIMEOUT; erro do servidor → "O serviço está instável no momento…" | `src/shared/api/api-error.test.ts` |
| QA-10 | `emailSchema` = obrigatório → formato: vazio diz "Campo obrigatório" em todos os formulários | `src/shared/contracts/contracts.test.ts` |

S4 mantidos como registro: QA-06, QA-07, QA-09, QA-11, QA-12, QA-13 e QA-14.

## Rodada 2 — ajuste mobile (achados do usuário em celular real)

A 1ª rodada não pegou estes casos por dois motivos: o mobile era emulado por iframe, sem toque, e a checagem só olhava a rolagem do documento. Sheets e diálogos (`position: fixed`) escapavam dessa checagem, e parte das telas foi capturada antes de os dados carregarem. A nova auditoria cobre 25 estados (sheets, diálogos, revisão, recibo, painel) em 320/360/375/390/414 px com toque emulado. Para cada elemento visível, ela considera o retângulo de recorte dos ancestrais e acusa o que sai da tela ou é cortado sem reticências.

| ID | Sev. | Problema | Causa | Correção |
|---|---|---|---|---|
| QA-15 | S2 | Banner não arrasta; só os pontos (24 px) trocam o slide | Só o slide ativo era renderizado; nenhum gesto | Trilho com `scroll-snap` abaixo de 1024 px (arraste nativo com inércia, pontos sincronizados com a rolagem, slides fora da tela `inert`); área de toque dos pontos 44 px de altura no espaçamento do Figma; desktop inalterado |
| QA-16 | S2 | Rodapé do filtro ("Limpar filtros" / "Ver resultados") sai da tela em 320–390 px | `flex-1` + `whitespace-nowrap` + `min-width: auto`: os dois rótulos (~380 px) não cabem em ~350 px | Ações empilhadas em largura total, principal em cima |
| QA-17 | S2 | Carrinho com cupom estica a página (até 401 px em 360) | Rótulo e valor do resumo com `nowrap` | Rótulo quebra linha (`min-w-0`), valor não encolhe; `gap-2` mantém uma linha no desktop (antes transbordava 1 px) |
| QA-18 | S3 | Abas do catálogo cortadas ("Em al…") abaixo de 414 px | Lista rolável com barra oculta: o corte parecia defeito | Fonte e espaçamento fluidos (`clamp`) abaixo de `md`: os três rótulos do Figma cabem de 320 px em diante |
| QA-19 | S3 | Abas do detalhe cortadas ("Avaliações de colecion…") | Rótulos longos (adição nossa; o Figma mobile não tem abas) | "Detalhes" / "Avaliações (19)" visíveis no mobile; o nome acessível mantém o rótulo completo (WCAG 2.5.3) |
| QA-20 | S3 | Nomes dos cards truncados ("Emerald Ape …") | `truncate` numa coluna de ~150 px | `line-clamp-2`: o nome inteiro em até 2 linhas, como no Figma |
| QA-21 | S4 | "Mais desta coleção" / "Colecionadores também viram" começam colados na borda | `snap-start` encaixa na borda do contêiner sangrado (`-mx-4`), não no gutter | `scroll-px-4` |

**Regressão:** `tests/e2e/13-mobile-fit.spec.ts` (filtro, abas, nomes, arraste do banner com eventos de toque, carrossel no gutter, resumo do carrinho, em 320/360/390/414 px). Baselines visuais mobile regeneradas (diferenças conferidas uma a uma); desktop e tablet inalterados.
