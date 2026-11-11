import { describe, expect, it } from 'vitest'
import { safeRedirect } from './safe-redirect'

describe('safeRedirect', () => {
  it('rejects protocol-relative URLs', () => expect(safeRedirect('//evil.com')).toBe('/'))
  it('rejects absolute URLs', () => expect(safeRedirect('https://evil.com')).toBe('/'))
  it('rejects backslash tricks', () => expect(safeRedirect('/\\evil.com')).toBe('/'))
  it('rejects non-strings', () => expect(safeRedirect(undefined, '/x')).toBe('/x'))
  it('rejects control characters', () => expect(safeRedirect('/a\nb')).toBe('/'))
  it('keeps same-origin paths with query', () => expect(safeRedirect('/pagamento?x=1')).toBe('/pagamento?x=1'))
})
