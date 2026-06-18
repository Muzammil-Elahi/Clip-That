import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
    include: ['src/__tests__/**/*.{test,spec}.ts'],
  },
})
