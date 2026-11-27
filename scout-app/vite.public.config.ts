import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// The public strategy page (src/publicMain.tsx), served from lebob.com.au/strategy/ by the Lebob-Website deploy job,
// which puts the exported data in data/ beside it (scripts/export-public.mjs). `npm run build:public` writes dist-public/.
const version = (() => {
  try { return execSync('git describe --tags', { encoding: 'utf8' }).trim() } catch { return 'dev' }
})()

export default defineConfig({
  root: fileURLToPath(new URL('./public-site', import.meta.url)),
  base: '/strategy/',
  publicDir: false,
  plugins: [react()],
  resolve: { alias: { '/src': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { outDir: fileURLToPath(new URL('./dist-public', import.meta.url)), emptyOutDir: true },
})
