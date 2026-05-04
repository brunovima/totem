# 🛡️ TotemSync Security Setup - Windows Guide

**Status:** Pronto para implementação  
**Tempo estimado:** 75 minutos  
**Dificuldade:** Fácil (copy-paste)

---

## ⚡ QUICK START (5 MINUTOS)

Se você quer executar **TUDO de uma vez**:

### Passo 1: Abrir PowerShell como Admin

```powershell
# Pressione: Windows + X
# Selecione: "Windows PowerShell (Admin)"
# Ou: Win + R → powershell → Ctrl+Shift+Enter
```

### Passo 2: Navegar para TotemSync

```powershell
# Ajuste o caminho conforme sua pasta:
cd C:\seu\caminho\para\totem

# Verificar que está no lugar certo:
ls  # Deve mostrar: package.json, src/, etc
```

### Passo 3: Executar o script de automação

```powershell
# Permitir execução de scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force

# Baixar e rodar o script de segurança
# (Ou copie o arquivo security-setup.ps1 para a pasta do projeto)

powershell -ExecutionPolicy Bypass -File security-setup.ps1
```

**Pronto! O script automatiza as 4 fases.**

---

## 📋 PASSO-A-PASSO (Se preferir executar manualmente)

### FASE 1: PREVENÇÃO (15 min)

**O que faz:** Bloqueia credenciais antes de saírem do repositório

#### 1.1 - Instalar git-secrets

```powershell
npm install -g git-secrets
git secrets --version  # Deve retornar versão
```

#### 1.2 - Configurar no TotemSync

```powershell
# Na pasta do projeto:
cd C:\seu\caminho\para\totem

# Instalar hooks
git secrets --install
git secrets --register-aws

# Adicionar padrões customizados
git secrets --add 'firebase_api_key'
git secrets --add 'JWT_SECRET'
git secrets --add 'DATABASE_URL'
```

#### 1.3 - Criar .gitignore seguro

```powershell
# Copiar este conteúdo para arquivo .gitignore na raiz do projeto:

.env
.env.local
.env.*.local
node_modules/
npm-debug.log
.firebaserc
firebase-key.json
*.db
*.sqlite
.DS_Store
Thumbs.db
dist/
build/
*.exe
.vscode/
.idea/

# (Copie todo o conteúdo do arquivo TOTEM_SECURITY_WINDOWS.md seção 1.6)
```

#### 1.4 - Testar git-secrets (Simulação)

```powershell
# Criar arquivo de teste com secret
@"
DATABASE_PASSWORD=super_secret_123
"@ | Out-File test.txt

# Tentar adicionar ao git
git add test.txt
git secrets --scan

# Deve bloquear com mensagem de erro ✅

# Limpar teste
git reset HEAD test.txt
Remove-Item test.txt
```

#### 1.5 - npm audit

```powershell
npm install
npm audit --production

# Se houver vulnerabilidades críticas:
npm audit fix
```

#### 1.6 - Validar FASE 1

```powershell
# Executar cada linha:
git secrets --version
Test-Path .gitignore
npm audit --production

# Se tudo passou:
Write-Host "✅ FASE 1 COMPLETA!" -ForegroundColor Green
```

---

### FASE 2: DETECÇÃO (20 min)

**O que faz:** Encontra vulnerabilidades no código

#### 2.1 - Instalar Semgrep

```powershell
npm install -g semgrep
semgrep --version
```

#### 2.2 - Rodar Semgrep

```powershell
# Na pasta do projeto
semgrep --config=p/owasp-top-ten . --json -o semgrep-report.json

# Ver no terminal (mais legível)
semgrep --config=p/owasp-top-ten .
```

#### 2.3 - Instalar Snyk

```powershell
npm install -g snyk

# Login (abre navegador)
snyk auth

# Testar
snyk test --json-file-output=snyk-report.json

# Ver apenas críticos
snyk test --severity-threshold=high
```

#### 2.4 - Instalar Trivy

