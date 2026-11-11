// Reads the Figma file and writes:
//   - src/styles/tokens.generated.css  (committed; builds never need the token)
//   - design/raw/img-<ref>.png         (gitignored raw artwork)
//   - public/icons/*.svg               (custom vector marks that lucide-react lacks)
// The access token lives only in .env.local (raw line or FIGMA_TOKEN=...). It is never logged.
import fs from 'node:fs'
import path from 'node:path'

const FILE_KEY = 'Ff0SksUi7UFtPWUO8kyNtw'
const API = 'https://api.figma.com/v1'
const ROOT = path.resolve(import.meta.dirname, '..')

const COLOR_STYLES = {
  'Color/Ink': 'ink',
  'Color/Surface Card': 'surface',
  'Color/Surface Raised': 'surface-2',
  'Color/Surface Dark': 'band',
  'Color/Primary': 'primary',
  'Color/Primary Light': 'primary-light',
  'Color/Primary Dark': 'primary-dark',
  'Text/Accent': 'text-accent',
  'Text/Secondary': 'text-secondary',
  'Color/Secondary': 'muted',
  'Color/Foreground': 'foreground',
  'Color/Border': 'border',
  'Color/Border Soft': 'border-strong',
  'Color/Amber': 'amber',
  'Color/Success': 'success',
}
// Error/asterisk coral is drawn as a raw fill (no named style) in the file.
const DANGER_HEX = '#F0805F'

const TEXT_FAMILIES = {
  Display: 'display',
  Heading: 'heading',
  Title: 'title',
  'Body Large': 'body-lg',
  Body: 'body',
  Caption: 'caption',
  Tiny: 'tiny',
}

// Vector marks exported as SVG (node id -> file name).
const ICON_NODES = {
  '11:5150': 'thank-you',
  'I70484:260;70483:242': 'google',
  'I70484:240;70483:259': 'facebook',
  'I70492:696;70491:1270': 'social-facebook',
  'I70492:696;70491:1272': 'social-instagram',
  'I70492:696;70491:1274': 'social-twitter',
}

