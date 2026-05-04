# 🛡️ Segurança TotemSync - Windows PowerShell

**Projeto:** TotemSync (Electron + Vite + React + SQLite + Firebase)  
**SO:** Windows  
**Git:** Sim (já configurado)  
**Data Criação:** 2026

---

## 📍 QUICK REFERENCE

```powershell
# Copie e execute estes comandos NA ORDEM abaixo
# Cada bloco é uma etapa independente
```

---

## ✅ FASE 1: PREVENÇÃO (Bloqueia secrets antes de commitar)

### Passo 1.1: Abrir PowerShell como Admin

```powershell
# Pressione: Windows + X → Windows PowerShell (Admin)
# Ou: Win + R → powershell → Ctrl+Shift+Enter

# Verificar se você é admin:
[bool](([System.Security.Principal.WindowsIdentity]::GetCurrent()).groups -match "S-1-5-32-544")
# Retorna: True = você é admin
```

### Passo 1.2: Navegar para pasta do TotemSync

```powershell
# Se TotemSync está em C:\projects\totem (AJUSTE O CAMINHO!)
cd C:\projects\totem
# Verificar se está no lugar certo:
ls  # Deve mostrar: package.json, src/, node_modules/, etc
```

### Passo 1.3: Instalar git-secrets (Windows)

```powershell
# Opção A: Via Chocolatey (se tiver)
choco install git-secrets -y

# Opção B: Via NPM (RECOMENDADO - mais simples)
npm install -g git-secrets

# Verificar instalação
git secrets --version
# Esperado: git-secrets 1.3.0 (ou similar)
```

### Passo 1.4: Configurar git-secrets no TotemSync

```powershell
# Dentro da pasta do TotemSync
cd C:\projects\totem

# Instalar hooks locais
git secrets --install

# Registrar padrões AWS
git secrets --register-aws

# Adicionar padrões customizados (Firebase, Supabase, etc)
git secrets --add 'firebase_api_key'
git secrets --add 'firebase_auth_domain'
git secrets --add 'process\.env\.[A-Z_]+'
git secrets --add 'ELECTRON_SECURITY_TOKEN'
git secrets --add 'JWT_SECRET'
git secrets --add 'DATABASE_URL'

# Verificar que foi instalado
ls .git/hooks/pre-commit
# Deve existir o arquivo pre-commit
```

### Passo 1.5: Testar git-secrets (Simulação)

```powershell
# Criar arquivo de teste com secret
@"
DATABASE_PASSWORD=super_secret_123
"@ | Out-File -FilePath test.txt -Encoding UTF8

# Adicionar ao git
git add test.txt

# Testar se bloqueia
git secrets --scan
# Esperado: [ERROR] Matched one or more prohibited patterns

# Limpar teste
git reset HEAD test.txt
Remove-Item test.txt

# Verificar que workspace está limpo
git status
# Esperado: nothing to commit
```

### Passo 1.6: Criar .gitignore seguro

```powershell
# Criar arquivo .gitignore na raiz do TotemSync
$gitignore = @"
# Environment
.env
.env.local
.env.*.local
.env.production
.env.production.local

# Firebase & Secrets
.firebaserc
firebase-key.json
secrets/
credentials/
*.pem
*.key
*.cert

# Node
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

# Build & Dist
dist/
build/
.next/
out/

# Electron
release/
*.exe
*.dmg
*.zip

# SQLite
*.db
*.sqlite
*.sqlite3

# Testing
coverage/
.nyc_output/
"@

$gitignore | Out-File -FilePath .gitignore -Encoding UTF8 -Force

# Verificar que foi criado
cat .gitignore | head -20
```

### Passo 1.7: Configurar npm audit

```powershell
# Instalar dependências (se não tiver)
npm install

# Rodar npm audit
npm audit

# Se houver críticos:
npm audit fix  # Tenta corrigir automaticamente

# Ou ver apenas críticos
npm audit --production
```

### Passo 1.8: Setup Pre-commit hooks com Husky (AUTOMÁTICO)

```powershell
# Instalar husky
npm install -D husky lint-staged

# Inicializar husky
npx husky install

# Criar hook pre-commit (roda npm audit antes de commit)
npx husky add .husky\pre-commit 'npm audit --production'

# Criar hook pre-push (roda segurança antes de push)
npx husky add .husky\pre-push 'npm run security:check'

# Adicionar script em package.json
# (Próximo passo)
```

### Passo 1.9: Adicionar script de segurança em package.json

