import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('keeps a Figma text-size utility next to a text color', () => {
    expect(cn('text-body-15 text-primary-foreground')).toBe('text-body-15 text-primary-foreground')
  })

  it('still lets a later size override an earlier one', () => {
    expect(cn('text-body-15', 'text-display')).toBe('text-display')
  })
})
