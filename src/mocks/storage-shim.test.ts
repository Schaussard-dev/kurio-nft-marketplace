import { afterEach, describe, expect, it } from 'vitest'
import { ensureWebStorage } from './storage-shim'

const NAMES = ['localStorage', 'sessionStorage'] as const
const saved = NAMES.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)

afterEach(() => {
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete (globalThis as Record<string, unknown>)[name]
  }
})

describe('ensureWebStorage', () => {
  it('replaces storage that throws on access (blocked site data) with a working in-memory one', () => {
    for (const name of NAMES) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get() {
          throw new DOMException('blocked', 'SecurityError')
        },
      })
    }
    ensureWebStorage()
    for (const name of NAMES) {
      const storage = globalThis[name]
      storage.setItem('k', 'v')
      expect(storage.getItem('k')).toBe('v')
      expect(storage.length).toBe(1)
      expect(storage.key(0)).toBe('k')
      storage.removeItem('k')
      expect(storage.getItem('k')).toBeNull()
    }
  })

  it('leaves working storage untouched', () => {
    const working = { getItem: () => 'kept' } as unknown as Storage
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: working })
    ensureWebStorage()
    expect(globalThis.localStorage).toBe(working)
  })
})