```powershell
# Abrir package.json com seu editor preferido:
code package.json
# Ou no Notepad:
notepad package.json

# Adicionar este bloco na seção "scripts":
"scripts": {
  ...
  "security:check": "semgrep --config=p/owasp-top-ten . --json",
  "security:audit": "npm audit && snyk test || true",
  "security:all": "npm run security:check && npm run security:audit"
}
```

### ✅ Validar FASE 1

```powershell
# Execute cada linha:
git secrets --version               # Deve retornar versão
cat .gitignore | Measure-Object    # Deve ter >30 linhas
npm audit --production             # Não deve ter críticos
ls .husky                           # Deve existir pasta .husky

# Se tudo passou:
Write-Host "✅ FASE 1 COMPLETA!" -ForegroundColor Green
```

---

## 🔍 FASE 2: DETECÇÃO (Encontra vulnerabilidades)

### Passo 2.1: Instalar Semgrep

```powershell
# Via npm (mais simples no Windows)
npm install -g semgrep

# Verificar
semgrep --version
```

### Passo 2.2: Rodar Semgrep com OWASP Top 10

```powershell
# Na pasta do TotemSync
cd C:\projects\totem

# Scan OWASP
semgrep --config=p/owasp-top-ten . --json -o semgrep-report.json

# Ver resultados (terminal)
semgrep --config=p/owasp-top-ten .

# Ver relatório JSON (se quiser)
cat semgrep-report.json | ConvertFrom-Json | Select-Object -ExpandProperty results | ForEach-Object { $_.message }
```

### Passo 2.3: Instalar Snyk

```powershell
# Instalar CLI
npm install -g snyk

# Fazer login (abre navegador)
snyk auth

# Testar projeto
snyk test

# Gerar relatório JSON
snyk test --json-file-output=snyk-report.json

# Ver apenas críticos
snyk test --severity-threshold=high
```

### Passo 2.4: Instalar Trivy

```powershell
# Windows: Baixar executável
$url = "https://github.com/aquasecurity/trivy/releases/download/v0.47.0/trivy_0.47.0_windows-64bit.zip"
$output = "C:\temp\trivy.zip"

# Criar pasta temp (se não existir)
New-Item -ItemType Directory -Path C:\temp -Force

# Baixar
Invoke-WebRequest -Uri $url -OutFile $output

# Descompactar
Expand-Archive -Path $output -DestinationPath C:\temp\trivy -Force

# Mover para PATH (opcional, para usar em qualquer lugar)
Copy-Item C:\temp\trivy\trivy.exe "C:\Program Files\trivy.exe" -Force

# Testar
C:\temp\trivy\trivy.exe --version
```

### Passo 2.5: Rodar Trivy no TotemSync

```powershell
# Na pasta do TotemSync
cd C:\projects\totem

# Scan filesystem
C:\temp\trivy\trivy.exe fs . --format json -o trivy-report.json

# Ver no terminal
C:\temp\trivy\trivy.exe fs .
```

### Passo 2.6: Consolidar relatórios em JSON

```powershell
# Criar script Python: consolidate-reports.py
$consolidateScript = @"
#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from datetime import datetime

reports = {}

# Carregar relatórios
for report_file in ['semgrep-report.json', 'snyk-report.json', 'trivy-report.json']:
    try:
        with open(report_file) as f:
            reports[report_file.replace('-report.json', '')] = json.load(f)
    except FileNotFoundError:
        print(f'⚠️  {report_file} não encontrado')

# Consolidar
consolidated = {
    'timestamp': datetime.now().isoformat(),
    'reports': reports,
    'summary': {
        'semgrep_issues': len(reports.get('semgrep', {}).get('results', [])),
        'snyk_vulnerabilities': len([v for v in reports.get('snyk', {}).get('vulnerabilities', []) if v.get('severity') in ['critical', 'high']]),
        'trivy_findings': len(reports.get('trivy', {}).get('Results', []))
    }
}

# Salvar
with open('security-consolidated-report.json', 'w') as f:
    json.dump(consolidated, f, indent=2)

print('✅ Relatório consolidado: security-consolidated-report.json')
"@

$consolidateScript | Out-File -FilePath consolidate-reports.py -Encoding UTF8

# Rodar consolidação
python consolidate-reports.py

# Ver resultado
cat security-consolidated-report.json
```

### ✅ Validar FASE 2

