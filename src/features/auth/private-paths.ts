/** Path prefixes guarded by `src/routes/_authenticated` (keep in sync with the files under it). */
export const PRIVATE_PREFIXES = ['/perfil', '/pagamento', '/pedidos'] as const

/** True for a path (optionally with search/hash) that needs a session. */
export function isPrivatePath(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0]
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
