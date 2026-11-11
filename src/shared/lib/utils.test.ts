/// <reference types="node" />
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { TEXT_SIZES } from '@/styles/text-sizes.generated'
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

describe('TEXT_SIZES', () => {
  it('matches the --text-* font-size tokens in tokens.generated.css', () => {
    const css = readFileSync(path.resolve(import.meta.dirname, '../../styles/tokens.generated.css'), 'utf8')
    const fromCss = [...css.matchAll(/--text-([a-z0-9-]+):/g)].map((m) => m[1]).filter((name) => !name.includes('--')).sort()
    expect([...TEXT_SIZES].sort()).toEqual(fromCss)
  })
})