```powershell
# Executar:
semgrep --version              # Deve retornar versão
snyk --version                 # Deve retornar versão
C:\temp\trivy\trivy.exe --version  # Deve retornar versão
Test-Path semgrep-report.json  # True
Test-Path snyk-report.json     # True
Test-Path trivy-report.json    # True
Test-Path security-consolidated-report.json  # True

# Se tudo passou:
Write-Host "✅ FASE 2 COMPLETA!" -ForegroundColor Green
```

---

## 🚨 FASE 3: RESPOSTA (Testa em staging/desenvolvimento)

### Passo 3.1: Instalar OWASP ZAP

```powershell
# Via Chocolatey (recomendado)
choco install zaproxy -y

# Ou download manual:
# https://www.zaproxy.org/download/

# Verificar
zaproxy --version
```

### Passo 3.2: Configurar e rodar ZAP

```powershell
# Se TotemSync roda em localhost:3000 (Vite dev server):

# Opção A: ZAP Baseline Scan (rápido)
zaproxy -cmd -quickurl http://localhost:3000 -quickout zap-report.html

# Opção B: ZAP Scan completo (lento, mas mais detalhado)
zaproxy -cmd `
  -host localhost `
  -port 8080 `
  -config api.disablekey=true `
  -quickurl http://localhost:3000 `
  -quickout zap-report-full.html

# Abrir relatório
Start-Process zap-report.html
```

### Passo 3.3: Testar API endpoints (se tiver backend)

```powershell
# Se TotemSync tem API endpoints (por exemplo, Firebase Functions)
# Use SQLMap para testar injeção SQL

# Instalar SQLMap
pip install sqlmap

# Testar endpoint (exemplo genérico)
sqlmap -u "http://localhost:3000/api/data?id=1" --dbs

# Ou com arquivo de dump
sqlmap -u "http://localhost:3000/api/data?id=1" --dump-all -o --batch
```

### ✅ Validar FASE 3

```powershell
# Executar:
zaproxy --version                    # Deve retornar versão
Test-Path zap-report.html           # True
sqlmap --version                    # Deve retornar versão

Write-Host "✅ FASE 3 COMPLETA!" -ForegroundColor Green
```

---

## 📊 FASE 4: CONFORMIDADE (Centraliza e automatiza)

### Passo 4.1: Instalar Docker (para Defect Dojo)

```powershell
# Download e instale:
# https://www.docker.com/products/docker-desktop

# Verificar após instalar
docker --version
# Esperado: Docker version 24.x.x

# Iniciar Docker Desktop (ele abre automaticamente)
```

### Passo 4.2: Rodar Defect Dojo

```powershell
# Criar pasta para Defect Dojo
mkdir C:\tools\defect-dojo
cd C:\tools\defect-dojo

# Clonar repositório
git clone https://github.com/DefectDojo/django-defect-dojo.git .

# Rodar com docker-compose
docker-compose up

# Aguardar ~2-3 minutos para carregar
# Acessar: http://localhost:8000
# Default login: admin / admin

# (Deixar rodando em outro terminal)
```

### Passo 4.3: Configurar CI/CD com GitHub Actions

```powershell
# Na pasta do TotemSync, criar pasta .github/workflows
mkdir -p .github\workflows

# Criar arquivo: security-pipeline.yml
$workflow = @"
name: 🛡️ Security Pipeline

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      # FASE 1: Git Secrets
      - name: "1️⃣ Check Secrets"
        run: |
          npm install -g git-secrets
          git secrets --install
          git secrets --register-aws
          git secrets --scan
        continue-on-error: true
      
      # FASE 2: npm audit
      - name: "1️⃣ npm audit"
        run: npm ci && npm audit --production || true
      
      # FASE 2: Semgrep
      - name: "2️⃣ Semgrep"
        run: |
          npm install -g semgrep
          semgrep --config=p/owasp-top-ten . --json -o semgrep.json || true
      
      # FASE 2: Snyk
      - name: "2️⃣ Snyk"
        run: |
          npm install -g snyk
          snyk test --json-file-output=snyk.json || true
        env:
          SNYK_TOKEN: \${{ secrets.SNYK_TOKEN }}
        continue-on-error: true
      
      # FASE 2: Trivy
      - name: "2️⃣ Trivy"
        run: |
          wget -q https://github.com/aquasecurity/trivy/releases/download/v0.47.0/trivy_0.47.0_linux-64bit.tar.gz
          tar zxf trivy_0.47.0_linux-64bit.tar.gz
          ./trivy fs . --format json -o trivy.json || true
      
      # Consolidar
      - name: "Consolidate Reports"
        run: python consolidate-reports.py
      
      # Falhar se crítico
      - name: "🚨 Fail on Critical"
        run: |
          CRITICAL=\$(jq '.summary.semgrep_issues' security-consolidated-report.json 2>/dev/null || echo 0)
          if [ "\$CRITICAL" -gt 0 ]; then
            echo "❌ CRÍTICO detectado"
            exit 1
          fi
      
      # Upload artefatos
      - name: "Upload Reports"
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: security-reports
          path: |
            security-consolidated-report.json
            semgrep.json
            snyk.json
            trivy.json
            zap-report.html
