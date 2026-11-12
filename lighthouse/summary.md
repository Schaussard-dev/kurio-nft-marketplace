# Auditoria Lighthouse

Gerado por `npm run lighthouse` (`scripts/lighthouse.mjs`, configuração em `lighthouse/config.mjs`).
Build de demonstração (`npm run build:demo`, mocks MSW ativos, igual ao deploy) servido por `vite preview` na porta 4173. 3 execuções por página e perfil, cada uma com perfil limpo do Chrome (primeira visita: o Service Worker da simulação é instalado em toda execução). Valores abaixo são **medianas**.

## Resultados (medianas)

| Página | Perfil | Performance | Acessibilidade | Boas práticas | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| `/` | mobile | **70** ⚠ | 100 | 100 | 100 | 5.4 s | 0.000 | 300 ms |
| `/` | desktop | 97 | 100 | 100 | 100 | 1.2 s | 0.002 | 4 ms |
| `/nft/nft_042` | mobile | **75** ⚠ | 100 | 100 | 100 | 5.3 s | 0.001 | 193 ms |
| `/nft/nft_042` | desktop | 97 | 100 | 100 | 100 | 1.3 s | 0.013 | 0 ms |

Metas: Performance 90, Acessibilidade 95, Boas práticas 95, SEO 90. ⚠ = mediana abaixo da meta.

### Execuções individuais

| Página | Perfil | Execução | Perf | A11y | BP | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|---|
| `/` | mobile | 1 | 67 | 100 | 100 | 100 | 5.4 s | 0.000 | 367 ms |
| `/` | mobile | 2 | 71 | 100 | 100 | 100 | 5.5 s | 0.000 | 270 ms |
| `/` | mobile | 3 (mediana) | 70 | 100 | 100 | 100 | 5.4 s | 0.000 | 300 ms |
| `/` | desktop | 1 (mediana) | 97 | 100 | 100 | 100 | 1.2 s | 0.002 | 4 ms |
| `/` | desktop | 2 | 97 | 100 | 100 | 100 | 1.2 s | 0.002 | 1 ms |
| `/` | desktop | 3 | 97 | 100 | 100 | 100 | 1.2 s | 0.002 | 31 ms |
| `/nft/nft_042` | mobile | 1 (mediana) | 75 | 100 | 100 | 100 | 5.4 s | 0.001 | 182 ms |
| `/nft/nft_042` | mobile | 2 | 75 | 100 | 100 | 100 | 5.3 s | 0.001 | 193 ms |
| `/nft/nft_042` | mobile | 3 | 74 | 100 | 100 | 100 | 5.3 s | 0.001 | 229 ms |
| `/nft/nft_042` | desktop | 1 (mediana) | 97 | 100 | 100 | 100 | 1.3 s | 0.013 | 0 ms |
| `/nft/nft_042` | desktop | 2 | 96 | 100 | 100 | 100 | 1.4 s | 0.013 | 0 ms |
| `/nft/nft_042` | desktop | 3 | 97 | 100 | 100 | 100 | 1.3 s | 0.013 | 0 ms |

## Ambiente

- Data: 2026-11-12T21:38:31.830Z
- Lighthouse: 13.6.0
- Chrome: HeadlessChrome/157.0.0.0
- Node: v22.22.2
- SO: Windows_NT 10.0.26200 (x64)
- CPU: 12th Gen Intel(R) Core(TM) i7-1255U, 12 threads (benchmarkIndex mediano do Lighthouse: 2846)
- Throttling mobile: simulado (Lantern), RTT 150 ms, 1638 Kbps, CPU 4x; emulação de tela 412x823 @1.75x.
- Throttling desktop: simulado (Lantern), RTT 40 ms, 10240 Kbps, CPU 1x; emulação de tela 1350x940 @1x.

## Relatórios

Para manter o repositório leve, `lighthouse/reports/` guarda apenas o HTML e o JSON da **execução mediana** de cada página e perfil (`<página>-<perfil>-run<n>.report.{html,json}`); as notas de todas as execuções estão na tabela acima. `npm run lighthouse -- --keep=all` guarda todas.

