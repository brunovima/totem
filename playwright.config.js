import { defineConfig } from '@playwright/test'
import { join } from 'path'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,        // Electron pode demorar para abrir
  retries: 1,             // 1 retry em CI para flakiness de GPU
  workers: 1,             // Electron não suporta testes paralelos na mesma instância
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/reports/playwright', open: 'never' }]
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Caminho do main compilado — exige `npm run build` antes
    // Para dev, sobrescreva com: ELECTRON_ARGS=. npx playwright test
  },
  projects: [
    {
      name: 'electron-dev',
      use: {
        // Usa o código compilado em out/ (após npm run build)
        electronEntryPoint: join(process.cwd(), 'out/main/index.js'),
      }
    }
  ]
})