"@

$workflow | Out-File -FilePath .github\workflows\security-pipeline.yml -Encoding UTF8 -Force

# Adicionar ao git
git add .github/workflows/security-pipeline.yml
git commit -m "chore: add security pipeline"
```

### Passo 4.4: Configurar Audit Trail

```powershell
# Criar arquivo: src/utils/audit-logger.ts (para Electron/Node.js)

$auditLogger = @"
import { appendFileSync } from 'fs';
import { join } from 'path';

const AUDIT_LOG = join(process.cwd(), 'logs', 'audit.log');

export interface AuditEntry {
  timestamp: string;
  userId?: string;
  action: string;      // 'LOGIN', 'READ', 'WRITE', 'DELETE'
  resource: string;    // path or resource ID
  status: 'SUCCESS' | 'FAILURE';
  metadata?: Record<string, any>;
}

export function logAccess(entry: AuditEntry) {
  const fullEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  try {
    appendFileSync(AUDIT_LOG, JSON.stringify(fullEntry) + '\n');
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

// Usar em qualquer lugar:
// logAccess({
//   userId: user.id,
//   action: 'READ',
//   resource: '/api/data/123',
//   status: 'SUCCESS'
// });
"@

$auditLogger | Out-File -FilePath src\utils\audit-logger.ts -Encoding UTF8 -Force
```

### ✅ Validar FASE 4

```powershell
# Executar:
docker --version                              # Deve retornar versão
Test-Path .github\workflows\security-pipeline.yml  # True
Test-Path src\utils\audit-logger.ts          # True

Write-Host "✅ FASE 4 COMPLETA!" -ForegroundColor Green
```

---

## 🎯 EXECUÇÃO RÁPIDA (RESUMIDO)

Se você quiser só executar tudo em sequência (copy-paste):

```powershell
# 1. PREVENÇÃO
npm install -g git-secrets
git secrets --install && git secrets --register-aws
git secrets --add 'firebase_api_key'
npm install
npm audit fix

# 2. DETECÇÃO
npm install -g semgrep && npm install -g snyk && npm install -g @trivy/cli
semgrep --config=p/owasp-top-ten . --json -o semgrep-report.json
snyk test --json-file-output=snyk-report.json
python consolidate-reports.py

# 3. RESPOSTA
choco install zaproxy -y
zaproxy -cmd -quickurl http://localhost:3000 -quickout zap-report.html

# 4. CONFORMIDADE
mkdir .github\workflows
# (Copiar conteúdo do workflow acima)
```

---

## 📊 Dashboard

Abra em navegador (salve localmente):
```
security-dashboard.html
```

---

## 🚨 TROUBLESHOOTING Windows

### Erro: "semgrep not found"
```powershell
npm install -g semgrep
# ou
choco install semgrep -y
```

### Erro: "PowerShell execution policy"
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Erro: "Docker not running"
```powershell
# Abrir Docker Desktop manualmente ou:
docker ps  # Verifica se Docker está rodando
```

### Erro: "Python not installed"
```powershell
# Instalar via Windows Store ou:
choco install python -y
```

---

## ✅ CHECKLIST FINAL

```
[ ] Git-secrets instalado e configurado
[ ] .gitignore criado
[ ] npm audit passando
[ ] Pre-commit hooks setup (husky)
[ ] Semgrep instalado
[ ] Snyk instalado e autenticado
[ ] Trivy instalado
[ ] ZAP instalado
[ ] Docker instalado
[ ] CI/CD workflow criado
[ ] Audit logger implementado
[ ] Relatórios consolidados
```

---

## 🚀 PRÓXIMOS PASSOS

1. **Execute FASE 1 agora** (Prevenção - 15 min)
2. **Valide com:** `git secrets --version`
3. **Execute FASE 2** (Detecção - 20 min)
4. **Execute FASE 3** (Resposta - 10 min)
5. **Execute FASE 4** (Conformidade - 30 min)

**Total: ~75 minutos**

---

**Pronto para começar? Copie o primeiro bloco de código e execute!**

Se algum comando falhar, manda a mensagem de erro que resolvo.
