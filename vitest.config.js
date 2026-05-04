import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.js'],
    reporters: ['verbose'],
    outputFile: {
      json: 'tests/reports/vitest/results.json'
    },
    // Timeout maior para execFileAsync com ferramentas externas
    testTimeout: 30_000,
    hookTimeout: 10_000,
    // Sequencial: evita conflitos de arquivo temporário no DB
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true }
    }
  }
})
