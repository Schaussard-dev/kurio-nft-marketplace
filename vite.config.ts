import { rm } from 'node:fs/promises'
import path from 'node:path'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/** public/ is copied verbatim: a build with mocks off must not ship the MSW service worker script. */
function dropMockWorkerWithoutMocks(): Plugin {
  let outDir = ''
  let mocksEnabled = false
  return {
    name: 'kurio:drop-mock-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
      mocksEnabled = loadEnv(config.mode, config.envDir || config.root, 'VITE_').VITE_ENABLE_MOCKS === 'true'
    },
    async closeBundle() {
      if (!mocksEnabled) await rm(path.join(outDir, 'mockServiceWorker.js'), { force: true })
    },
  }
}

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    dropMockWorkerWithoutMocks(),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  // Pre-bundle deps first reached through dynamic imports, so dev never reloads mid-session to optimize them.
  optimizeDeps: { include: ['socket.io-client'] },
})
