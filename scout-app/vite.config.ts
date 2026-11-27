import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// The version this build is: git describe, the same number `osdk site deploy` gives the site (foundry.config.json).
// It is baked into the app (__APP_VERSION__) and written to version.json, which the update banner reads to see
// whether a newer version has been deployed since the page loaded (components/UpdateBanner.tsx).
const version = (() => {
  try { return execSync('git describe --tags', { encoding: 'utf8' }).trim() } catch { return 'dev' }
})()

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'app-version',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) })
      },
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(version) },
  // Two apps, one site: the scout app (index.html) and the strategy app (strategy/index.html), each its own page,
  // entry and bundle. Code both use is in src/shared and lands in shared chunks.
  build: {
    rollupOptions: {
      input: {
        scout: fileURLToPath(new URL('./index.html', import.meta.url)),
        strategy: fileURLToPath(new URL('./strategy/index.html', import.meta.url)),
      },
    },
  },
})
