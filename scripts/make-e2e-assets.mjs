// Generates the avatar fixtures used by tests/e2e/08-profile-wallets.spec.ts (deterministic).
// avatar.png: small 64x64 gradient. big.png: seeded noise PNG just over 2 MB (does not compress).
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const dir = new URL('../tests/e2e/assets/', import.meta.url)
await mkdir(dir, { recursive: true })

const size = 64
const small = Buffer.alloc(size * size * 3)
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 3
    small[i] = 210 - x
    small[i + 1] = 138 - y
    small[i + 2] = 76
  }
}
await sharp(small, { raw: { width: size, height: size, channels: 3 } }).png().toFile(fileURLToPath(new URL('avatar.png', dir)))

const side = 860
const noise = Buffer.alloc(side * side * 3)
let seed = 123456789
for (let i = 0; i < noise.length; i++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  noise[i] = seed >>> 24
}
await sharp(noise, { raw: { width: side, height: side, channels: 3 } })
  .png({ compressionLevel: 1 })
  .toFile(fileURLToPath(new URL('big.png', dir)))