function readToken() {
  const raw = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  const line = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#'))
  if (!line) throw new Error('.env.local is empty')
  const match = line.match(/^[A-Z_][A-Z0-9_]*=(.*)$/)
  return (match ? match[1] : line).replace(/^["']|["']$/g, '').trim()
}

const TOKEN = readToken()

async function figma(endpoint) {
  const res = await fetch(`${API}${endpoint}`, { headers: { 'X-Figma-Token': TOKEN } })
  if (!res.ok) throw new Error(`Figma API ${res.status} on ${endpoint.split('?')[0]}`)
  return res.json()
}

const toHex = (c) =>
  '#' +
  [c.r, c.g, c.b]
    .map((v) => Math.round(v * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

function walk(node, visit) {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

function resolveColors(file) {
  const byStyleId = {}
  walk(file.document, (n) => {
    for (const [kind, styleId] of Object.entries(n.styles ?? {})) {
      if (byStyleId[styleId] || (kind !== 'fill' && kind !== 'stroke')) continue
      const paints = kind === 'fill' ? n.fills : n.strokes
      const solid = paints?.find((p) => p.type === 'SOLID')
      if (solid) byStyleId[styleId] = toHex(solid.color)
    }
  })
  const colors = {}
  for (const [id, style] of Object.entries(file.styles)) {
    const token = COLOR_STYLES[style.name]
    if (!token) continue
    const value = byStyleId[id] ?? style.description.match(/#[0-9A-Fa-f]{6}/)?.[0]?.toUpperCase()
    if (!value) throw new Error(`No value for color style ${style.name}`)
    colors[token] = value
  }
  let dangerFound = false
  walk(file.document, (n) => {
    for (const p of [...(n.fills ?? []), ...(n.strokes ?? [])]) {
      if (p.type === 'SOLID' && toHex(p.color) === DANGER_HEX) dangerFound = true
    }
  })
  if (!dangerFound) throw new Error('danger coral not found in file')
  colors.danger = DANGER_HEX
  return colors
}

function resolveTypography(file) {
  const measured = {}
  walk(file.document, (n) => {
    const id = n.styles?.text
    if (n.type !== 'TEXT' || !id || measured[id]) return
    const s = n.style
    measured[id] = {
      weight: s.fontWeight,
      lineHeight: Math.round((s.lineHeightPx ?? s.fontSize) * 100) / 100,
      letterSpacing: Math.round((s.letterSpacing ?? 0) * 100) / 100,
    }
  })
  // Group Figma text styles by family + size; the most used style gives the defaults.
  const groups = {}
  for (const [id, style] of Object.entries(file.styles)) {
    if (style.styleType !== 'TEXT' || !measured[id]) continue
    const [familyName, rest] = style.name.split('/')
    const family = TEXT_FAMILIES[familyName]
    const size = Number(rest.match(/^\d+/)?.[0])
    if (!family || !size) continue
    const uses = Number(style.description.match(/usos:\s*(\d+)/)?.[1] ?? 0)
    const key = `${family}-${size}`
    const g = (groups[key] ??= { family, size, uses: 0, best: null, weights: new Set() })
    g.uses += uses
    g.weights.add(measured[id].weight)
    if (!g.best || uses > g.best.uses) g.best = { uses, ...measured[id] }
  }
  return groups
}

function textSizeNames(groups) {
  const names = new Set()
  const best = {}
  for (const [key, g] of Object.entries(groups)) {
    names.add(key)
    if (!best[g.family] || g.uses > best[g.family].uses) best[g.family] = g
  }
  for (const family of Object.keys(best)) names.add(family)
  return [...names]
}

function typographyCss(groups) {
  const lines = []
  const aliasSource = {}
  const px = (n) => `${Math.round(n * 100) / 100}px`
  const emit = (name, g) => {
    lines.push(`  --text-${name}: ${px(g.size)};`)
    lines.push(`  --text-${name}--line-height: ${px(g.best.lineHeight)};`)
    lines.push(`  --text-${name}--letter-spacing: ${px(g.best.letterSpacing)};`)
    // Weight is baked in only when every Figma style of that size shares it.
    if (g.weights.size === 1) lines.push(`  --text-${name}--font-weight: ${g.best.weight};`)
  }
  const sorted = Object.entries(groups).sort(
    ([, a], [, b]) => a.family.localeCompare(b.family) || b.size - a.size,
  )
  for (const [key, g] of sorted) {
    emit(key, g)
    if (!aliasSource[g.family] || g.uses > aliasSource[g.family].uses) aliasSource[g.family] = g
  }
  lines.push('')
  lines.push('  /* Aliases: most used size of each Figma family */')
  for (const [family, g] of Object.entries(aliasSource)) emit(family, g)
  return lines.join('\n')
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed (${res.status}) for ${path.basename(dest)}`)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

async function main() {
  const file = await figma(`/files/${FILE_KEY}`)
  const colors = resolveColors(file)
  const groups = resolveTypography(file)

  const css = [
    '/* GENERATED by scripts/figma-tokens.mjs from the Figma file. Do not edit by hand. */',
    '@theme {',
    ...Object.entries(colors).map(([name, hex]) => `  --color-${name}: ${hex};`),
    '',
    '  --font-sans: "Roboto Mono", ui-monospace, SFMono-Regular, Menlo, monospace;',
    '  --font-mono: "Roboto Mono", ui-monospace, SFMono-Regular, Menlo, monospace;',
    '',
    typographyCss(groups),
    '}',
    '',
  ].join('\n')
  fs.writeFileSync(path.join(ROOT, 'src', 'styles', 'tokens.generated.css'), css)
  const sizes = textSizeNames(groups).sort()
  fs.writeFileSync(
    path.join(ROOT, 'src', 'styles', 'text-sizes.generated.ts'),
    [
      '// GENERATED by scripts/figma-tokens.mjs. Do not edit by hand.',
      '// Names of the --text-* font-size tokens; consumed by cn() (twMerge config).',
      `export const TEXT_SIZES = ${JSON.stringify(sizes, null, 2).replace(/"/g, "'")} as const`,
      '',
    ].join('\n'),
  )
  console.log(`tokens: ${Object.keys(colors).length} colors, ${Object.keys(groups).length} text sizes`)

  const { meta } = await figma(`/files/${FILE_KEY}/images`)
  const rawDir = path.join(ROOT, 'design', 'raw')
  for (const [ref, url] of Object.entries(meta.images)) {
    await download(url, path.join(rawDir, `img-${ref}.png`))
  }
  console.log(`images: ${Object.keys(meta.images).length} fills downloaded to design/raw`)

  const ids = Object.keys(ICON_NODES)
  const svgs = await figma(`/images/${FILE_KEY}?ids=${encodeURIComponent(ids.join(','))}&format=svg`)
  for (const [id, name] of Object.entries(ICON_NODES)) {
    const url = svgs.images[id]
    if (!url) throw new Error(`no SVG render for ${name}`)
    await download(url, path.join(ROOT, 'public', 'icons', `${name}.svg`))
  }
  console.log(`icons: ${ids.length} SVGs written to public/icons`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
