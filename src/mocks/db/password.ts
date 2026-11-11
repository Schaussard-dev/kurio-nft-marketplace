const ITERATIONS = 100_000
const KEY_BITS = 256
const SALT_BYTES = 16

export interface PasswordRecord {
  salt: string
  hash: string
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function derive(plain: string, salt: string): Promise<string> {
  const subtle = globalThis.crypto.subtle
  const key = await subtle.importKey('raw', new TextEncoder().encode(plain), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITERATIONS },
    key,
    KEY_BITS,
  )
  return toHex(new Uint8Array(bits))
}

export async function hashPassword(plain: string, salt?: string): Promise<PasswordRecord> {
  const effectiveSalt = salt ?? toHex(globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES)))
  return { salt: effectiveSalt, hash: await derive(plain, effectiveSalt) }
}

export async function verifyPassword(plain: string, record: PasswordRecord): Promise<boolean> {
  const candidate = await derive(plain, record.salt)
  if (candidate.length !== record.hash.length) return false
  let diff = 0
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ record.hash.charCodeAt(i)
  return diff === 0
}
