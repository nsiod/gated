import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  base: '/ui/',
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: '0.0.0.0',
    // Vite picks up `PORT` from the env (set by `nsl run`). For `dev:bare`
    // it falls back to the Vite default (5173).
    allowedHosts: true,
  },
  build: {
    sourcemap: true,
    manifest: true,
    commonjsOptions: {
      include: [
        'src/features/gateway/lib/api-client/dist/*.js',
        'src/features/admin/lib/api-client/dist/*.js',
        '**/*.js',
      ],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      input: 'index.html',
    },
  },
})
