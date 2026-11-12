import { defineConfig, devices } from '@playwright/test'

const CI = !!process.env.CI

/** Visual regression specs (tests/visual) run in every viewport project, functional E2E only in desktop/mobile. */
const VISUAL = /tests[\\/]visual[\\/]/
const SPIKE = /realtime-spike/

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  // Each worker drives a full app (MSW worker + mock socket server per tab): more than 3 starves the
  // CPU on a dev machine and turns 5 s expectations into flakes. GitHub runners have 4 vCPUs.
  workers: CI ? 2 : 3,
  reporter: [['html', { open: 'never' }], ['list']],
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      testIgnore: SPIKE,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-mobile',
      testIgnore: SPIKE,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'chromium-tablet',
      testMatch: VISUAL,
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      // Realtime spike: runs against the Vite dev server so the spec can import source modules.
      name: 'spike',
      testMatch: SPIKE,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173' },
    },
  ],
  webServer: [
    {
      command: 'npm run build:demo && npm run preview',
      url: 'http://localhost:4173',
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
    {
      // Only the spike project uses it; it starts in parallel with the demo build, so it adds no wall time.
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      env: { VITE_ENABLE_MOCKS: 'true' },
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
})
