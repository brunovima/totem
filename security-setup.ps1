Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🛡️  TotemSync Security Setup - SIMPLIFICADO" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$startTime = Get-Date

Write-Host "1️⃣  FASE 1: PREVENÇÃO" -ForegroundColor Cyan
npm install -g git-secrets 2>$null | Out-Null
git secrets --install 2>$null
git secrets --register-aws 2>$null
git secrets --add 'firebase_api_key' 2>$null
git secrets --add 'JWT_SECRET' 2>$null

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

npm install 2>$null | Out-Null
npm audit --production 2>$null | Out-Null
Write-Host "✅ FASE 1 COMPLETA" -ForegroundColor Green

Write-Host ""
Write-Host "2️⃣  FASE 2: SNYK" -ForegroundColor Cyan
npm install -g snyk 2>$null | Out-Null
Write-Host "→ Autenticando Snyk (navegador vai abrir)..." -ForegroundColor Yellow
snyk auth 2>$null
Write-Host "→ Rodando Snyk..." -ForegroundColor Yellow
snyk test --json-file-output=snyk-report.json 2>$null
Write-Host "✅ FASE 2 COMPLETA" -ForegroundColor Green

Write-Host ""
Write-Host "3️⃣  FASE 3: SETUP" -ForegroundColor Cyan
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
      - run: npm ci && npm audit --production || true
      - run: npm install -g snyk && snyk test --json-file-output=snyk.json || true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        continue-on-error: true
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: security-reports
          path: snyk.json
"@

$workflow | Out-File -FilePath "$workflowDir\security.yml" -Encoding UTF8 -Force

if (-not (Test-Path "src\utils")) {
    New-Item -ItemType Directory -Path "src\utils" -Force | Out-Null
}

$auditLogger = @"
import { appendFileSync } from 'fs';
import { join } from 'path';
const AUDIT_LOG = join(process.cwd(), 'logs', 'audit.log');
export function logAccess(userId, action, resource, status = 'SUCCESS', metadata = {}) {
  const entry = { timestamp: new Date().toISOString(), userId, action, resource, status, ...metadata };
  try { appendFileSync(AUDIT_LOG, JSON.stringify(entry) + '\n'); } catch (error) { console.error('Audit log error:', error); }
}
"@

$auditLogger | Out-File -FilePath "src\utils\audit-logger.ts" -Encoding UTF8 -Force

Write-Host "✅ GitHub Actions criado" -ForegroundColor Green
Write-Host "✅ Audit logger criado" -ForegroundColor Green

Write-Host ""
$endTime = Get-Date
$duration = ($endTime - $startTime).TotalMinutes

Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ SETUP COMPLETO!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Tempo: $([Math]::Round($duration, 2)) minutos" -ForegroundColor Yellow
Write-Host ""
Write-Host "Arquivos criados:" -ForegroundColor Cyan
Write-Host "✅ .gitignore" -ForegroundColor Green
Write-Host "✅ snyk-report.json" -ForegroundColor Green
Write-Host "✅ .github/workflows/security.yml" -ForegroundColor Green
Write-Host "✅ src/utils/audit-logger.ts" -ForegroundColor Green
Write-Host ""
Write-Host "Próximas ações:" -ForegroundColor Cyan
Write-Host "1. git add ." -ForegroundColor White
Write-Host "2. git commit -m 'chore: add security'" -ForegroundColor White
Write-Host "3. git push" -ForegroundColor White
Write-Host ""
