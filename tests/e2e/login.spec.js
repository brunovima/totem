/**
 * Testes E2E — Tela de Login do Painel Admin
 *
 * Pré-requisito: npm run build  (gera out/main/index.js)
 * Executar: npx playwright test tests/e2e/login.spec.js
 *
 * Observação sobre os inputs readOnly:
 * O LoginScreen usa window.addEventListener('keydown') para capturar input.
 * Playwright dispara keydown via page.keyboard.type() — funciona corretamente.
 */

import { test, expect, _electron as electron } from '@playwright/test'
import { join } from 'path'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function launchApp() {
  const app = await electron.launch({
    args: [join(process.cwd(), 'out/main/index.js')],
    timeout: 60_000,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_IS_DEV: '1'
    }
  })
  const page = await app.firstWindow({ timeout: 60_000 })
  await page.waitForLoadState('domcontentloaded')
  // Aguarda o VideoPlayer renderizar (gradiente de fundo ou placeholder)
  await page.waitForSelector('[data-testid="admin-trigger"]', { timeout: 15_000 })
  return { app, page }
}

async function abrirTelaLogin(page) {
  // O botão admin tem data-testid="admin-trigger" e opacity:0 (invisível mas clicável)
  await page.locator('[data-testid="admin-trigger"]').click({ force: true })
  // Aguarda a tela de login aparecer
  await expect(page.locator('text=Painel Gestor')).toBeVisible({ timeout: 8_000 })
}

async function digitarNoCampo(page, placeholder, texto) {
  // Clica no campo para definir activeField via onFocus
  await page.locator(`input[placeholder="${placeholder}"]`).click()
  // Digita via eventos keydown no window (como o VirtualKeyboard faria)
  await page.keyboard.type(texto, { delay: 50 })
}

// ── Testes ───────────────────────────────────────────────────────────────────

test.describe('Login — Painel Gestor', () => {

  test('credenciais corretas → abre o AdminPanel', async () => {
    const { app, page } = await launchApp()

    try {
      await abrirTelaLogin(page)

      await digitarNoCampo(page, 'USUÁRIO', 'admin')
      await digitarNoCampo(page, 'Senha', '1234')

      await page.locator('button:has-text("Entrar")').click()

      // Verifica que o sidebar do AdminPanel está visível
      await expect(page.locator('text=TOTEM ADMIN')).toBeVisible({ timeout: 8_000 })

      // Verifica que o botão da aba Quizzes está acessível no sidebar
      await expect(page.getByRole('button', { name: /Quizzes/ })).toBeVisible()
    } finally {
      await app.close()
    }
  })

  test('senha incorreta → exibe mensagem de erro', async () => {
    const { app, page } = await launchApp()

    try {
      await abrirTelaLogin(page)

      await digitarNoCampo(page, 'USUÁRIO', 'admin')
      await digitarNoCampo(page, 'Senha', 'senhaerrada123')

      await page.locator('button:has-text("Entrar")').click()

      // A tela NÃO muda — erro aparece
      await expect(page.locator('text=Usuário ou senha incorretos.')).toBeVisible({ timeout: 5_000 })

      // Confirma que NÃO está no painel admin
      await expect(page.locator('text=TOTEM ADMIN')).not.toBeVisible()
    } finally {
      await app.close()
    }
  })

  test('usuário incorreto → exibe mensagem de erro', async () => {
    const { app, page } = await launchApp()

    try {
      await abrirTelaLogin(page)

      await digitarNoCampo(page, 'USUÁRIO', 'hacker')
      await digitarNoCampo(page, 'Senha', '1234')

      await page.locator('button:has-text("Entrar")').click()

      await expect(page.locator('text=Usuário ou senha incorretos.')).toBeVisible({ timeout: 5_000 })
    } finally {
      await app.close()
    }
  })

  test('campos vazios → exibe mensagem de erro', async () => {
    const { app, page } = await launchApp()

    try {
      await abrirTelaLogin(page)

      // Não digita nada — clica direto em Entrar
      await page.locator('button:has-text("Entrar")').click()

      await expect(page.locator('text=Usuário ou senha incorretos.')).toBeVisible({ timeout: 5_000 })
    } finally {
      await app.close()
    }
  })

  test('botão Voltar → retorna à tela de vídeo', async () => {
    const { app, page } = await launchApp()

    try {
      await abrirTelaLogin(page)
      await page.locator('button:has-text("Voltar")').click()

      // Tela de login some — voltou ao VideoPlayer
      await expect(page.locator('text=Painel Gestor')).not.toBeVisible({ timeout: 5_000 })
    } finally {
      await app.close()
    }
  })

  test('Enter no teclado submete o formulário', async () => {
    const { app, page } = await launchApp()

    try {
      await abrirTelaLogin(page)

      await digitarNoCampo(page, 'USUÁRIO', 'admin')
      await digitarNoCampo(page, 'Senha', '1234')

      // Submete via Enter (o useEffect escuta keydown Enter)
      await page.keyboard.press('Enter')

      await expect(page.locator('text=TOTEM ADMIN')).toBeVisible({ timeout: 8_000 })
    } finally {
      await app.close()
    }
  })

})
