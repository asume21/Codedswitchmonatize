import { defineConfig } from 'vitest/config'

export default defineConfig({
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
