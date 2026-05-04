# 🛡️ Guia Completo: Configuração de Segurança em Camadas

**Para:** Bruno (Node.js + React + Dados Sensíveis)  
**Data:** 2026  
**Status:** Pronto para implementação imediata

---

## 📍 ÍNDICE

1. [FASE 1: PREVENÇÃO](#fase-1-prevenção)
2. [FASE 2: DETECÇÃO](#fase-2-detecção)
3. [FASE 3: RESPOSTA](#fase-3-resposta)
4. [FASE 4: CONFORMIDADE](#fase-4-conformidade)
5. [CI/CD Automático](#cicd-automático)
6. [Troubleshooting](#troubleshooting)

---

# FASE 1: PREVENÇÃO

## Objetivo
Bloquear credenciais, secrets e dados sensíveis ANTES de entrarem no repositório.

### ✅ Passo 1.1: Instalar Git-Secrets

**Windows (PowerShell - Execute como Admin):**
```powershell
# Ir para a pasta do seu projeto
cd U:\midia-indoor

# Opção A: Instalar via Chocolatey
choco install git-secrets

# Opção B: Instalar via NPM (mais simples)
npm install -g git-secrets

# Testar instalação
git secrets --version
```

**macOS/Linux:**
```bash
# macOS (Homebrew)
brew install git-secrets

# Linux (apt)
sudo apt-get install git-secrets

# Verificar
git secrets --version
```

---

### ✅ Passo 1.2: Configurar Git-Secrets no Projeto

**Execute uma vez por projeto:**

```bash
# Na pasta do projeto
cd U:\midia-indoor

# Instalar hooks locais
git secrets --install

# Registrar padrões AWS
git secrets --register-aws

# Adicionar padrões customizados para seu projeto
git secrets --add '(supabase_key|supabase_url|api_key|AUTH_SECRET)'
git secrets --add 'process\.env\.[A-Z_]+'
git secrets --add 'const.*=.*["\'].*["\'];'

# Testar (simula um commit com secret)
echo "DATABASE_PASSWORD=123456" > test.txt
git add test.txt
git secrets --scan  # Deve bloquear!

# Limpar teste
git reset HEAD test.txt
rm test.txt
```

---

### ✅ Passo 1.3: Configurar .gitignore

**Criar arquivo `.gitignore` na raiz do projeto:**

```bash
# Bash/PowerShell
cat > .gitignore << 'EOF'
# Environment variables
.env
.env.local
.env.*.local
.env.production

# API Keys & Secrets
.vault
*.pem
*.key
*.cert
*.p12
secrets/
credentials/

# Node modules
node_modules/
npm-debug.log
yarn-error.log

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Dependency
package-lock.json (opcional)
yarn.lock (opcional)

# Build
dist/
build/
.next/

# Testing
coverage/
.nyc_output/

# Database (SQLite)
*.db
*.sqlite
*.sqlite3

EOF
```

**Git add + commit:**
```bash
git add .gitignore
git commit -m "chore: add secure .gitignore"
```

---

### ✅ Passo 1.4: Configurar Pre-Commit Hooks

**Instalar automatização (roda `npm audit` antes de commit):**

```bash
npm install -D husky lint-staged

# Inicializar husky
npx husky install

# Criar hook de pre-commit
npx husky add .husky/pre-commit "npm audit && npm run lint"

# Criar hook de pre-push (roda Semgrep antes de push)
npx husky add .husky/pre-push "npm run security:check"
```

**Adicionar script em `package.json`:**

```json
{
  "scripts": {
    "security:check": "semgrep --config=p/owasp-top-ten ."
  }
}
```

---

### ✅ Passo 1.5: Validar Configuração

**Executar teste:**

```bash
# Testar git-secrets
echo "aws_access_key_id = AKIAIOSFODNN7EXAMPLE" > test.txt
git add test.txt
git secrets --scan

# Deve retornar:
# 1:0: AWS Access Key found
# [ERROR] Matched one or more prohibited patterns

# Limpar teste
rm test.txt
git reset HEAD
```

---

## ✅ CHECKLIST FASE 1

```
[ ] git-secrets instalado (git secrets --version)
[ ] git-secrets inicializado no projeto (git secrets --install)
[ ] .gitignore criado e commitado
[ ] Pre-commit hooks configurados (npm run test)
[ ] Teste de secrets passou (simulação bloqueada)
[ ] npm audit passando (sem críticos)
```

---

# FASE 2: DETECÇÃO

## Objetivo
Encontrar vulnerabilidades no código durante desenvolvimento.

### ✅ Passo 2.1: Instalar Semgrep (SAST)

**Windows/macOS/Linux:**

```bash
# Instalar via NPM
npm install -D semgrep

# Ou instalar globalmente
npm install -g semgrep

# Testar
semgrep --version
```

---

### ✅ Passo 2.2: Configurar Semgrep com OWASP

**Rodar primeiro scan:**

```bash
# Na pasta do projeto
cd U:\midia-indoor

# Scan com config OWASP Top 10
semgrep --config=p/owasp-top-ten . --json > semgrep-report.json

# Visualizar no terminal
semgrep --config=p/owasp-top-ten .
```

**Criar config customizado (`.semgrep.yml`):**

```yaml
rules:
  - id: hardcoded-secrets
    patterns:
      - pattern: |
          const $KEY = "...*password*"
      - pattern: |
          process.env.$VAR = "..."
    message: "Hardcoded secret encontrado"
    languages: [javascript, typescript]
    severity: ERROR

  - id: sql-injection
    patterns:
      - pattern: |
          db.query("..." + $VAR + "...")
    message: "Possível SQL injection"
    languages: [javascript, typescript]
    severity: CRITICAL

  - id: xss-vulnerable
    patterns:
      - pattern: |
          innerHTML = $VAR
    message: "Possível XSS"
    languages: [javascript, typescript]
    severity: HIGH
```

**Rodar com config customizado:**

```bash
semgrep --config=.semgrep.yml .
```

---

### ✅ Passo 2.3: Instalar Snyk (SCA)

**Passo A: Criar conta free**

```bash
# Instalar Snyk CLI
npm install -g snyk

# Login
snyk auth

# (Abre navegador, aprova)
```

**Passo B: Testar projeto**

```bash
# Escanear dependências
snyk test

# Gerar relatório JSON
snyk test --json-file-output=snyk-report.json

# Mostrar vulnerabilidades críticas
snyk test --severity-threshold=high
```

---

### ✅ Passo 2.4: Instalar Trivy (Composição)

**Download:**

```bash
# Windows (PowerShell)
Invoke-WebRequest -Uri "https://github.com/aquasecurity/trivy/releases/download/v0.47.0/trivy_0.47.0_windows-64bit.zip" -OutFile trivy.zip
Expand-Archive trivy.zip
.\trivy\trivy.exe fs . --format json -o trivy-report.json

# macOS
brew install trivy
trivy fs . --format json -o trivy-report.json

# Linux
sudo apt-get install trivy
trivy fs . --format json -o trivy-report.json
```

---

### ✅ Passo 2.5: npm audit (Built-in)

**Executar automaticamente:**

```bash
# Checar dependências
npm audit

# Corrigir automaticamente (cuidado!)
npm audit fix

# Forçar apenas fixes não-breaking
npm audit fix --force

# Gerar relatório
npm audit --json > npm-audit-report.json
```

---

### ✅ Passo 2.6: Consolidar Relatórios

**Criar script Python (`consolidate-reports.py`):**

```python
#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from datetime import datetime

reports = {}

# Carregar cada relatório
for report_file in ['semgrep-report.json', 'snyk-report.json', 'trivy-report.json', 'npm-audit-report.json']:
    if Path(report_file).exists():
        with open(report_file) as f:
            reports[report_file.replace('-report.json', '')] = json.load(f)

# Consolidar com timestamp
consolidated = {
    'timestamp': datetime.now().isoformat(),
    'reports': reports,
    'summary': {
        'semgrep_issues': len(reports.get('semgrep', {}).get('results', [])),
        'snyk_vulnerabilities': len(reports.get('snyk', {}).get('vulnerabilities', [])),
        'trivy_findings': len(reports.get('trivy', {}).get('Results', [])),
        'npm_vulnerabilities': reports.get('npm-audit', {}).get('metadata', {}).get('vulnerabilities', {})
    }
}

# Salvar
with open('security-consolidated-report.json', 'w') as f:
    json.dump(consolidated, f, indent=2)

print("✅ Relatório consolidado gerado: security-consolidated-report.json")
sys.exit(0)
```

**Executar:**

```bash
python3 consolidate-reports.py
```

---

## ✅ CHECKLIST FASE 2

```
[ ] Semgrep instalado (semgrep --version)
[ ] Semgrep config OWASP testado
[ ] Snyk instalado e autenticado (snyk auth)
[ ] Trivy instalado e testado
[ ] npm audit rodando sem críticos
[ ] Relatórios consolidados em JSON
[ ] Script de consolidação funcionando
```

---

# FASE 3: RESPOSTA

## Objetivo
Testar comportamento real em staging (DAST).

### ✅ Passo 3.1: Instalar OWASP ZAP

**Windows:**

```bash
# Download: https://www.zaproxy.org/download/
# Ou via Chocolatey
choco install zaproxy

# Teste
zaproxy --version
```

**macOS:**

```bash
brew install owasp-zap

# Ou download manual
```

**Linux:**

```bash
sudo apt-get install zaproxy

# Ou download do site
```

---

### ✅ Passo 3.2: Configurar ZAP Baseline Scan

**Criar script (`zap-baseline.sh`):**

```bash
#!/bin/bash

# Variáveis
TARGET_URL="http://localhost:3000"  # Seu staging
REPORT="zap-baseline-report.html"

# Rodar baseline scan
docker run -t owasp/zap2docker-baseline:latest \
  -t $TARGET_URL \
  -r $REPORT

# ou sem Docker (CLI direto)
zaproxy \
  -cmd \
  -quickurl $TARGET_URL \
  -quickout $REPORT

echo "✅ Relatório: $REPORT"
```

**Executar:**

```bash
bash zap-baseline.sh
```

---

### ✅ Passo 3.3: Teste de API (SQLMap)

**Para APIs específicas:**

```bash
# Instalar sqlmap
pip install sqlmap

# Testar endpoint (exemplo)
sqlmap -u "http://localhost:3000/api/users?id=1" --dbs

# Salvar relatório
sqlmap -u "http://localhost:3000/api/users?id=1" -o --batch --dump-all
```

---

## ✅ CHECKLIST FASE 3

```
[ ] ZAP instalado
[ ] Staging environment acessível
[ ] Baseline scan realizado
[ ] Relatório ZAP gerado
[ ] SQLMap testado em APIs críticas
```

---

# FASE 4: CONFORMIDADE

## Objetivo
Centralizar achados, validar conformidade e rastrear remediação.

### ✅ Passo 4.1: Instalar Defect Dojo (Docker)

**Quick start:**

```bash
# Instalar Docker (se não tiver)
# https://www.docker.com/products/docker-desktop

# Clone Defect Dojo
git clone https://github.com/DefectDojo/django-defect-dojo.git
cd django-defect-dojo

# Rodar
docker-compose up

# Acessar: http://localhost:8000
# Default login: admin / admin
```

---

### ✅ Passo 4.2: CI/CD com Falha em Críticos

**GitHub Actions (`.github/workflows/security.yml`):**

```yaml
name: Security Pipeline

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # 1️⃣ Git Secrets
      - name: Check Secrets
        run: |
          npm install -g git-secrets
          git secrets --install
          git secrets --register-aws
          git secrets --scan

      # 2️⃣ npm audit
      - name: npm audit
        run: npm audit --production

      # 3️⃣ Semgrep
      - name: Semgrep
        run: |
          npm install -g semgrep
          semgrep --config=p/owasp-top-ten . --json -o semgrep.json || true

      # 4️⃣ Snyk
      - name: Snyk
        run: |
          npm install -g snyk
          snyk test --json-file-output=snyk.json || true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      # 5️⃣ Trivy
      - name: Trivy
        run: |
          wget https://github.com/aquasecurity/trivy/releases/download/v0.47.0/trivy_0.47.0_linux-64bit.tar.gz
          tar zxvf trivy_0.47.0_linux-64bit.tar.gz
          ./trivy fs . --format json -o trivy.json

      # 6️⃣ Consolidar
      - name: Consolidate Reports
        run: |
          python3 consolidate-reports.py

      # 7️⃣ FALHAR se crítico
      - name: Fail on Critical
        run: |
          CRITICAL=$(jq '.summary.semgrep_issues' security-consolidated-report.json || echo 0)
          if [ "$CRITICAL" -gt 0 ]; then
            echo "❌ CRÍTICO encontrado!"
            exit 1
          fi

      # 8️⃣ Upload artefato
      - name: Upload Reports
        uses: actions/upload-artifact@v3
        with:
          name: security-reports
          path: security-consolidated-report.json
```

---

### ✅ Passo 4.3: Audit Trail (Logs)

**Configurar logging (`audit-logger.js`):**

```javascript
// utils/audit-logger.js

const fs = require('fs');
const path = require('path');

const AUDIT_LOG = path.join(__dirname, '../logs/audit.log');

function logAccess(userId, action, resource, status = 'SUCCESS', metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    userId,
    action,      // 'READ', 'WRITE', 'DELETE', 'LOGIN', etc
    resource,    // '/api/users/123'
    status,      // 'SUCCESS' ou 'FAILURE'
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    ...metadata
  };

  fs.appendFileSync(AUDIT_LOG, JSON.stringify(entry) + '\n');
}

module.exports = { logAccess };
```

**Usar no Express:**

```javascript
// middleware/audit.js
const { logAccess } = require('../utils/audit-logger');

function auditMiddleware(req, res, next) {
  const originalSend = res.send;

  res.send = function(data) {
    logAccess(
      req.user?.id || 'anonymous',
      req.method,
      req.path,
      res.statusCode < 400 ? 'SUCCESS' : 'FAILURE',
      {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        statusCode: res.statusCode
      }
    );
    return originalSend.call(this, data);
  };

  next();
}

module.exports = auditMiddleware;
```

**Usar no app:**

```javascript
const auditMiddleware = require('./middleware/audit');
app.use(auditMiddleware);
```

---

### ✅ Passo 4.4: Re-teste de Fixes

**Script validação (`validate-fixes.sh`):**

```bash
#!/bin/bash

echo "🔄 Validando fixes de segurança..."

# Rodar scans novamente
npm run security:check

# Comparar relatórios antigos vs novos
OLD_REPORT="security-consolidated-report.old.json"
NEW_REPORT="security-consolidated-report.json"

if [ -f "$OLD_REPORT" ]; then
  OLD_COUNT=$(jq '.summary.semgrep_issues' "$OLD_REPORT")
  NEW_COUNT=$(jq '.summary.semgrep_issues' "$NEW_REPORT")
  
  if [ "$NEW_COUNT" -lt "$OLD_COUNT" ]; then
    echo "✅ $((OLD_COUNT - NEW_COUNT)) vulnerabilidades FIXADAS!"
  else
    echo "❌ Mais vulnerabilidades encontradas"
    exit 1
  fi
fi

# Backup novo relatório
cp "$NEW_REPORT" "$OLD_REPORT"
echo "✅ Re-teste validado"
```

---

## ✅ CHECKLIST FASE 4

```
[ ] Defect Dojo rodando
[ ] CI/CD falha se crítico encontrado
[ ] Relatório consolidado automático
[ ] Audit trail ativo
[ ] Re-teste de fix validado
```

---

# CI/CD AUTOMÁTICO

## GitHub Actions Completo

Crie `.github/workflows/security.yml`:

```yaml
name: 🛡️ Security Pipeline (Completo)

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      # Checkout
      - uses: actions/checkout@v3

      # Setup Node
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      # FASE 1: PREVENÇÃO
      - name: "1️⃣ PREVENÇÃO: Git Secrets"
        run: |
          npm install -g git-secrets
          git secrets --install
          git secrets --register-aws
          git secrets --scan
        continue-on-error: true

      - name: "1️⃣ PREVENÇÃO: npm audit"
        run: |
          npm ci
          npm audit --production || true

      # FASE 2: DETECÇÃO
      - name: "2️⃣ DETECÇÃO: Semgrep"
        run: |
          npm install -g semgrep
          semgrep --config=p/owasp-top-ten . --json -o semgrep.json || true

      - name: "2️⃣ DETECÇÃO: Snyk"
        run: |
          npm install -g snyk
          snyk test --json-file-output=snyk.json || true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        continue-on-error: true

      - name: "2️⃣ DETECÇÃO: Trivy"
        run: |
          mkdir -p /tmp/trivy
          cd /tmp/trivy
          wget -q https://github.com/aquasecurity/trivy/releases/download/v0.47.0/trivy_0.47.0_linux-64bit.tar.gz
          tar zxf trivy_0.47.0_linux-64bit.tar.gz
          cd -
          /tmp/trivy/trivy fs . --format json -o trivy.json || true

      # Consolidar
      - name: "Consolidate Security Reports"
        run: |
          python3 consolidate-reports.py

      # FALHAR se crítico
      - name: "🚨 Fail on Critical"
        run: |
          CRITICAL=$(jq '.summary.semgrep_issues' security-consolidated-report.json 2>/dev/null || echo 0)
          echo "Found $CRITICAL critical issues"
          if [ "$CRITICAL" -gt 0 ]; then
            echo "❌ CRÍTICO detectado. Bloqueando merge."
            exit 1
          fi

      # Upload
      - name: "Upload Security Reports"
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: security-reports
          path: |
            security-consolidated-report.json
            semgrep.json
            snyk.json
            trivy.json

      # Comment on PR
      - name: "Comment on PR"
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('security-consolidated-report.json', 'utf8'));
            const summary = report.summary;
            
            const comment = `
## 🛡️ Segurança - Relatório Automático
            
- **Semgrep Issues:** ${summary.semgrep_issues}
- **Snyk Vulnerabilities:** ${summary.snyk_vulnerabilities}
- **Trivy Findings:** ${summary.trivy_findings}
            
[Download Relatório Completo](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
        continue-on-error: true
```

---

# TROUBLESHOOTING

## ❌ "git-secrets not found"

```bash
# Windows
npm install -g git-secrets

# Verificar PATH
echo $env:PATH | findstr npm

# Adicionar manualmente se necessário
```

## ❌ "Semgrep: No matches"

```bash
# Aumentar verbosidade
semgrep --config=p/owasp-top-ten . -v

# Ou verificar sintaxe
semgrep --validate .semgrep.yml
```

## ❌ "Snyk auth failed"

```bash
# Re-autenticar
snyk logout
snyk auth

# Verificar token
snyk whoami
```

## ❌ "Trivy: Cannot connect to Docker"

```bash
# Se não tiver Docker, é OK - Trivy roda sem Docker
# Apenas ignorar warning

# Ou instalar Docker:
# https://www.docker.com/products/docker-desktop
```

---

## 🎯 PRÓXIMOS PASSOS

1. **Escolha seu SO** → Execute FASE 1
2. **Valide cada ferramenta** → Checklist
3. **Setup CI/CD** → GitHub Actions
4. **Integre no workflow** → Pre-commit + CR
5. **Teste em staging** → FASE 3
6. **Vá para produção** → Com confiança

---

**Dúvidas? Manda mensagem direto que resolvo.**
