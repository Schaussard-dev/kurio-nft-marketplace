# Plano de revisão final — Kurio

**Objetivo:** última varredura antes da entrega. Achar o que passou nas rodadas anteriores, com evidência, sem corrigir no impulso. Cada achado é registrado primeiro e corrigido depois da triagem.

**Base:** `main` = `feat/kurio-app` = `102d66c` (CI verde, deploy https://kurio-schaussard.vercel.app).

**Fontes da verdade:**
- Enunciado §1–§12: cópia local em `.superpowers/sdd/2026-11-11-kurio-nft-marketplace/qa-tools/challenge.md`.
- Figma `Ff0SksUi7UFtPWUO8kyNtw`:
  - PNGs em `design/figma-exports/{Desktop,Mobile}` (desktop 2880 px = 1440 @2x; mobile 828 px = 414 @2x).
  - Para dúvidas de medida, cor ou texto, abrir o arquivo no Figma pelo Chrome.
- Spec `docs/superpowers/specs/2026-11-11-kurio-nft-marketplace-design.md`, `README.md`, `ARCHITECTURE.md`.
- Relatórios anteriores: `docs/qa/relatorio-testes-exploratorios.md` (QA-01…QA-21).

## Por que coisas passaram antes (e como este plano evita)

| Falha de método nas rodadas anteriores | Como evitar agora |
|---|---|
| Mobile emulado por iframe, sem toque: o banner sem arraste passou | Mobile sempre em contexto Playwright `isMobile + hasTouch`; gestos com eventos de toque reais |
| Checagem só da rolagem do documento: sheets e diálogos (`fixed`) escaparam | Auditoria com recorte (`qa-tools/layout-audit.mjs`) em todos os estados abertos |
| Capturas antes de os dados carregarem | Esperar a API ociosa (`waitForApiIdle`) antes de medir ou capturar |
| Faltou olhar a tela como usuário e comparar com o Figma | Fase visual dedicada, lado a lado com o PNG, por região, nas larguras do Figma |
| Larguras amostradas (390/768/1440) | Matriz de larguras completa (abaixo) |
| Testes manuais só com o caminho feliz de cada controle | Matrizes de combinação (filtros, cenários) e bordas (valores, textos longos) |

## Ambientes e ferramentas
- **Visitante:** deploy público (não exige credenciais).
- **Fluxos logados:** mesmo build em `npm run build:demo && npm run preview` (`localhost:4173`); contas de fixture (Ana, Bruno) só em localhost.
- **Desktop real:** Chrome (Claude in Chrome) a 1440 px.
- **Varreduras e capturas:** Playwright com scripts de `qa-tools/` (ler o `README.md` da pasta).
- **Matriz de larguras:**
  - celular: 320, 360, 375, 390, 414, mais paisagem 844×390;
  - tablet: 768, 1024;
  - desktop: 1280, 1440, 1920;
  - zoom 200%: 1440 → 720 CSS px; 400% → 360.

## Severidade e triagem

| Nível | Definição | Tratamento |
|---|---|---|
| S1 | Item eliminatório (§11) ou fluxo principal quebrado | Corrigir na hora, com teste que reproduz |
| S2 | Função errada, perda de estado, layout quebrado num viewport-alvo, a11y bloqueante | Corrigir com teste |
| S3 | Inconsistência, cópia errada, desvio visível do Figma | Lista para decisão do usuário; corrigir os baratos |
| S4 | Polimento | Registrar |

Cada achado registra ID (`FR-NN`), fase, viewport, passos, esperado × obtido, evidência (captura, console ou rede) e severidade. Saída: `docs/qa/relatorio-revisao-final.md`.

## Fases

### F0 — Preparação (base limpa)
1. `git status` limpo; `main` == `feat` == commit do deploy (`index-*.js` publicado bate com o build local).
2. `npm ci && npm run typecheck && npm run lint && npm run test:unit && npm run build && npm run check:prod-bundle` a partir de um **clone limpo** em pasta temporária (§12: "executar a partir de um checkout limpo").
3. Subir o preview; abrir o Chrome; console e rede monitorados em todas as fases.

### F1 — Rastreabilidade do enunciado (§1–§12)
Montar a matriz **requisito → evidência (código / teste e2e / doc) → status** para cada linha do enunciado:
- §3 telas e bullets;
- §4 os 7 itens de "a solução deve garantir";
- §5 recursos, erros e idempotência (incluindo *mesma chave com conteúdo diferente → 409*);
- §6 os 9 cenários determinísticos e `socket.io-client`;
- §7 eventos, versão, reconexão, cenário do carrinho, queda com pedido pendente;
- §8 itens obrigatórios;
- §9 os 12 itens de teste;
- §10 metas;
- §12 entregáveis.

**Eliminatórios** checados um a um, com evidência:
- stack usada de forma efetiva;
- nenhum fluxo só visual;
- nenhuma compra confirmada sem resposta da simulação;
- nenhum dado vazando entre usuários;
- nenhum evento aplicado direto na UI;
- e2e executáveis.

Lacunas viram achados.

### F2 — Fidelidade ao Figma (o mais pesado: 20 pts)
Para cada frame (desktop: Início, Detalhe, Carrinho, Pagamento, Confirmação, Login, Cadastro, Perfil, Carteiras; mobile: Início, Detalhe, Carrinho, Pagamento, Login, Cadastro), na largura do frame (1440 / 414):
1. Captura da página com o mesmo estado e os mesmos dados do frame (Ana; carrinho do Figma: 2× Emerald, 6× Violet, 9× Ivory). Composição lado a lado e sobreposição com diferença (`sharp`) contra o PNG redimensionado.
2. Checklist por região:
   - textos literais (pt-BR, maiúsculas, pontuação);
   - tipografia (família, tamanho, peso, entrelinha);
   - cores (amostrar pixels de fundo, destaque, bordas, texto secundário contra os tokens);
   - espaçamentos e alinhamentos (grid, gutters, alturas de campos e botões);
   - raios, ícones (forma e tamanho), imagens (recorte e proporção);
   - ordem dos elementos e estados (selecionado, desabilitado, hover).
3. Telas sem frame (Perfil, Carteiras e Confirmação no mobile; tudo no tablet; estados vazio, erro e carregando): conferir que seguem o mesmo padrão visual (§1).
4. Todo desvio intencional precisa estar em `ARCHITECTURE.md` (desvios do Figma). Inclui os da rodada 2: rótulos curtos das abas do detalhe, rodapé do filtro empilhado, nomes em 2 linhas, banner arrastável. Desvio não documentado vira achado.
5. Dúvida de medida ou texto: abrir o nó no Figma (Chrome) e medir lá; não presumir.

### F3 — Responsividade e layout (matriz completa)
1. `layout-audit.mjs` estendido a todas as larguras da matriz e a mais estados:
   - busca mobile aberta;
   - menu do usuário;
   - zoom da galeria;
   - diálogo de login (≥768) e página de login (<768);
   - conexão, revisão, "valor mudou";
   - pagamento recusado e pendente;
   - perfil com erros;
   - carteiras com secundária;
   - 404;
   - painel Simulação;
   - toasts.
2. Conteúdo extremo:
   - nomes, ENS e e-mails longos;
   - carrinho com muitas linhas e quantidades de 2 dígitos;
   - totais grandes (ETH com muitas casas);
   - cupom aplicado;
   - todas as edições esgotadas;
   - catálogo de 1 item;
   - mensagens de erro de 2 linhas.
3. Elementos fixos: a tab bar mobile, a barra de compra e o botão Simulação não podem cobrir conteúdo acionável nem o fim da página (padding inferior). Paisagem 844×390.
4. Alvos de toque ≥24 px (WCAG 2.5.8) e preferencialmente 44 px no mobile; nada só em hover no toque.
5. Gestos: arrastar o banner e os carrosséis; rolar dentro dos sheets sem rolar a página por trás; fechar sheet arrastando ou com Esc.
6. Zoom 200% e 400% (reflow, sem perda de conteúdo).

### F4 — Catálogo, busca e filtros (matriz de combinações)
1. Busca:
   - acento e maiúsculas;
   - espaços nas pontas;
   - caracteres especiais `% ( ) [ ] * ? \ "`;
   - termo de coleção;
   - termo sem resultado;
   - limpar pelo "x" e por "Limpar filtros".
2. Cada filtro sozinho e em combinações (categoria × rede × preço × busca × aba × ordenação). Validar contra a API:
   - os itens exibidos batem com `GET /api/nfts` e os parâmetros enviados;
   - as contagens das facetas somam corretamente;
   - nenhum item fora da faixa.
3. Preço:
   - mínimo = máximo;
   - limites inclusivos;
   - teclado (setas, PageUp/Down);
   - "Aplicar" no mobile;
   - faixa depois de mudar a categoria;
   - sem resultados (QA-06).
4. Ordenação correta **entre páginas** (ordem global, desempate estável). Abas Novos e Em alta × filtros.
5. Paginação:
   - reinicia ao mudar filtro (§3);
   - página fora do intervalo;
   - "…";
   - foco e rolagem após trocar de página.
6. URL:
   - estado completo na URL;
   - F5;
   - voltar/avançar;
   - link colado em aba nova;
   - parâmetros inválidos saneados (QA-07);
   - formato da URL.
7. Respostas fora de ordem: cenário `jitter`, digitar rápido e trocar filtros rápido. O resultado final tem que corresponder ao último estado (§3, §4).
8. Mobile: sheet de filtros (contagem ao vivo, "Ver resultados (N)", badge) e busca do cabeçalho.

### F5 — Cenários MSW (§6)
Para cada cenário (`default`, `empty`, `slow`, `jitter`, `offline`, `server-error`, `favorite-fail`, `session-expired`, `signup-conflict`, `price-change`, `sold-out`, `order-timeout`, `payment-declined`, `wallet-reject`):
- ativar por URL **e** pelo painel;
- percorrer as telas afetadas;
- conferir skeleton com shimmer, feedback de erro e recuperação com "Tentar novamente";
- conferir determinismo (repetir 2×);
- conferir que `reset` restaura **integralmente** (carrinho, favoritos, perfil, carteiras, pedidos, sessão);
- latência personalizada.

Painel: todas as ações, inclusive "Reenviar último evento".

### F6 — Regras de negócio e estado
1. **ETH:**
   - somas com muitas casas e quantidades grandes (sem float);
   - arredondamento e formatação idênticos entre card, detalhe, carrinho, revisão e recibo;
   - total = cotação da API.
2. **Estoque por edição:**
   - detalhe + carrinho + limite por pedido;
   - duas abas adicionando a mesma edição;
   - merge no login acima do estoque (aviso de ajuste).
3. **Cupom:**
   - maiúsculas e espaços;
   - trocar quantidade com cupom aplicado;
   - remover;
   - expirado e inválido;
   - cupom na URL do pagamento.
4. **Pedido:**
   - idempotência (mesma chave e outro conteúdo → 409);
   - clique duplo;
   - reenvio após timeout;
   - voltar do navegador depois da compra;
   - F5 em `/pagamento` durante o envio;
   - recibo imutável após mudança de preço;
   - pedidos terminais não mudam com eventos;
   - compra parcial remove só as quantidades compradas.
5. **Sessão:**
   - F5 mantém o login;
   - expiração ao navegar e no checkout (rascunho restaurado);
   - logout limpa o cache privado e os sockets;
   - troca Ana → Bruno sem vazamento (cache, socket room, rascunho, pedido pendente);
   - guarda das rotas privadas;
   - `redirect` externo ignorado;
   - senha nunca em claro (localStorage e rede).
6. **Formulários** (cadastro, login, perfil, senha, carteiras, pagamento):
   - obrigatórios, formatos e erros da API nos campos;
   - foco no 1º inválido;
   - persistência após F5;
   - envio duplo;
   - "igual à principal".
7. **Ações fora do escopo** (sociais, "Esqueceu a senha?", newsletter, em-breve, compartilhar): não aparentam sucesso (§3).

### F7 — Tempo real (§7)
- `nft.updated` no catálogo, no detalhe e no carrinho (aviso + resumo).
- `order.updated` em pendente → confirmado/recusado.
- Duplicata e evento antigo (reenvio pelo painel) ignorados, sem regressão de versão.
- Evento de outro usuário ignorado.
- Queda e retomada: reconciliação REST com pedido pendente; recarregar sem criar outra compra.
- Listeners liberados: contar conexões e handlers após navegar, logout e login.
- Duas abas: BD e sessão compartilhados, eventos nas duas.

### F8 — Acessibilidade (§8)
- axe em todas as rotas e estados abertos (desktop e mobile).
- Teclado de ponta a ponta (compra, conta, filtros, painel).
- Foco preso e devolvido em todos os diálogos, sheets e menus.
- Foco visível em todo controle.
- Labels e erros ligados (`aria-describedby`).
- Live regions para mutations e tempo real.
- Contraste amostrado (texto secundário, botões desabilitados, placeholders).
- Estados que não dependem só de cor.
- `prefers-reduced-motion`: shimmer, rolagem suave do banner, transições.
- Ordem de títulos.
- Textos alternativos.
- Nome acessível contém o texto visível.

### F9 — Performance e Lighthouse (§10)
A rodada 2 mudou o Início (o banner agora renderiza 3 slides no mobile).
- Refazer 3 medições por página × perfil (Início e detalhe; mobile e desktop) com a configuração versionada.
- Comparar LCP, CLS e TBT com `lighthouse/summary.md`.
- Atualizar o resumo e os relatórios se mudar.
- Investigar regressão de LCP ou CLS.

### F10 — Robustez e console
- Console sem erros ou avisos em todos os fluxos (desktop e mobile).
- Falha de rede no meio de mutations (perfil, carteira, cupom, carrinho).
- Navegação rápida e cancelamentos.
- `localStorage` corrompido ou limpo com a página aberta.
- Armazenamento bloqueado (aba anônima).
- Duas abas com ações concorrentes.
- Rotas com parâmetros malformados (`/nft/%`, `/pedidos/../x`).

### F11 — Documentação e entrega (§12)
1. README:
   - setup, variáveis, credenciais, cenários, reset;
   - comandos e receitas de falha **executadas ao pé da letra**;
   - todos os comandos rodam.
2. ARCHITECTURE: contratos REST e eventos, política de sessão, carrinho, cache e reconciliação batem com o código; desvios do Figma atualizados (rodada 2).
3. Deploy == código entregue (commit); acesso direto e F5 em todas as rotas no deploy; mocks e tempo real funcionando no deploy.
4. Repositório:
   - lockfile, assets, fixtures, configs de auditoria e relatório HTML do Playwright;
   - nenhum segredo (varrer histórico e árvore por tokens, `.env.local`);
   - nada privado (CLAUDE.md fora);
   - `.gitignore` coerente.

### F12 — Revisão de código final (precisa do aval do usuário)
Revisão independente do diff desde a revisão final anterior (commits de QA e mobile) e varredura de pontos frágeis (handlers do mock, hub de tempo real, checkout). Proposta: um revisor subagente no modelo mais capaz. Só roda com o aval do usuário.

## Ordem, pausas e saída
1. F0 → F1 → F2 → F3: **pausa** com resumo dos achados (o bloco visual é o de maior peso).
2. F4 → F5 → F6 → F7: **pausa**.
3. F8 → F9 → F10 → F11 → F12 (com aval): **pausa final** com triagem.

S1/S2 são corrigidos durante a fase (TDD, teste de regressão); S3/S4 vão para a lista de decisão. Depois das correções: unitários + e2e completos + visual, CI verde, deploy, reteste dos achados no deploy, relatório final atualizado e ledger/memória atualizados.

## Critério de pronto
Matriz F1 sem lacunas abertas, nenhum S1/S2 pendente, decisão registrada para cada S3/S4, CI verde, deploy conferido e os documentos refletindo o estado entregue.
