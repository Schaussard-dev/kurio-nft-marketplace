// Only same-origin absolute paths are allowed: "/x", never "//host", "/\host" or "scheme:".
export function safeRedirect(raw: unknown, fallback = '/'): string {
  if (typeof raw !== 'string') return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback
  // Reject percent-encoded protocol-relative forms such as /%2F%2Fevil.
  try {
    const decoded = decodeURIComponent(raw)
    if (decoded.startsWith('//') || decoded.startsWith('/\\')) return fallback
  } catch {
    return fallback
  }
  return raw
}