```powershell
# Criar pasta temporária
mkdir C:\temp -Force

# Baixar Trivy
$url = "https://github.com/aquasecurity/trivy/releases/download/v0.47.0/trivy_0.47.0_windows-64bit.zip"
Invoke-WebRequest -Uri $url -OutFile C:\temp\trivy.zip

# Descompactar
Expand-Archive -Path C:\temp\trivy.zip -DestinationPath C:\temp\trivy -Force

# Testar
C:\temp\trivy\trivy.exe --version
```

#### 2.5 - Rodar Trivy

```powershell
# Na pasta do projeto
C:\temp\trivy\trivy.exe fs . --format json -o trivy-report.json

# Ver no terminal
C:\temp\trivy\trivy.exe fs .
```

#### 2.6 - Consolidar relatórios

```powershell
# Criar arquivo consolidate-reports.py (copie do guia TOTEM_SECURITY_WINDOWS.md)

# Executar:
python consolidate-reports.py

# Resultado:
cat security-consolidated-report.json
```

#### 2.7 - Validar FASE 2

```powershell
semgrep --version
snyk --version
C:\temp\trivy\trivy.exe --version
Test-Path semgrep-report.json
Test-Path snyk-report.json
Test-Path trivy-report.json
Test-Path security-consolidated-report.json

# Se tudo passou:
Write-Host "✅ FASE 2 COMPLETA!" -ForegroundColor Green
```

---

### FASE 3: RESPOSTA (10 min)

**O que faz:** Testa comportamento em runtime (staging)

#### 3.1 - Instalar ZAP

```powershell
# Via Chocolatey (recomendado)
choco install zaproxy -y

# Ou download manual:
# https://www.zaproxy.org/download/

zaproxy --version  # Verificar
```

#### 3.2 - Rodar ZAP

```powershell
# Iniciar servidor Vite do TotemSync em outro terminal:
npm run dev

# Aguardar até estar em http://localhost:5173 (ou seu port)

# Em outro terminal, rodar ZAP:
zaproxy -cmd -quickurl http://localhost:5173 -quickout zap-report.html

# Abrir relatório
Start-Process zap-report.html
```

#### 3.3 - Validar FASE 3

```powershell
zaproxy --version
Test-Path zap-report.html

# Se tudo passou:
Write-Host "✅ FASE 3 COMPLETA!" -ForegroundColor Green
```

---

### FASE 4: CONFORMIDADE (30 min)

**O que faz:** Centraliza achados e automatiza testes

#### 4.1 - Instalar Docker

```powershell
# Download: https://www.docker.com/products/docker-desktop
# Instalar normalmente

# Verificar
docker --version
```

#### 4.2 - Setup CI/CD (GitHub Actions)

```powershell
# Criar pasta workflows
mkdir .github\workflows -Force

# Criar arquivo .github/workflows/security.yml
# (Copiar conteúdo da seção 4.3 no guia TOTEM_SECURITY_WINDOWS.md)

# Adicionar ao git
git add .github/workflows/security.yml
git commit -m "chore: add security pipeline"
```

#### 4.3 - Criar Audit Logger

```powershell
# Criar arquivo src/utils/audit-logger.ts
# (Copiar conteúdo da seção 4.4 no guia TOTEM_SECURITY_WINDOWS.md)

# Usar no seu código Electron/Node.js conforme mostrado
```

#### 4.4 - Validar FASE 4

```powershell
docker --version
Test-Path .github\workflows\security.yml
Test-Path src\utils\audit-logger.ts

# Se tudo passou:
Write-Host "✅ FASE 4 COMPLETA!" -ForegroundColor Green
```

---

## 📊 Dashboard Visual

Abra este arquivo em seu navegador para acompanhar progresso:

```
security-dashboard.html
```

Ele salva seu progresso automaticamente no navegador.

---

## 📁 Arquivos Criados

Após executar tudo, você terá:

