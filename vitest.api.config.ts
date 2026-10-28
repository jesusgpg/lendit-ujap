import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/api/**/*.integration.ts'],
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 15000,
    reporters: ['verbose', 'json', 'junit'],
    outputFile: { json: 'output/qa-api/results.json', junit: 'output/qa-api/junit.xml' },
  },
})