## Abaixo da meta

<!-- manual:start -->
Acessibilidade, Boas práticas e SEO ficam em 100 nas quatro combinações. Só Performance fica abaixo da meta: no mobile das duas páginas e, por um ponto, no desktop do Detalhe.

### Performance mobile (`/` 70, `/nft/nft_042` 76)

O LCP simulado fica em 5,3 a 5,4 s. Medido sem throttling, na mesma máquina, ele fica em cerca de 1,0 s. O tempo vem de três custos da **camada de simulação**, que só existem no build de demonstração:

1. **Chunk da simulação (só na demo).** O MSW, o binding de Socket.IO e o banco simulado somam 176 KB gzip (483 KB sem compressão). Desse total, ~260 KB sem compressão são dependências do próprio MSW para cookies (`tldts`, `tough-cookie`), que a aplicação não usa. O Lighthouse aponta ~73 KB desse chunk como JS não usado. No 4G lento simulado (1,6 Mbps) e com CPU 4x mais lenta, só baixar e executar esse chunk já custa segundos.
2. **Espera pelo worker.** A aplicação só monta depois que o Service Worker do MSW está ativo. Sem essa espera, as primeiras requisições escapariam da simulação e cairiam no servidor estático. O Lighthouse audita com storage limpo, então o worker é instalado em toda execução: é o pior caso, a primeira visita.
3. **Latência planejada.** Cada resposta simulada leva 150 a 400 ms (cenário `default`), de propósito, para que estados de carregamento e reconciliação sejam reais. No mobile da Início, o elemento de LCP é o primeiro card do catálogo (174×174 px, maior que a arte do hero com 140 px). Ele depende de JS, depois do worker e depois de `GET /api/nfts` antes de existir.

Um build com backend real (`npm run build`, mocks desligados) não carrega nada disso. O `check:prod-bundle` prova que esse build não inclui código de simulação. Reduzir esses custos só para a auditoria, por exemplo cortando a latência, renderizando sem esperar o worker ou injetando dados falsos no HTML, seria uma simplificação proibida pelo desafio (§6, §10).

**O que foi feito, sem atalhos:**
- o chunk da simulação passou a ter `modulepreload` no HTML (só no build de demonstração) e baixa em paralelo com a entrada;
- os chunks da rota inicial carregam enquanto a simulação sobe;
- o preload da arte do hero vale só para `/`;
- a primeira linha de cards do catálogo não usa mais `loading="lazy"`;
- foram adicionados favicon e `robots.txt`. Boas práticas e SEO foram de 96/92 para 100/100.

**Avaliado e descartado:** um "app shell" estático no `index.html`, com o hero pintado antes do JS. Medindo os candidatos a LCP na Início mobile, a arte do hero (19.600 px²) pinta em ~330 ms, mas o LCP final é o primeiro card do catálogo (30.276 px², ~780 ms), que depende dos dados da API. O shell anteciparia só o FCP, não o LCP, e duplicaria o layout do cabeçalho e do hero no HTML com risco de CLS. Não compensava.

### Performance desktop do Detalhe (89; execuções 84 / 97 / 89)

LCP (1,3 s) e CLS (0,003) ficam estáveis nas três execuções. A nota varia só pelo TBT (0 a 308 ms), com tarefas longas que o Lighthouse marca como "Unattributable", sem script de origem. A máquina é um notebook (i7-1255U) que rodou a auditoria logo depois da suíte E2E. Em uma rodada anterior, com o mesmo código antes da última alteração (cards sem `lazy`, que não afeta o Detalhe), as execuções deram 80 / 98 / 98, mediana 98. Tratamos a variação como ruído da máquina, mas registramos a mediana real desta rodada.

**Observação:** `lighthouse/reports/` guarda a execução mediana escolhida pelo próprio Lighthouse (`computeMedianRun`, por FCP e TTI). Por isso o relatório salvo do Detalhe desktop é a execução 2 (97), enquanto a mediana por categoria da tabela é 89.
<!-- manual:end -->