```
TotemSync/
├── .gitignore                          (Protege credenciais)
├── .github/
│   └── workflows/
│       └── security.yml                (CI/CD automático)
├── src/
│   └── utils/
│       └── audit-logger.ts             (Registra acessos)
├── semgrep-report.json                 (Relatório Semgrep)
├── snyk-report.json                    (Relatório Snyk)
├── trivy-report.json                   (Relatório Trivy)
├── zap-report.html                     (Relatório ZAP)
├── security-consolidated-report.json   (Consolidado)
├── consolidate-reports.py              (Script auxiliar)
└── security-dashboard.html             (Dashboard visual)
```

---

## 🧪 Teste Rápido (Validar tudo)

Copie e execute no PowerShell:

```powershell
# 1. Git-secrets
git secrets --version

# 2. Semgrep
semgrep --version

# 3. Snyk
snyk --version

# 4. Trivy
C:\temp\trivy\trivy.exe --version

# 5. ZAP
zaproxy --version

# 6. Docker
docker --version

# 7. Relatórios
Test-Path semgrep-report.json
Test-Path snyk-report.json
Test-Path trivy-report.json
Test-Path zap-report.html
Test-Path security-consolidated-report.json

# Se tudo retornar True/versão:
Write-Host "✅ TUDO INSTALADO E FUNCIONANDO!" -ForegroundColor Green
```

---

## ⚠️ Troubleshooting Windows

### Erro: "npm: command not found"
```powershell
# Instalar Node.js: https://nodejs.org/
# Após instalar, reiniciar PowerShell
```

### Erro: "git-secrets not found"
```powershell
npm install -g git-secrets
# Ou:
choco install git-secrets -y
```

### Erro: "PowerShell execution policy"
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

### Erro: "Docker not running"
```powershell
# Abrir Docker Desktop (atalho no desktop ou menu Iniciar)
# Ou executar:
"C:\Program Files\Docker\Docker\Docker.exe"
```

### Erro: "Python not installed"
```powershell
# Instalar via Windows Store ou:
choco install python -y
```

### Erro: "Trivy download failed"
```powershell
# Download manual: https://github.com/aquasecurity/trivy/releases
# E coloque em C:\temp\trivy\
```

---

## ✅ Checklist Final

```
[ ] PowerShell aberto como Admin
[ ] Navegado até pasta TotemSync
[ ] git-secrets instalado
[ ] .gitignore criado
[ ] npm audit passando (sem críticos)
[ ] Semgrep instalado e rodou
[ ] Snyk instalado e autenticado
[ ] Trivy instalado e rodou
[ ] ZAP instalado
[ ] CI/CD workflow criado (.github/workflows/)
[ ] Audit logger criado (src/utils/audit-logger.ts)
[ ] Relatórios consolidados
[ ] Dashboard aberto em navegador
```

---

## 🚀 Próximas Ações

1. **Agora:** Execute o script de automação
   ```powershell
   powershell -ExecutionPolicy Bypass -File security-setup.ps1
   ```

2. **Após completar:** Commitar alterações
   ```powershell
   git add .
   git commit -m "chore: add security infrastructure"
   git push
   ```

3. **Próximos dias:** Revisar relatórios e remediar achados

4. **Contínuo:** CI/CD roda a cada commit automaticamente

---

## 📞 Suporte

Se algum comando falhar:

1. Copie a **mensagem de erro completa**
2. Mande para análise
3. Ajustarei o comando ou procedimento

---

## 📖 Referências

- **Guia Completo:** `TOTEM_SECURITY_WINDOWS.md`
- **Script Automático:** `security-setup.ps1`
- **SKILL:** `cybersecurity-setup-bruno.skill`
- **Dashboard:** `security-dashboard.html`

---

**Pronto? Vamos começar!**

Execute no PowerShell (como Admin):
```powershell
powershell -ExecutionPolicy Bypass -File security-setup.ps1
```

Qualquer dúvida, é só chamar! 🛡️
