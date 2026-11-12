# Plano de testes exploratórios — Kurio (deploy público)

**Alvo:** https://kurio-schaussard.vercel.app (build `build:demo`, MSW no navegador)
**Ferramenta:** Chrome real (Claude in Chrome), sessão limpa por bloco; console e rede monitorados em todos os passos.
**Viewports:** Desktop 1440×900 · Mobile 390×844 (emulação de janela) · Tablet 768×1024 (amostragem visual).
**Referências:** enunciado §1–§12, spec, Figma (`design/figma-exports`), README (cenários e fluxos de falha).

## Critérios de severidade

| Nível | Definição | Exemplo |
|---|---|---|
| S1 Bloqueante | Fluxo principal quebra ou viola item eliminatório (§3/§6) | compra não conclui, dado falso, ação fora de escopo "funciona" |
| S2 Grave | Funcionalidade errada com contorno difícil, perda de estado, a11y bloqueante | carrinho perde item, foco preso, valor errado |
| S3 Moderado | Comportamento inconsistente, cópia errada, layout quebrado em um viewport | overflow, texto em inglês, toast duplicado |
| S4 Cosmético | Desvio visual pequeno do Figma, polimento | espaçamento, alinhamento |

Cada achado registra: ID, viewport, passos, esperado × obtido, evidência (screenshot/console/rede), severidade.

## Pré-checagens (todas as rotas)
- P1 Console sem erros/warnings inesperados no boot (exceto logs do MSW).
- P2 Acesso direto + F5 em `/`, `/nft/nft_042`, `/carrinho`, `/entrar`, `/cadastro`, `/pagamento`, `/perfil`, `/perfil/carteiras`, `/perfil/favoritos`, `/pedidos/x`, `/em-breve`, `/rota-inexistente`.
- P3 Título da aba, favicon, skip link, h1 único, idioma pt-BR.

## Blocos de teste

### B1 Catálogo (Início)
Busca (acentos, vazia, sem resultado), filtros combinados (categoria × rede × preço), ordenação, abas (Todos/Novos/Em alta), paginação, histórico (voltar/avançar), F5 mantém estado, URL limpa, skeleton, cenário `empty`, `slow`, `server-error`, `offline` + "Tentar novamente", hero (slides, teclado), cards (hover/foco, RARO, preço anterior), favoritar como visitante, ações do card.

### B2 Detalhe do NFT
Acesso direto, NFT inexistente, galeria + zoom (Esc, foco), edições (esgotada desabilitada), quantidade (limites, "Máximo de N"), COMPRAR → carrinho, favoritar, abas de detalhes/avaliações, "Mais desta coleção", mobile (barra de compra fixa, voltar).

### B3 Autenticação
Cadastro (validação vazia, foco no 1º inválido, e-mail/usuário duplicados), login (senha errada, sucesso), diálogo ≥768 × página no mobile, fechar diálogo (Esc/X, retorno de foco), redirect após login, `?redirect=https://externo` ignorado, sessão expirada (painel) → aviso e retorno, logout, troca de usuário Ana → Bruno sem vazamento, sociais/"Esqueceu a senha?" honestos.

### B4 Favoritos
Toggle otimista, persistência após F5, lista em `/perfil/favoritos`, cenário `favorite-fail` (rollback + toast), clique duplo rápido, isolamento entre usuários.

### B5 Carrinho
Visitante adiciona itens, F5 mantém, + / − / limite de estoque ("Apenas N disponíveis"), remover (anúncio), cupons (`XYZ` inválido, `LANCAMENTO24` expirado, `KURIO10`, remover), valores = cotação da API, merge no login (Ana com Sage Nomad), contador no cabeçalho, carrinho vazio, "Conectar e finalizar" como visitante.

### B6 Checkout e pedidos
Pré-preenchimento, validação, carteira cadastrada × manual, Bruno sem carteira (estado vazio + cadastrar), conectar (`wallet-reject` + tentar de novo), revisão (total = cotação), enviar (clique duplo = 1 pedido), pendente → confirmado (recibo do snapshot), `payment-declined`, `order-timeout` (+ Verificar pedido, mesmo pedido), `price-change`/QUOTE_STALE, `sold-out`, desconectar carteira durante a revisão, sessão expirada no checkout (rascunho restaurado), banner de pedido pendente após F5, pedido de outro usuário → "Pedido não encontrado", recibo inalterado após mudança de preço, "Ver no explorador".

### B7 Perfil e carteiras
Editar nome (persistência, espaços em branco), usuário duplicado, avatar (válido, >2 MB, formato inválido), senha (atual errada, sucesso, login com nova), itens fora de escopo → `/em-breve`, carteiras (vazio, obrigatórios, endereço por rede, ENS opcional fora da Ethereum, secundária "igual à principal" acompanha edição).

### B8 Tempo real
Painel: alterar preço (carrinho, catálogo, detalhe; aviso + toast fora do carrinho), esgotar edição, derrubar/restaurar conexão ("Reconectando…", reconciliação), reenviar evento antigo (ignorado), duas abas (BD compartilhado, sessão sincronizada).

### B9 Acessibilidade e responsividade
Navegação só por teclado no fluxo de compra, foco visível, diálogos/drawers prendem e devolvem foco, leitores (anúncios de live region via DOM), zoom 200%, `prefers-reduced-motion`, sem rolagem horizontal em 390/768/1440, tab bar mobile, alvos de toque ≥ 44px.

### B10 Fidelidade visual (amostragem)
Comparar Início, Detalhe, Carrinho, Pagamento, Perfil, Carteiras, Confirmação com os PNGs do Figma (desktop e mobile); registrar desvios não documentados no README/ARCHITECTURE.

## Execução e saída
1. Rodar B1→B10 no desktop, depois B1→B9 no mobile (390×844).
2. Registrar achados em `docs/qa/relatorio-testes-exploratorios.md` (tabela por severidade + evidências).
3. Triagem: S1/S2 corrigidos com teste automatizado que reproduz; S3 corrigidos se baratos; S4 listados.
4. Correções → CI verde → deploy automático → reteste dos achados no deploy (regressão).
