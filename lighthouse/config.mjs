// Versioned Lighthouse audit configuration (read by scripts/lighthouse.mjs).
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

export const PORT = 4173
export const BASE_URL = `http://localhost:${PORT}`

/** Pages audited: the home (catalog + hero LCP) and one NFT detail page. */
export const PAGES = [
  { slug: 'home', path: '/' },
  { slug: 'nft-detail', path: '/nft/nft_042' },
]

/**
 * mobile: Lighthouse defaults (Moto G Power emulation, simulated slow 4G + 4x CPU slowdown).
 * desktop: Lighthouse's own desktop preset (1350x940, simulated 10 Mbps / 40 ms RTT, no CPU slowdown).
 */
export const PRESETS = {
  mobile: undefined,
  desktop: desktopConfig,
}

export const RUNS = 3

export const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

/** Targets from the challenge (median per category, 0-100). */
export const TARGETS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }

export const LIGHTHOUSE_FLAGS = {
  output: ['html', 'json'],
  logLevel: 'error',
  onlyCategories: CATEGORIES,
}

/** Fresh profile per run (chrome-launcher default): every run is a first visit, so the MSW worker installs each time. */
export const CHROME_FLAGS = ['--headless=new', '--no-first-run', '--no-default-browser-check']
