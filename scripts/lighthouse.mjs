// Lighthouse audit: builds the demo (mocks on), serves it with `vite preview`, audits every page x preset
// RUNS times with a fresh Chrome profile, then writes the reports and lighthouse/summary.md (medians).
// Usage: npm run lighthouse [-- --skip-build] [-- --keep=all|median]
import { spawn } from 'node:child_process'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { computeMedianRun } from 'lighthouse/core/lib/median-run.js'
import {
  BASE_URL,
  CATEGORIES,
  CHROME_FLAGS,
  LIGHTHOUSE_FLAGS,
  PAGES,
  PORT,
  PRESETS,
  RUNS,
  TARGETS,
} from '../lighthouse/config.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const REPORTS_DIR = path.join(ROOT, 'lighthouse', 'reports')
const SUMMARY_PATH = path.join(ROOT, 'lighthouse', 'summary.md')
const MANUAL_START = '<!-- manual:start -->'
const MANUAL_END = '<!-- manual:end -->'

const args = process.argv.slice(2)
const skipBuild = args.includes('--skip-build')
const keep = args.find((a) => a.startsWith('--keep='))?.split('=')[1] ?? 'median'

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd: ROOT, stdio: 'inherit', shell: true, ...options })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))))
  })
}

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`preview did not answer on ${url}`)
}

function startPreview() {
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
  const child = spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  })
  return child
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const score = (lhr, category) => Math.round(lhr.categories[category].score * 100)

async function audit(url, config) {
  const chrome = await chromeLauncher.launch({ chromeFlags: CHROME_FLAGS })
  try {
    const result = await lighthouse(url, { ...LIGHTHOUSE_FLAGS, port: chrome.port }, config)
    if (!result) throw new Error(`no result for ${url}`)
    if (result.lhr.runtimeError) throw new Error(`${url}: ${result.lhr.runtimeError.message}`)
    return result
  } finally {
    await chrome.kill()
  }
}

async function dirSize(dir) {
  let total = 0
  for (const name of await readdir(dir)) total += (await stat(path.join(dir, name))).size
  return total
}

function formatMs(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`
}

async function readManualSection() {
  try {
    const previous = await readFile(SUMMARY_PATH, 'utf8')
    const start = previous.indexOf(MANUAL_START)
    const end = previous.indexOf(MANUAL_END)
    if (start !== -1 && end > start) return previous.slice(start + MANUAL_START.length, end).trim()
  } catch {
    // first run
  }
  return '_Preencher manualmente com as causas de cada mediana abaixo da meta._'
}

function buildSummary(results, env, manual) {
  const lines = []
  lines.push('# Auditoria Lighthouse')
  lines.push('')
  lines.push('Gerado por `npm run lighthouse` (`scripts/lighthouse.mjs`, configuração em `lighthouse/config.mjs`).')
  lines.push(
    `Build de demonstração (\`npm run build:demo\`, mocks MSW ativos, igual ao deploy) servido por \`vite preview\` na porta ${PORT}. ` +
      `${RUNS} execuções por página e perfil, cada uma com perfil limpo do Chrome (primeira visita: o Service Worker da simulação é instalado em toda execução). Valores abaixo são **medianas**.`,
  )
  lines.push('')
  lines.push('## Resultados (medianas)')
  lines.push('')
  lines.push('| Página | Perfil | Performance | Acessibilidade | Boas práticas | SEO | LCP | CLS | TBT |')
  lines.push('|---|---|---|---|---|---|---|---|---|')
  for (const r of results) {
    const cells = CATEGORIES.map((c) => {
      const value = r.medians[c]
      return value < TARGETS[c] ? `**${value}** ⚠` : String(value)
    })
    lines.push(
      `| \`${r.page.path}\` | ${r.preset} | ${cells.join(' | ')} | ${formatMs(r.medians.lcp)} | ${r.medians.cls.toFixed(3)} | ${formatMs(r.medians.tbt)} |`,
    )
  }
  lines.push('')
  lines.push(
    `Metas: Performance ${TARGETS.performance}, Acessibilidade ${TARGETS.accessibility}, Boas práticas ${TARGETS['best-practices']}, SEO ${TARGETS.seo}. ⚠ = mediana abaixo da meta.`,
  )
  lines.push('')
  lines.push('### Execuções individuais')
  lines.push('')
  lines.push('| Página | Perfil | Execução | Perf | A11y | BP | SEO | LCP | CLS | TBT |')
  lines.push('|---|---|---|---|---|---|---|---|---|---|')
  for (const r of results) {
    r.runs.forEach((lhr, i) => {
      const a = lhr.audits
      lines.push(
        `| \`${r.page.path}\` | ${r.preset} | ${i + 1}${i === r.medianIndex ? ' (mediana)' : ''} | ${CATEGORIES.map((c) => score(lhr, c)).join(' | ')} | ${formatMs(a['largest-contentful-paint'].numericValue)} | ${a['cumulative-layout-shift'].numericValue.toFixed(3)} | ${formatMs(a['total-blocking-time'].numericValue)} |`,
      )
    })
  }
  lines.push('')
  lines.push('## Ambiente')
  lines.push('')
  lines.push(`- Data: ${env.date}`)
  lines.push(`- Lighthouse: ${env.lighthouse}`)
  lines.push(`- Chrome: ${env.chrome}`)
  lines.push(`- Node: ${process.version}`)
  lines.push(`- SO: ${env.os}`)
  lines.push(`- CPU: ${env.cpu} (benchmarkIndex mediano do Lighthouse: ${env.benchmarkIndex})`)
  lines.push(
    `- Throttling mobile: simulado (Lantern), RTT ${env.mobile.rttMs} ms, ${Math.round(env.mobile.throughputKbps)} Kbps, CPU ${env.mobile.cpuSlowdownMultiplier}x; emulação de tela ${env.mobileScreen}.`,
  )
  lines.push(
    `- Throttling desktop: simulado (Lantern), RTT ${env.desktop.rttMs} ms, ${Math.round(env.desktop.throughputKbps)} Kbps, CPU ${env.desktop.cpuSlowdownMultiplier}x; emulação de tela ${env.desktopScreen}.`,
  )
  lines.push('')
  lines.push('## Relatórios')
  lines.push('')
  lines.push(
    env.keep === 'all'
      ? 'Todos os relatórios HTML e JSON estão em `lighthouse/reports/` (`<página>-<perfil>-run<n>.report.{html,json}`).'
      : 'Para manter o repositório leve, `lighthouse/reports/` guarda apenas o HTML e o JSON da **execução mediana** de cada página e perfil (`<página>-<perfil>-run<n>.report.{html,json}`); as notas de todas as execuções estão na tabela acima. `npm run lighthouse -- --keep=all` guarda todas.',
  )
  lines.push('')
  lines.push('## Abaixo da meta')
  lines.push('')
  lines.push(MANUAL_START)
  lines.push(manual)
  lines.push(MANUAL_END)
  lines.push('')
  return lines.join('\n')
}

