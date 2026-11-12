import { rm } from 'node:fs/promises'
import path from 'node:path'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const mocksEnabledFor = (mode: string, envDir: string) => loadEnv(mode, envDir, 'VITE_').VITE_ENABLE_MOCKS === 'true'

/** public/ is copied verbatim: a build with mocks off must not ship the MSW service worker script. */
function dropMockWorkerWithoutMocks(): Plugin {
  let outDir = ''
  let mocksEnabled = false
  return {
    name: 'kurio:drop-mock-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
      mocksEnabled = mocksEnabledFor(config.mode, config.envDir || config.root)
    },
    async closeBundle() {
      if (!mocksEnabled) await rm(path.join(outDir, 'mockServiceWorker.js'), { force: true })
    },
  }
}

/**
 * Demo builds await the mock layer before the first render: modulepreload its chunk (and the chunks it
 * imports) from index.html so it downloads in parallel with the app entry instead of after it executes.
 */
function preloadMockChunk(): Plugin {
  let mocksEnabled = false
  return {
    name: 'kurio:preload-mock-chunk',
    apply: 'build',
    configResolved(config) {
      mocksEnabled = mocksEnabledFor(config.mode, config.envDir || config.root)
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!mocksEnabled || !ctx.bundle) return html
        const chunks = Object.values(ctx.bundle).filter((output) => output.type === 'chunk')
        const entry = chunks.find((chunk) => chunk.facadeModuleId?.replaceAll('\\', '/').endsWith('/src/mocks/browser.ts'))
        if (!entry) throw new Error('kurio:preload-mock-chunk: mock entry chunk not found')
        const files = new Set<string>()
        const visit = (fileName: string) => {
          if (files.has(fileName)) return
          files.add(fileName)
          chunks.find((chunk) => chunk.fileName === fileName)?.imports.forEach(visit)
        }
        visit(entry.fileName)
        return [...files]
          .filter((fileName) => !html.includes(`/${fileName}"`))
          .map((fileName) => ({
            tag: 'link',
            attrs: { rel: 'modulepreload', crossorigin: true, href: `/${fileName}` },
            injectTo: 'head' as const,
          }))
      },
    },
  }
}

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    dropMockWorkerWithoutMocks(),
    preloadMockChunk(),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  // Pre-bundle deps first reached through dynamic imports, so dev never reloads mid-session to optimize them.
  optimizeDeps: { include: ['socket.io-client'] },
})
