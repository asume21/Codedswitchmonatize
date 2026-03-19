import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['client/src/**/__tests__/**/*.test.{ts,tsx}'],
    environment: 'node',
    globals: false,
  },
})