async function main() {
  if (!skipBuild) await run('npm', ['run', 'build:demo'])

  const preview = startPreview()
  const results = []
  try {
    await waitForServer(BASE_URL)
    await rm(REPORTS_DIR, { recursive: true, force: true })
    await mkdir(REPORTS_DIR, { recursive: true })

    for (const page of PAGES) {
      for (const [preset, config] of Object.entries(PRESETS)) {
        const runs = []
        const reports = []
        for (let n = 1; n <= RUNS; n++) {
          const { lhr, report } = await audit(`${BASE_URL}${page.path}`, config)
          console.log(
            `${page.path} ${preset} run ${n}: ${CATEGORIES.map((c) => `${c}=${score(lhr, c)}`).join(' ')} LCP=${formatMs(lhr.audits['largest-contentful-paint'].numericValue)}`,
          )
          runs.push(lhr)
          reports.push(report)
        }
        const medianIndex = runs.indexOf(computeMedianRun(runs))
        for (let i = 0; i < RUNS; i++) {
          if (keep !== 'all' && i !== medianIndex) continue
          const base = path.join(REPORTS_DIR, `${page.slug}-${preset}-run${i + 1}.report`)
          await writeFile(`${base}.html`, reports[i][0])
          await writeFile(`${base}.json`, reports[i][1])
        }
        const medians = Object.fromEntries(CATEGORIES.map((c) => [c, median(runs.map((lhr) => score(lhr, c)))]))
        medians.lcp = median(runs.map((lhr) => lhr.audits['largest-contentful-paint'].numericValue))
        medians.cls = median(runs.map((lhr) => lhr.audits['cumulative-layout-shift'].numericValue))
        medians.tbt = median(runs.map((lhr) => lhr.audits['total-blocking-time'].numericValue))
        results.push({ page, preset, runs, medianIndex, medians })
      }
    }
  } finally {
    preview.kill()
  }

  const all = results.flatMap((r) => r.runs)
  const settingsOf = (preset) => results.find((r) => r.preset === preset).runs[0].configSettings
  const screen = (s) => `${s.screenEmulation.width}x${s.screenEmulation.height} @${s.screenEmulation.deviceScaleFactor}x`
  const env = {
    date: new Date().toISOString(),
    lighthouse: all[0].lighthouseVersion,
    chrome: all[0].environment.hostUserAgent.match(/(?:Headless)?Chrome\/[\d.]+/)?.[0] ?? all[0].environment.hostUserAgent,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: `${os.cpus()[0].model.trim()}, ${os.cpus().length} threads`,
    benchmarkIndex: Math.round(median(all.map((lhr) => lhr.environment.benchmarkIndex))),
    mobile: settingsOf('mobile').throttling,
    desktop: settingsOf('desktop').throttling,
    mobileScreen: screen(settingsOf('mobile')),
    desktopScreen: screen(settingsOf('desktop')),
    keep,
  }
  await writeFile(SUMMARY_PATH, buildSummary(results, env, await readManualSection()))
  console.log(`\nReports: ${(await dirSize(REPORTS_DIR) / 1024 / 1024).toFixed(1)} MB in lighthouse/reports`)
  console.log(`Summary: ${path.relative(ROOT, SUMMARY_PATH)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
