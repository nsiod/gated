/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Bun-driven integration tests live in repo-root `tests/` and run under
    // a different runner — keep Vitest scoped to `src/` so it doesn't pick
    // them up (they fail without the real `gated` binary).
    exclude: ['node_modules', 'dist', 'src/features/*/lib/api-client'],
  },
})
