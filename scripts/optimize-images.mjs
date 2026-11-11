// Turns the raw Figma artwork (design/raw, gitignored) into AVIF + WebP at 3 widths.
// Output is committed to public/nfts/<art>-<width>.{avif,webp}.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const RAW_DIR = path.join(ROOT, 'design', 'raw')
const OUT_DIR = path.join(ROOT, 'public', 'nfts')
const WIDTHS = [320, 640, 1024]

// Figma image ref -> art key (identified visually after download).
// The two remaining refs (4d2a4afd..., 5f31b06e...) are an unrelated game screenshot, not used in the design.
const ART_REFS = {
  emerald: '8459204731e6eba9d474cbc8ebc37071360d3ba5',
  sage: '2986a7cb16d09de8970824d2dd58bf0bb021702c',
  ivory: '9df2ff42dd27ba657621c304557d1a855a4be6a5',
  golden: '87580f2def9af0ce13f4b6f6ce17bb2449bcfc16',
}

fs.mkdirSync(OUT_DIR, { recursive: true })

for (const [key, ref] of Object.entries(ART_REFS)) {
  const input = path.join(RAW_DIR, `img-${ref}.png`)
  if (!fs.existsSync(input)) throw new Error(`missing raw image for ${key}: run scripts/figma-tokens.mjs first`)
  for (const width of WIDTHS) {
    const base = sharp(input).resize({ width, height: width, fit: 'cover' })
    await base.clone().avif({ quality: 55, effort: 6 }).toFile(path.join(OUT_DIR, `${key}-${width}.avif`))
    await base.clone().webp({ quality: 78 }).toFile(path.join(OUT_DIR, `${key}-${width}.webp`))
  }
  console.log(`optimized ${key}`)
}
