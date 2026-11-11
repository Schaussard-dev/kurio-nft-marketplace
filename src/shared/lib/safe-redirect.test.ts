import { describe, expect, it } from 'vitest'
import { safeRedirect } from './safe-redirect'

describe('safeRedirect', () => {
  it('rejects protocol-relative URLs', () => expect(safeRedirect('//evil.com')).toBe('/'))
  it('rejects absolute URLs', () => expect(safeRedirect('https://evil.com')).toBe('/'))
  it('rejects backslash tricks', () => expect(safeRedirect('/\\evil.com')).toBe('/'))
  it('rejects non-strings', () => expect(safeRedirect(undefined, '/x')).toBe('/x'))
  it('rejects control characters', () => expect(safeRedirect('/a\nb')).toBe('/'))
  it('rejects encoded protocol-relative', () => expect(safeRedirect('/%2F%2Fevil')).toBe('/'))
  it('rejects javascript: scheme', () => expect(safeRedirect('javascript:alert(1)')).toBe('/'))
  it('rejects tab and newline smuggling', () => {
    expect(safeRedirect('/\t/evil.com')).toBe('/')
    expect(safeRedirect('/\n/evil.com')).toBe('/')
  })
  it('keeps same-origin paths with query', () => expect(safeRedirect('/pagamento?x=1')).toBe('/pagamento?x=1'))
})
