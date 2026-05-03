import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@': path.resolve(__dirname, './client/src'),
    },
  },
  test: {
    include: [
      'client/src/**/__tests__/**/*.test.{ts,tsx}',
      'server/**/__tests__/**/*.test.ts',
    ],
    environment: 'node',
    globals: false,
    setupFiles: ['./server/__tests__/setup.ts'],
  },
})
