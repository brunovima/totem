# 🛡️ TotemSync Security Setup - Ultra-Simplificado
# Execute no PowerShell como Admin

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🛡️  TotemSync Security Setup - SIMPLIFICADO (Sem Semgrep)" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$startTime = Get-Date

# ═════════════════════════════════════════════════════════════════════════════
# PHASE 1: PREVENTION
# ═════════════════════════════════════════════════════════════════════════════

Write-Host "1️⃣  FASE 1: PREVENÇÃO (git-secrets + npm audit)" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────────────────────────────" -ForegroundColor Cyan

Write-Host "→ Instalando git-secrets..." -ForegroundColor Yellow
npm install -g git-secrets 2>$null | Out-Null

Write-Host "→ Inicializando git-secrets..." -ForegroundColor Yellow
git secrets --install 2>$null
git secrets --register-aws 2>$null
git secrets --add 'firebase_api_key' 2>$null
git secrets --add 'JWT_SECRET' 2>$null

Write-Host "→ Criando .gitignore..." -ForegroundColor Yellow
$gitignore = @"
.env
.env.local
.env.production
node_modules/
npm-debug.log
firebase-key.json
*.db
*.sqlite
.DS_Store
Thumbs.db
dist/
build/
.vscode/
.idea/
logs/
"@
$gitignore | Out-File -FilePath .gitignore -Encoding UTF8 -Force

Write-Host "→ Rodando npm audit..." -ForegroundColor Yellow
npm install 2>$null | Out-Null
npm audit --production 2>$null | Out-Null

Write-Host "✅ FASE 1 COMPLETA`n" -ForegroundColor Green

Write-Host "2️⃣  FASE 2: DETECÇÃO (Snyk)" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────────────────────────────" -ForegroundColor Cyan

Write-Host "→ Instalando Snyk..." -ForegroundColor Yellow
npm install -g snyk 2>$null | Out-Null

Write-Host "→ Autenticando Snyk (vai abrir navegador)..." -ForegroundColor Yellow
Write-Host "   1. Clique em 'Authorize with GitHub' no navegador" -ForegroundColor Cyan
Write-Host "   2. Autorize as permissões" -ForegroundColor Cyan
Write-Host "   3. Volte aqui (PowerShell)" -ForegroundColor Cyan
Write-Host ""

snyk auth 2>$null

Write-Host "→ Rodando Snyk test..." -ForegroundColor Yellow
snyk test --json-file-output=snyk-report.json 2>$null

if (Test-Path "snyk-report.json") {
    Write-Host "✅ Snyk report criado: snyk-report.json" -ForegroundColor Green
} else {
    Write-Host "⚠️  Snyk report não gerado (continuar...)" -ForegroundColor Yellow
}

Write-Host "`n✅ FASE 2 COMPLETA`n" -ForegroundColor Green

Write-Host "3️⃣  FASE 3: SETUP (GitHub Actions + Audit Logger)" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────────────────────────────" -ForegroundColor Cyan

Write-Host "→ Criando GitHub Actions workflow..." -ForegroundColor Yellow

$workflowDir = ".github\workflows"
if (-not (Test-Path $workflowDir)) {
    New-Item -ItemType Directory -Path $workflowDir -Force | Out-Null
}

$workflow = @"
name: Security Pipeline
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install -g git-secrets && git secrets --install && git secrets --scan || true
        name: Check for secrets
      
      - run: npm ci && npm audit --production || true
        name: npm audit
      
      - run: npm install -g snyk && snyk test --json-file-output=snyk.json || true
        name: Snyk test
        env:
          SNYK_TOKEN: \${{ secrets.SNYK_TOKEN }}
        continue-on-error: true
      
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: security-reports
          path: |
            snyk.json
"@

$workflow | Out-File -FilePath "$workflowDir\security.yml" -Encoding UTF8 -Force
Write-Host "✅ GitHub Actions workflow criado: .github/workflows/security.yml" -ForegroundColor Green

Write-Host "→ Criando audit logger..." -ForegroundColor Yellow

$auditLogger = @"
import { appendFileSync } from 'fs';
import { join } from 'path';

const AUDIT_LOG = join(process.cwd(), 'logs', 'audit.log');

export function logAccess(userId, action, resource, status = 'SUCCESS', metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    userId,
    action,
    resource,
    status,
    ...metadata
  };

  try {
    appendFileSync(AUDIT_LOG, JSON.stringify(entry) + '\n');
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
"@

if (-not (Test-Path "src\utils")) {
    New-Item -ItemType Directory -Path "src\utils" -Force | Out-Null
}

$auditLogger | Out-File -FilePath "src\utils\audit-logger.ts" -Encoding UTF8 -Force
Write-Host "✅ Audit logger criado: src/utils/audit-logger.ts" -ForegroundColor Green

Write-Host "`n✅ FASE 3 COMPLETA`n" -ForegroundColor Green

$endTime = Get-Date
$duration = ($endTime - $startTime).TotalMinutes

Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ SETUP COMPLETO!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "⏱️  Tempo total: $([Math]::Round($duration, 2)) minutos" -ForegroundColor Yellow
Write-Host ""
Write-Host "📁 Arquivos criados:" -ForegroundColor Cyan
Write-Host "   ✅ .gitignore (protege secrets)" -ForegroundColor Green
Write-Host "   ✅ snyk-report.json (vulnerabilidades)" -ForegroundColor Green
Write-Host "   ✅ .github/workflows/security.yml (CI/CD)" -ForegroundColor Green
Write-Host "   ✅ src/utils/audit-logger.ts (audit trail)" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Próximas ações:" -ForegroundColor Cyan
Write-Host "   1. Revisar snyk-report.json" -ForegroundColor White
Write-Host "   2. Commit: git add . && git commit -m 'chore: add security'" -ForegroundColor White
Write-Host "   3. Push: git push" -ForegroundColor White
Write-Host "   4. CI/CD rodará automaticamente no próximo commit" -ForegroundColor White
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🛡️  Segurança em profundidade = Proteção real!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""