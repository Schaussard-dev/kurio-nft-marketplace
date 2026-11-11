// Generates the avatar fixtures used by tests/e2e/08-profile-wallets.spec.ts (deterministic).
// avatar.png: small 64x64 gradient. (The >2 MB case is built in memory by the spec.)
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

