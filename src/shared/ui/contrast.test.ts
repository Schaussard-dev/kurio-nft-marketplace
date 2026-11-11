/// <reference types="node" />
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const STYLES_DIR = path.resolve(import.meta.dirname, '../../styles')

function readCss(file: string): string {
  return readFileSync(path.join(STYLES_DIR, file), 'utf8')
}

function parseColors(css: string): Record<string, string> {
  const colors: Record<string, string> = {}
  for (const match of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    colors[match[1]] = match[2]
  }
  return colors
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Generated tokens first; globals.css overrides (a11y deviations) win.
const colors = {
  ...parseColors(readCss('tokens.generated.css')),
  ...parseColors(readCss('globals.css')),
}

const PAIRS: Array<[string, string]> = [
  ['foreground', 'ink'],
  ['foreground', 'surface'],
  ['text-secondary', 'ink'],
  ['text-secondary', 'surface'],
  ['muted', 'surface'],
  ['text-accent', 'ink'],
  ['ink', 'primary'],
]

describe('WCAG contrast of small-text pairs', () => {
  it.each(PAIRS)('%s on %s >= 4.5:1', (fg, bg) => {
    expect(colors[fg], `missing token ${fg}`).toBeDefined()
    expect(colors[bg], `missing token ${bg}`).toBeDefined()
    expect(ratio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5)
  })
})
