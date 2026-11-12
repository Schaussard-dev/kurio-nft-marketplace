// Proves a production build (`npm run build`, mocks off) ships no mock code.
// Usage: node scripts/check-prod-bundle.mjs [distDir]   (exit code 1 on any finding)
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const distDir = path.resolve(process.argv[2] ?? 'dist')

/** Markers that only exist in mock code: MSW, its worker, the mock control API and the "Simulação" panel. */
const FORBIDDEN = [
  { label: 'MSW worker script', test: (file) => path.basename(file) === 'mockServiceWorker.js' },
  { label: 'mockServiceWorker reference', text: 'mockServiceWorker' },
  { label: 'MSW runtime', text: '[MSW]' },
  { label: 'MSW socket.io binding', text: '@mswjs' },
  { label: 'mock control API', text: '/api/__mock' },
  { label: 'mock DB storage key', text: 'kurio-mock-db' },
  { label: 'mock panel copy', text: 'Simulação' },
  { label: 'mock panel copy (escaped)', regex: /Simula\\u00e7\\u00e3o/i },
]

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name)
      return entry.isDirectory() ? listFiles(full) : [full]
    }),
  )
  return nested.flat()
}

const TEXT_FILE = /\.(m?js|css|html|json|map|txt|webmanifest|svg)$/i

const files = await listFiles(distDir).catch(() => {
  console.error(`check-prod-bundle: ${distDir} not found, run \`npm run build\` first.`)
  process.exit(1)
})
const findings = []
for (const file of files) {
  const relative = path.relative(distDir, file)
  const content = TEXT_FILE.test(file) ? await readFile(file, 'utf8') : null
  for (const rule of FORBIDDEN) {
    const hit = rule.test
      ? rule.test(file)
      : content !== null && (rule.regex ? rule.regex.test(content) : content.includes(rule.text))
    if (hit) findings.push(`${relative}: ${rule.label}`)
  }
}

if (findings.length > 0) {
  console.error(`check-prod-bundle: mock code found in ${distDir}:\n  ${findings.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-prod-bundle: ${files.length} files in ${distDir}, no mock code shipped.`)
