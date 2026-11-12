/**
 * Plain query strings for every route (`?categories=a&categories=b&maxPrice=12.00`), instead of the
 * router default that JSON-encodes values (`?maxPrice=%2212.00%22`). Values are always read as strings
 * (or string arrays for repeated keys): route schemas coerce them, so a hand-written or shared link with
 * `?minPrice=3.62` or `?q=42` means what it says.
 */

/** A value in the old format: a JSON string ("…") or a JSON array ([…]). */
const LEGACY_JSON = /^(".*"|\[.*\])$/s

/** Links shared before this format carried JSON strings/arrays; decode those, keep anything else as typed. */
function readLegacyJson(value: string): string | string[] {
  if (!LEGACY_JSON.test(value)) return value
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed === 'string') return parsed
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) return parsed
  } catch {
    // Not JSON after all: the text stays as typed.
  }
  return value
}

export function parseSearch(search: string): Record<string, unknown> {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const out: Record<string, unknown> = {}
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key).flatMap(readLegacyJson)
    out[key] = values.length > 1 ? values : values[0]
  }
  return out
}

export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === '') continue
    for (const item of Array.isArray(value) ? value : [value]) {
      const text = String(item)
      // Text that would read as the old JSON format is written JSON-encoded, so it comes back exactly as typed.
      params.append(key, LEGACY_JSON.test(text) ? JSON.stringify(text) : text)
    }
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}
