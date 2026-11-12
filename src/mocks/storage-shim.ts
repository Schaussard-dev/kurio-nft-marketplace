/**
 * With site data blocked, reading `localStorage`/`sessionStorage` throws. MSW reads `localStorage` while
 * its module loads (cookie store), which would stop the whole demo before the first render. The app code
 * already falls back to memory on its own; this shim gives the mock layer the same fallback. It must run
 * before `msw` is imported (see main.tsx) and only exists in demo builds.
 */
class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>()

  get length(): number {
    return this.items.size
  }

  clear(): void {
    this.items.clear()
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }

  setItem(key: string, value: string): void {
    this.items.set(key, String(value))
  }
}

function usable(name: 'localStorage' | 'sessionStorage'): boolean {
  try {
    return globalThis[name] !== undefined
  } catch {
    return false
  }
}

export function ensureWebStorage(): void {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    if (!usable(name)) Object.defineProperty(globalThis, name, { configurable: true, value: new MemoryStorage() })
  }
}
